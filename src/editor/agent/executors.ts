"use client";

import type { z } from "zod";
import { summarizeProject } from "@/agent/summary";
import type { TOOL_SCHEMAS, ToolInput, ToolName } from "@/agent/tool-schemas";
import { getCaptionPreset, scaledCaptionStyle } from "@/core/caption-presets";
import { findFillerWords, findSpeechGaps } from "@/core/captions";
import { ASPECT_PRESETS, createCaptionsClip } from "@/core/defaults";
import { newId } from "@/core/ids";
import { lintProject } from "@/core/lint";
import {
  type Actor,
  addMarker,
  EditError,
  insertClip,
  moveClip,
  removeClips,
  rippleDeleteRange,
  setKeyframes,
  setTransition,
  splitClip,
  trimClip,
  updateClip,
  updateSettings,
  upsertComponent,
} from "@/core/ops";
import { getClipEnd } from "@/core/project-utils";
import type { Clip, Project } from "@/core/schema";
import { applyStyleDNA, getArchetypeBase, getStylePreset, type StyleDNA, StyleDNASchema } from "@/core/styles";
import { compileCodeComponent, getComponentErrors } from "@/remotion/code/runtime";
import { motionCatalogForAgents } from "@/remotion/components/registry";
import type { AgentIdentity } from "@/server/bridge";
import { detectBeatsForAsset, generateImageAsset, generateVoiceoverAsset, importMediaUrl, searchStock, transcribeAsset } from "../media/ai";
import { useAgentStore } from "../store/agent-store";
import { seek, usePlaybackStore } from "../store/playback-store";
import { getProject, transact } from "../store/project-store";
import { useUIStore } from "../store/ui-store";
import { specPatchToClipPatch, specToClip } from "./convert";
import { describeToolCall } from "./describe";
import { useInteractions } from "./interactions";
import { captureFrames } from "./review";

type Ctx = { agent: AgentIdentity; actor: Actor };

const r2 = (n: number) => Math.round(n * 100) / 100;
const fps = () => getProject().settings.fps;
const fr = (sec: number) => Math.max(0, Math.round(sec * fps()));
const sec = (frames: number) => r2(frames / fps());

/** Runs an edit as one labelled, attributed transaction and shows the agent's presence. */
const edit = <T>(ctx: Ctx, label: string, recipe: (d: Project) => T): T => {
  const before = getProject();
  const result = transact(label, recipe, { actor: ctx.actor, turnId: ctx.agent.turnId });
  const after = getProject();
  // Figure out which clips changed so the UI can light them up.
  const changed = Object.keys(after.clips).filter((id) => after.clips[id] !== before.clips[id]);
  if (changed.length) {
    useAgentStore.getState().touch(changed);
    const first = changed.map((id) => after.clips[id]).sort((a, b) => a.start - b.start)[0];
    if (first) focusAgentAt(first.start + Math.min(first.duration - 1, Math.round(fps() * 0.6)));
  }
  return result;
};

/** Moves the agent's playhead; with "follow agent" the user's preview follows too. */
const focusAgentAt = (frame: number) => {
  useAgentStore.getState().setFrame(frame);
  if (useUIStore.getState().followAgent && !usePlaybackStore.getState().playing) seek(frame);
};

const errorResult = (err: unknown) => ({
  error: err instanceof Error ? err.message : String(err),
  code: err instanceof EditError ? err.code : undefined,
});

type Executor<T extends ToolName> = (input: ToolInput<T>, ctx: Ctx) => Promise<unknown> | unknown;

const executors: { [K in ToolName]?: Executor<K> } = {
  get_project: (input) =>
    summarizeProject(getProject(), {
      rangeSec: input.rangeSec,
      includeTranscripts: input.includeTranscripts,
      selection: useUIStore.getState().selectedClipIds,
      playheadFrame: usePlaybackStore.getState().frame,
    }),

  get_clips: (input) => {
    const p = getProject();
    return {
      fps: p.settings.fps,
      note: "start/duration/keyframe frames are in frames at this fps",
      clips: input.ids.map((id) => {
        const c = p.clips[id];
        return c ? { ...c, startSec: sec(c.start), durationSec: sec(c.duration) } : { id, error: "not found" };
      }),
    };
  },

  set_plan: (input, ctx) => {
    useAgentStore.getState().setPlan(
      input.steps.map((s, i) => ({
        id: `step-${i}`,
        title: s.title,
        status: i === 0 ? "running" : "pending",
        range: s.rangeSec ? [fr(s.rangeSec[0]), fr(s.rangeSec[1])] : undefined,
      })),
    );
    useAgentStore.getState().setStatus("working", input.steps[0]?.title ?? null, ctx.agent.name);
    return { ok: true, steps: input.steps.length };
  },

  update_plan: (input, ctx) => {
    const plan = useAgentStore.getState().plan;
    const step = plan[input.index];
    if (!step) return { error: `No step ${input.index}; plan has ${plan.length} steps.` };
    useAgentStore.getState().updateStep(step.id, { status: input.status });
    if (input.status === "done") {
      const next = plan[input.index + 1];
      if (next && next.status === "pending") useAgentStore.getState().updateStep(next.id, { status: "running" });
      useAgentStore.getState().setStatus("working", next?.title ?? "Wrapping up", ctx.agent.name);
    }
    if (step.range) focusAgentAt(step.range[0]);
    return { ok: true };
  },

  add_clips: (input, ctx) => {
    const meta = { createdBy: ctx.agent.kind, agent: ctx.agent.name, turnId: ctx.agent.turnId } as const;
    const created = edit(
      ctx,
      input.clips.length === 1 ? describeToolCall("add_clips", input).replace(/^Added /, "Add ") : `Add ${input.clips.length} clips`,
      (d) =>
        input.clips.map((spec) => {
          const clip = specToClip(d, spec, meta);
          const id = insertClip(d, clip, "auto-track", { actor: ctx.actor });
          return { id, type: clip.type, trackId: d.clips[id]?.trackId, startSec: sec(clip.start), endSec: sec(getClipEnd(clip)) };
        }),
    );
    return { created };
  },

  update_clips: (input, ctx) => {
    const results: { id: string; ok: boolean; error?: string }[] = [];
    edit(ctx, input.updates.length === 1 ? "Edit clip" : `Edit ${input.updates.length} clips`, (d) => {
      for (const { id, patch } of input.updates) {
        try {
          const clip = d.clips[id];
          if (!clip) throw new Error(`Clip "${id}" not found`);
          const opts = { actor: ctx.actor, force: input.force };
          if (patch.trackId || patch.startSec !== undefined) {
            moveClip(
              d,
              id,
              { start: patch.startSec !== undefined ? fr(patch.startSec) : undefined, trackId: patch.trackId },
              "auto-track",
              opts,
            );
          }
          if (patch.durationSec !== undefined) {
            const c = d.clips[id];
            trimClip(d, id, { end: c.start + Math.max(1, fr(patch.durationSec)) }, opts);
          }
          const converted = specPatchToClipPatch(patch, d.clips[id], d.settings.fps);
          const { animations, ...rest } = converted;
          if (Object.keys(rest).length) updateClip(d, id, rest, opts);
          if (animations !== undefined) {
            updateClip(d, id, { animations: null }, opts);
            if (animations) updateClip(d, id, { animations }, opts);
          }
          results.push({ id, ok: true });
        } catch (err) {
          results.push({ id, ok: false, error: errorResult(err).error });
        }
      }
    });
    return { results };
  },

  delete_clips: (input, ctx) => {
    edit(ctx, `Delete ${input.ids.length} clip${input.ids.length > 1 ? "s" : ""}`, (d) =>
      removeClips(d, input.ids, { actor: ctx.actor, ripple: input.ripple }),
    );
    return { deleted: input.ids };
  },

  split_clip: (input, ctx) => {
    const ids = edit(ctx, "Split clip", (d) => splitClip(d, input.id, fr(input.atSec), { actor: ctx.actor }));
    return { left: ids[0], right: ids[1] };
  },

  trim_clip: (input, ctx) => {
    edit(ctx, "Trim clip", (d) =>
      trimClip(
        d,
        input.id,
        {
          start: input.startSec !== undefined ? fr(input.startSec) : undefined,
          end: input.endSec !== undefined ? fr(input.endSec) : undefined,
        },
        { actor: ctx.actor },
      ),
    );
    const c = getProject().clips[input.id];
    return c ? { id: c.id, startSec: sec(c.start), endSec: sec(getClipEnd(c)) } : { ok: true };
  },

  ripple_delete_range: (input, ctx) => {
    edit(ctx, `Cut ${r2(input.endSec - input.startSec)}s`, (d) =>
      rippleDeleteRange(d, { start: fr(input.startSec), end: fr(input.endSec), trackIds: input.trackIds }, { actor: ctx.actor }),
    );
    return { ok: true, removedSec: r2(input.endSec - input.startSec) };
  },

  set_keyframes: (input, ctx) => {
    edit(ctx, `Animate ${input.property}`, (d) =>
      setKeyframes(
        d,
        input.id,
        input.property,
        input.keyframes.map((k) => ({ frame: fr(k.timeSec), value: k.value, easing: k.easing })),
        { actor: ctx.actor },
      ),
    );
    return { ok: true, keyframes: input.keyframes.length };
  },

  set_transition: (input, ctx) => {
    edit(ctx, input.transition ? `Add ${input.transition.type} transition` : "Remove transition", (d) =>
      setTransition(
        d,
        input.id,
        input.transition
          ? {
              type: input.transition.type,
              duration: Math.max(1, fr(input.transition.durationSec)),
              direction: input.transition.direction,
              easing: input.transition.easing,
            }
          : null,
        { actor: ctx.actor },
      ),
    );
    return { ok: true };
  },

  apply_style: (input, ctx) => {
    let dna: StyleDNA | undefined;
    if (input.custom) {
      const custom = input.custom as { id?: string; archetype?: StyleDNA["archetype"] };
      const base = getStylePreset(String(custom.id ?? "")) ?? (custom.archetype ? getArchetypeBase(custom.archetype) : undefined);
      const merged = { ...(base ?? getStylePreset("base-retention_entertainment")), ...input.custom } as StyleDNA;
      const parsed = StyleDNASchema.safeParse(merged);
      if (!parsed.success) {
        return {
          error: `Custom style is invalid: ${parsed.error.issues
            .slice(0, 4)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`,
        };
      }
      dna = parsed.data;
    } else if (input.styleId) {
      dna = getStylePreset(input.styleId);
    }
    if (!dna) return { error: `Unknown style "${input.styleId}". Use list_styles.` };
    const style = dna;
    const result = edit(ctx, `Apply ${style.name} style`, (d) =>
      applyStyleDNA(d, style, { parts: input.parts, clipIds: input.clipIds, actor: ctx.actor }),
    );
    return result;
  },

  list_components: (input) => {
    const p = getProject();
    const builtIn = motionCatalogForAgents().filter((c) => !input.category || c.category === input.category);
    const code = Object.values(p.components).map((c) => ({
      id: `code:${c.id}`,
      category: "custom",
      description: c.description ?? c.name,
      props: Object.fromEntries(Object.entries(c.propsSchema).map(([k, f]) => [k, `${f.type} = ${JSON.stringify(f.default)}`])),
    }));
    return { components: [...builtIn, ...code] };
  },

  create_component: async (input, ctx) => {
    const compiled = compileCodeComponent(input.source);
    if (!compiled.ok) return { ok: false, error: compiled.error, hint: "Fix the code and call create_component again." };
    const id = newId("comp");
    const clipId = edit(ctx, `Create component ${input.name}`, (d) => {
      upsertComponent(d, {
        id,
        name: input.name,
        description: input.description,
        source: input.source,
        propsSchema: input.propsSchema as Project["components"][string]["propsSchema"],
        createdBy: ctx.agent.kind === "agent" ? "agent" : "ai",
        updatedAt: Date.now(),
      });
      if (!input.place) return undefined;
      const clip = specToClip(
        d,
        {
          type: "component",
          component: `code:${id}`,
          startSec: input.place.startSec,
          durationSec: input.place.durationSec,
          trackId: input.place.trackId,
          props: input.place.props,
          name: input.name,
        },
        { createdBy: ctx.agent.kind, agent: ctx.agent.name, turnId: ctx.agent.turnId },
      );
      return insertClip(d, clip, "auto-track", { actor: ctx.actor });
    });
    // Give the preview a moment to render it, then report runtime errors.
    await new Promise((r) => setTimeout(r, 700));
    const runtime = getComponentErrors().filter((e) => e.componentId === `code:${id}`);
    return { ok: runtime.length === 0, componentId: `code:${id}`, clipId, runtimeErrors: runtime.map((e) => e.message) };
  },

  update_component: async (input, ctx) => {
    const id = input.componentId.replace(/^code:/, "");
    const existing = getProject().components[id];
    if (!existing) return { error: `Component ${input.componentId} not found` };
    if (input.source) {
      const compiled = compileCodeComponent(input.source);
      if (!compiled.ok) return { ok: false, error: compiled.error };
    }
    edit(ctx, `Update component ${existing.name}`, (d) =>
      upsertComponent(d, {
        ...existing,
        source: input.source ?? existing.source,
        propsSchema: (input.propsSchema as typeof existing.propsSchema) ?? existing.propsSchema,
        updatedAt: Date.now(),
      }),
    );
    await new Promise((r) => setTimeout(r, 700));
    const runtime = getComponentErrors().filter((e) => e.componentId === `code:${id}`);
    return { ok: runtime.length === 0, runtimeErrors: runtime.map((e) => e.message) };
  },

  get_errors: () => ({ errors: getComponentErrors() }),

  add_captions: async (input, ctx) => {
    const p = getProject();
    const clip = p.clips[input.clipId];
    if (!clip || (clip.type !== "video" && clip.type !== "audio")) return { error: "add_captions needs a video or audio clip id." };
    useAgentStore.getState().setStatus("working", "Transcribing…", ctx.agent.name);
    const transcript = await transcribeAsset(clip.assetId);
    if (!transcript.words.length) return { error: "No speech found in this clip." };
    const words = transcript.words.map((w) => ({ ...w, emphasis: input.emphasizeKeywords ? isKeyword(w.text) : undefined }));
    const preset = getCaptionPreset(input.preset ?? "bold-pop") ?? getCaptionPreset("bold-pop");
    const id = edit(ctx, "Add captions", (d) => {
      const style = preset ? scaledCaptionStyle(preset, d.settings) : undefined;
      const { yPct, ...styleOverrides } = input.style ?? {};
      const captions = createCaptionsClip(d.settings, {
        trackId: d.tracks.find((t) => t.kind === "visual" && !t.locked)?.id ?? d.tracks[0].id,
        start: clip.start,
        duration: clip.duration,
        words,
        timeBase: "source",
        sourceClipId: clip.id,
        style: { ...style, ...styleOverrides },
        meta: { createdBy: ctx.agent.kind, agent: ctx.agent.name, turnId: ctx.agent.turnId },
      });
      if (yPct !== undefined) captions.transform.y = Math.round(yPct * d.settings.height);
      return insertClip(d, captions, "auto-track", { actor: ctx.actor });
    });
    return { clipId: id, words: words.length };
  },

  transcribe: async (input, ctx) => {
    useAgentStore.getState().setStatus("working", "Transcribing…", ctx.agent.name);
    const t = await transcribeAsset(input.assetId);
    const text = t.text;
    return { words: t.words.length, language: t.language, text: text.length > 6000 ? `${text.slice(0, 6000)}… (truncated)` : text };
  },

  remove_silences: async (input, ctx) => {
    const p = getProject();
    const clip = p.clips[input.clipId];
    if (!clip || (clip.type !== "video" && clip.type !== "audio")) return { error: "remove_silences needs a video or audio clip." };
    const t = await transcribeAsset(clip.assetId);
    const gaps = findSpeechGaps(t.words, (input.minSilenceSec ?? 0.6) * 1000, (input.paddingSec ?? 0.12) * 1000);
    return cutSourceRanges(ctx, clip, gaps, "silence");
  },

  remove_fillers: async (input, ctx) => {
    const p = getProject();
    const clip = p.clips[input.clipId];
    if (!clip || (clip.type !== "video" && clip.type !== "audio")) return { error: "remove_fillers needs a video or audio clip." };
    const t = await transcribeAsset(clip.assetId);
    const fillers = findFillerWords(t.words, input.aggressive);
    return cutSourceRanges(ctx, clip, fillers, "filler");
  },

  detect_beats: async (input, ctx) => {
    useAgentStore.getState().setStatus("working", "Finding the beat…", ctx.agent.name);
    const { bpm, beats } = await detectBeatsForAsset(input.assetId);
    if (input.addMarkers) {
      const p = getProject();
      const usage = Object.values(p.clips).find((c) => c.type === "audio" && c.assetId === input.assetId) as
        | Extract<Clip, { type: "audio" }>
        | undefined;
      const offset = usage ? usage.start - usage.trimStart : 0;
      edit(ctx, "Add beat markers", (d) => {
        for (const b of beats.slice(0, 400)) addMarker(d, { frame: Math.round(b * d.settings.fps) + offset, label: "beat", kind: "beat" });
      });
    }
    return { bpm, beats: beats.slice(0, 200).map(r2), totalBeats: beats.length };
  },

  add_markers: (input, ctx) => {
    edit(ctx, `Add ${input.markers.length} marker${input.markers.length > 1 ? "s" : ""}`, (d) => {
      for (const m of input.markers) addMarker(d, { frame: fr(m.timeSec), label: m.label, kind: m.kind ?? "note" });
    });
    return { ok: true };
  },

  set_canvas: (input, ctx) => {
    const preset = input.aspect ? ASPECT_PRESETS[input.aspect] : undefined;
    edit(ctx, input.aspect ? `Switch to ${input.aspect}` : "Change canvas", (d) =>
      updateSettings(d, {
        ...(preset ? { width: preset.width, height: preset.height } : {}),
        ...(input.width ? { width: Math.round(input.width) } : {}),
        ...(input.height ? { height: Math.round(input.height) } : {}),
        ...(input.fps ? { fps: Math.round(input.fps) } : {}),
        ...(input.backgroundColor ? { backgroundColor: input.backgroundColor } : {}),
      }),
    );
    const s = getProject().settings;
    return { width: s.width, height: s.height, fps: s.fps };
  },

  review_frames: async (input, ctx) => {
    useAgentStore.getState().setStatus("working", "Reviewing frames…", ctx.agent.name);
    const frames = await captureFrames(input.timesSec, input.count ?? 6);
    const lint = lintProject(getProject());
    return {
      summary: lint.length
        ? `${lint.filter((l) => l.severity === "error").length} errors, ${lint.filter((l) => l.severity === "warning").length} warnings`
        : "No issues found by the linter.",
      lint,
      frames,
    };
  },

  seek: (input) => {
    seek(fr(input.timeSec));
    return { ok: true };
  },

  select_clips: (input) => {
    useUIStore.getState().select(input.ids);
    return { ok: true };
  },

  ask_user: async (input, ctx) => {
    useAgentStore.getState().setStatus("waiting", input.question, ctx.agent.name);
    const answer = await useInteractions
      .getState()
      .ask({ id: newId("turn"), agent: ctx.agent.name, question: input.question, options: input.options });
    useAgentStore.getState().setStatus("working", null, ctx.agent.name);
    return { answer };
  },

  import_media: async (input) => {
    const asset = await importMediaUrl(input.url, input.name);
    return { assetId: asset.id, type: asset.type, durationSec: asset.durationSec };
  },

  search_stock: async (input) => searchStock(input.query, input.type ?? "video", input.orientation),

  generate_image: async (input, ctx) => {
    useAgentStore.getState().setStatus("working", "Generating image…", ctx.agent.name);
    const asset = await generateImageAsset(input.prompt, input.aspect ?? "16:9");
    return { assetId: asset.id, width: asset.width, height: asset.height };
  },

  generate_voiceover: async (input, ctx) => {
    useAgentStore.getState().setStatus("working", "Recording voiceover…", ctx.agent.name);
    const asset = await generateVoiceoverAsset(input.text, input.voice);
    let clipId: string | undefined;
    if (input.startSec !== undefined) {
      clipId = edit(ctx, "Add voiceover", (d) => {
        const clip = specToClip(
          d,
          { type: "audio", assetId: asset.id, startSec: input.startSec ?? 0, durationSec: asset.durationSec ?? 5, role: "voice" },
          { createdBy: ctx.agent.kind, agent: ctx.agent.name, turnId: ctx.agent.turnId },
        );
        return insertClip(d, clip, "auto-track", { actor: ctx.actor });
      });
    }
    return { assetId: asset.id, durationSec: asset.durationSec, clipId };
  },

  set_brand: (input, ctx) => {
    edit(ctx, "Set brand kit", (d) => {
      const prev = d.brand;
      d.brand = {
        name: input.name ?? prev?.name,
        colors: input.colors ?? prev?.colors ?? { primary: "#7C3AED", background: "#0B0B0F", text: "#FFFFFF" },
        fonts: input.fonts ?? prev?.fonts ?? { heading: "Inter Tight", body: "Inter" },
        logoAssetId: input.logoAssetId ?? prev?.logoAssetId,
      };
    });
    return { ok: true };
  },
};

const KEYWORD_STOP = new Set([
  "the",
  "and",
  "that",
  "this",
  "with",
  "have",
  "from",
  "they",
  "what",
  "your",
  "about",
  "would",
  "there",
  "their",
  "which",
  "because",
  "really",
  "just",
  "like",
  "know",
]);
const isKeyword = (text: string) => {
  const w = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9$%']/g, "");
  if (!w || KEYWORD_STOP.has(w)) return false;
  return /\d/.test(w) || w.startsWith("$") || w.endsWith("%") || w.length >= 8;
};

/** Removes source-time ranges (ms) of a media clip from the timeline (ripple), right to left. */
const cutSourceRanges = (
  ctx: Ctx,
  clip: Extract<Clip, { type: "video" | "audio" }>,
  ranges: { startMs: number; endMs: number }[],
  kind: string,
) => {
  const f = fps();
  const toTimeline = (ms: number) => clip.start + ((ms / 1000) * f - clip.trimStart) / clip.speed;
  const end = getClipEnd(clip);
  const cuts = ranges
    .map((r) => ({ start: Math.round(toTimeline(r.startMs)), end: Math.round(toTimeline(r.endMs)) }))
    .filter((r) => r.end > r.start && r.end > clip.start && r.start < end)
    .map((r) => ({ start: Math.max(clip.start, r.start), end: Math.min(end, r.end) }))
    .sort((a, b) => b.start - a.start);
  if (cuts.length === 0) return { cuts: 0, removedSec: 0, message: `No ${kind}s found.` };
  const trackIds = [
    clip.trackId,
    ...Object.values(getProject().clips)
      .filter((c) => c.type === "captions" && c.sourceClipId === clip.id)
      .map((c) => c.trackId),
  ];
  edit(ctx, `Remove ${cuts.length} ${kind}${cuts.length > 1 ? "s" : ""}`, (d) => {
    for (const c of cuts) rippleDeleteRange(d, { start: c.start, end: c.end, trackIds: [...new Set(trackIds)] }, { actor: ctx.actor });
  });
  const removed = cuts.reduce((s, c) => s + (c.end - c.start), 0);
  return {
    cuts: cuts.length,
    removedSec: sec(removed),
    at: cuts
      .map((c) => sec(c.start))
      .reverse()
      .slice(0, 50),
  };
};

/** Executes a tool call coming from any agent; logs it to the activity feed. */
export const executeTool = async (name: string, input: unknown, agent: AgentIdentity): Promise<unknown> => {
  const exec = executors[name as ToolName] as Executor<ToolName> | undefined;
  const store = useAgentStore.getState();
  if (!exec) return { error: `Tool "${name}" is not available in this editor.` };
  const ctx: Ctx = { agent, actor: { kind: agent.kind, name: agent.name, turnId: agent.turnId } };
  if (store.status === "idle" || store.agentName !== agent.name) store.setStatus("working", null, agent.name);
  if (agent.external) store.heartbeat(agent.name);
  const label = describeToolCall(name, input);
  const isRead = name.startsWith("get_") || name.startsWith("list_") || name === "load_skill";
  if (!isRead) store.setStatus("working", label, agent.name);
  const startedAt = Date.now();
  try {
    const result = await exec(input as never, ctx);
    const failed = !!result && typeof result === "object" && "error" in (result as Record<string, unknown>);
    if (!isRead) {
      store.log({
        id: newId("turn"),
        label,
        tool: name,
        at: startedAt,
        clipIds: Object.keys(useAgentStore.getState().touched).filter((id) => (useAgentStore.getState().touched[id] ?? 0) >= startedAt),
        ok: !failed,
        error: failed ? String((result as { error: unknown }).error) : undefined,
        agent: agent.name,
      });
    }
    return result;
  } catch (err) {
    const e = errorResult(err);
    store.log({ id: newId("turn"), label, tool: name, at: startedAt, clipIds: [], ok: false, error: e.error, agent: agent.name });
    return e;
  }
};

export type ToolSchemas = typeof TOOL_SCHEMAS;
export type { z };
