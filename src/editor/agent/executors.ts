"use client";

import type { z } from "zod";
import { type EditToolName, editLabel, runEdit } from "@/agent/edits";
import { summarizeProject } from "@/agent/summary";
import type { TOOL_SCHEMAS, ToolInput, ToolName } from "@/agent/tool-schemas";
import { findFillerWords, findSpeechGaps } from "@/core/captions";
import { newId } from "@/core/ids";
import { lintProject, timelineMetrics } from "@/core/lint";
import { type Actor, addMarker, EditError, insertClip, removeClips, rippleDeleteRange, updateAsset, updateClip } from "@/core/ops";
import { getClipEnd } from "@/core/project-utils";
import type { CaptionWord, Clip, Project } from "@/core/schema";
import { getComponentErrors } from "@/remotion/code/runtime";
import { motionCatalogForAgents } from "@/remotion/components/registry";
import type { AgentIdentity } from "@/server/bridge";
import {
  detectBeatsForAsset,
  generateImageAsset,
  generateMusicAsset,
  generateVoiceoverAsset,
  importMediaUrl,
  lastVoiceoverFallback,
  searchAudioLibrary,
  searchStock,
  transcribeAsset,
} from "../media/ai";
import { profileFromUrl } from "../media/beats";
import { ensureDepthForAsset } from "../media/depth";
import { audioBufferToWav, decodeTrack, mapAnalysis, planFit, renderFit } from "../media/fit-music";
import { importFiles } from "../media/import";
import { useAgentStore } from "../store/agent-store";
import { seek, usePlaybackStore } from "../store/playback-store";
import { getProject, transact } from "../store/project-store";
import { useUIStore } from "../store/ui-store";
import { candidateSheet } from "./candidates";
import { specToClip } from "./convert";
import { critiqueVideo } from "./critique";
import { describeToolCall } from "./describe";
import { useInteractions } from "./interactions";
import { applyStepUpdate, stepsFromSetPlan } from "./plan";
import { captureFrames } from "./review";
import { viewMedia } from "./view-media";

type Ctx = { agent: AgentIdentity; actor: Actor };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Share of the fitted music spent in the track's quieter sections (energy under 0.5). */
const calmShare = (a: { sections: { start: number; end: number; energy: number }[] }, length: number) =>
  a.sections.filter((s) => s.energy < 0.5).reduce((n, s) => n + (s.end - s.start), 0) / Math.max(1, length);
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

/** Runs one of the shared timeline edits (src/agent/edits.ts, also used by the CLI) as a labelled transaction. */
const runShared = <K extends EditToolName>(name: K, input: ToolInput<K>, ctx: Ctx) =>
  edit(ctx, editLabel(name, input), (d) =>
    runEdit(d, name, input, {
      actor: ctx.actor,
      meta: { createdBy: ctx.agent.kind, agent: ctx.agent.name, turnId: ctx.agent.turnId },
    }),
  );

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
    useAgentStore.getState().setPlan(stepsFromSetPlan(input, fps()));
    useAgentStore.getState().setStatus("working", input.steps[0]?.title ?? null, ctx.agent.name);
    return { ok: true, steps: input.steps.length };
  },

  update_plan: (input, ctx) => {
    const plan = useAgentStore.getState().plan;
    const step = plan[input.index];
    if (!step) return { error: `No step ${input.index}; plan has ${plan.length} steps.` };
    // A plan carried over from an earlier turn is live again once the agent works on it.
    useAgentStore.getState().setPlan(applyStepUpdate(plan, input.index, input.status));
    if (input.status === "done") {
      const next = plan[input.index + 1];
      useAgentStore.getState().setStatus("working", next?.title ?? "Wrapping up", ctx.agent.name);
    }
    if (step.range) focusAgentAt(step.range[0]);
    const left = useAgentStore.getState().plan.filter((s) => s.status === "pending" || s.status === "running").length;
    return { ok: true, openSteps: left };
  },

  add_clips: (input, ctx) => runShared("add_clips", input, ctx),
  update_clips: (input, ctx) => runShared("update_clips", input, ctx),
  delete_clips: (input, ctx) => runShared("delete_clips", input, ctx),
  split_clip: (input, ctx) => runShared("split_clip", input, ctx),
  trim_clip: (input, ctx) => runShared("trim_clip", input, ctx),
  ripple_delete_range: (input, ctx) => runShared("ripple_delete_range", input, ctx),
  set_keyframes: (input, ctx) => runShared("set_keyframes", input, ctx),
  set_transition: (input, ctx) => runShared("set_transition", input, ctx),
  apply_style: (input, ctx) => runShared("apply_style", input, ctx),

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
    const result = runShared("create_component", input, ctx) as { ok: boolean; componentId?: string };
    if (!result.ok) return result;
    // Give the preview a moment to render it, then report runtime errors.
    await new Promise((r) => setTimeout(r, 700));
    const runtime = getComponentErrors().filter((e) => e.componentId === result.componentId);
    return { ...result, ok: runtime.length === 0, runtimeErrors: runtime.map((e) => e.message) };
  },

  update_component: async (input, ctx) => {
    const result = runShared("update_component", input, ctx) as { ok?: boolean; error?: string };
    if (result.error) return result;
    await new Promise((r) => setTimeout(r, 700));
    const id = `code:${input.componentId.replace(/^code:/, "")}`;
    const runtime = getComponentErrors().filter((e) => e.componentId === id);
    return { ok: runtime.length === 0, runtimeErrors: runtime.map((e) => e.message) };
  },

  get_errors: () => ({ errors: getComponentErrors() }),

  add_captions: async (input, ctx) => {
    const clip = getProject().clips[input.clipId];
    if (!clip || (clip.type !== "video" && clip.type !== "audio")) return { error: "add_captions needs a video or audio clip id." };
    useAgentStore.getState().setStatus("working", "Transcribing…", ctx.agent.name);
    const transcript = await transcribeAsset(clip.assetId);
    if (!transcript.words.length) return { error: "No speech found in this clip." };
    return runShared("add_captions", input, ctx);
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
    const { bpm, beats, downbeats, sections, hits, profile } = await detectBeatsForAsset(input.assetId);
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
    return {
      bpm,
      beats: beats.slice(0, 200).map(r2),
      totalBeats: beats.length,
      downbeats: downbeats.slice(0, 120).map(r2),
      sections,
      hits,
      profile,
      tips: "Times are seconds into the track. Cut on downbeats (bar starts); change scenes on section starts; land the main reveal on the first drop/high section and big impacts on hits; end on a downbeat near a section end or let the outro finish. Check the profile against the style before you commit: a bass-heavy track belongs to hype, sport and trailers, not under a voice, a calm explainer or a minimal product film; pick another then.",
    };
  },

  add_markers: (input, ctx) => runShared("add_markers", input, ctx),

  set_canvas: (input, ctx) => runShared("set_canvas", input, ctx),

  review_frames: async (input, ctx) => {
    useAgentStore.getState().setStatus("working", "Reviewing frames…", ctx.agent.name);
    const frames = await captureFrames(input.timesSec, input.count ?? 6);
    const lint = lintProject(getProject());
    const metrics = timelineMetrics(getProject());
    return {
      metrics,
      metricTargets:
        "Plain cuts ≥90% (nonCutShare ≤0.1), ≤2 transition types, medianOverMean 0.45–0.85, cv 0.5–1.2, longestEqualRun ≤4, sfxPerMin ≤8 (≤12 explainers), onBeatShare ≥0.5 for music-driven edits.",
      summary: lint.length
        ? `${lint.filter((l) => l.severity === "error").length} errors, ${lint.filter((l) => l.severity === "warning").length} warnings`
        : "No issues found by the linter.",
      lint,
      frames,
    };
  },

  critique_video: async (input, ctx) => {
    useAgentStore.getState().setStatus("working", "Getting a critique…", ctx.agent.name);
    return critiqueVideo({ brief: input.brief, targetDurationSec: input.targetDurationSec });
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
    const asset = await importMediaUrl(
      input.url,
      input.name,
      input.credit || input.license ? { attribution: input.credit, license: input.license } : undefined,
    );
    return { assetId: asset.id, type: asset.type, durationSec: asset.durationSec };
  },

  search_audio: async (input, ctx) => {
    useAgentStore.getState().setStatus("working", input.kind === "music" ? "Finding music…" : "Finding sounds…", ctx.agent.name);
    const { results } = await searchAudioLibrary({ ...input, limit: 8 });
    // Music: measure how the top candidates actually sound, a few at a time.
    const sound = new Map<string, string>();
    if (input.kind === "music") {
      const top = results.slice(0, 5);
      let next = 0;
      const worker = async () => {
        while (next < top.length) {
          const r = top[next++];
          const p = await profileFromUrl(r.url);
          if (p)
            sound.set(
              r.url,
              `about ${Math.round(p.bpm)} BPM; ${p.introSec >= 4 ? `quiet intro of ${p.introSec} s; ` : ""}${Math.round(p.bass * 100)}% low end; ${p.tags.join("; ") || "balanced"}`,
            );
        }
      };
      await Promise.all([worker(), worker(), worker()]);
    }
    return {
      results: results.map((r) => ({
        url: r.url,
        title: r.title,
        by: r.creator,
        source: r.source,
        durationSec: r.durationSec,
        bpm: r.bpm,
        genre: r.genre,
        about: r.description,
        tags: r.tags.slice(0, 8),
        ...(sound.has(r.url) ? { sound: sound.get(r.url) } : {}),
        license: r.license,
        credit: r.attribution,
      })),
      next:
        input.kind === "music"
          ? "Choose by style and by `sound` (measured from the audio: a bass-heavy track muddies a voice, a calm explainer or a minimal product film). import_media({ url, name: title, license, credit }) the best fit, then run detect_beats on it before cutting."
          : "import_media({ url, name: title, license, credit }) the best fit, then place it.",
    };
  },

  search_stock: async (input) => {
    const found = await searchStock(input.query, input.type ?? "video", input.orientation);
    // Number the candidates and show them, so pictures are chosen by what they show.
    const picked = found.results.slice(0, 16);
    const sheet = await candidateSheet(picked).catch(() => null);
    // The agent needs what to import and credit, not the preview links.
    const results = picked.map(({ preview: _p, previews: _ps, ...r }, i) => ({ n: i + 1, ...r }));
    return {
      ...found,
      results,
      ...(sheet ? { frames: [{ timeSec: 0, label: "candidates, numbered like results", dataUrl: sheet }] } : {}),
    };
  },

  fit_music: async (input, ctx) => {
    useAgentStore.getState().setStatus("working", "Fitting the music to the cut…", ctx.agent.name);
    const p = getProject();
    const f = p.settings.fps;
    const audio = Object.values(p.clips).filter((c): c is Extract<Clip, { type: "audio" }> => c.type === "audio");
    const clip = input.clipId
      ? audio.find((c) => c.id === input.clipId)
      : (audio.filter((c) => c.role === "music").sort((a, b) => b.duration - a.duration)[0] ??
        audio.filter((c) => c.role !== "voice").sort((a, b) => b.duration - a.duration)[0]);
    if (!clip) return { error: "fit_music needs the music clip (an audio clip on the timeline); pass clipId." };
    const asset = p.assets[clip.assetId];
    if (!asset) return { error: `The clip's audio asset ${clip.assetId} is missing.` };
    // By default the music ends with the picture.
    const pictureEnd = Math.max(
      0,
      ...Object.values(p.clips)
        .filter((c) => c.type !== "audio")
        .map(getClipEnd),
    );
    const endFrame = input.endSec !== undefined ? fr(input.endSec) : pictureEnd || getClipEnd(clip);
    const lengthSec = (endFrame - clip.start) / f;
    if (lengthSec < 2) return { error: `The music would only be ${lengthSec.toFixed(1)} s long: check endSec and where the clip starts.` };
    const analysis = await detectBeatsForAsset(asset.id);
    const { full, mono } = await decodeTrack(asset.src);
    const plan = planFit(mono, analysis, { lengthSec, startAt: input.startAtSec ?? clip.trimStart / f, ending: input.ending ?? "auto" });
    const rendered = await renderFit(full, plan);
    const base = asset.name.replace(/\.[^.]+$/, "").replace(/ \(fit [\d.]+s\)$/, "");
    const file = new File([audioBufferToWav(rendered)], `${base} (fit ${lengthSec.toFixed(1)}s).wav`, { type: "audio/wav" });
    const [fitted] = await importFiles([file]);
    if (!fitted) return { error: "Couldn't import the fitted music." };
    const mapped = mapAnalysis(plan, analysis);
    transact(
      "Tag fitted music",
      (d) =>
        updateAsset(d, fitted.id, {
          source: asset.source,
          origin: { ...asset.origin, prompt: `${asset.name}, fitted to ${lengthSec.toFixed(1)} s` },
          analysis: { ...mapped },
        }),
      { silent: true },
    );
    // Other pieces of the same track inside the range were a hand-made splice: the fitted music replaces them.
    const pieces = audio.filter((c) => c.id !== clip.id && c.assetId === clip.assetId && c.start < endFrame && getClipEnd(c) > clip.start);
    edit(ctx, "Fit the music", (d) => {
      if (pieces.length)
        removeClips(
          d,
          pieces.map((c) => c.id),
          { actor: ctx.actor },
        );
      updateClip(
        d,
        clip.id,
        { assetId: fitted.id, trimStart: 0, duration: endFrame - clip.start, fadeIn: null, fadeOut: null, speed: 1 },
        { actor: ctx.actor },
      );
    });
    const at = (t: number) => r2(sec(clip.start) + t);
    const e = plan.edits[0];
    return {
      clipId: clip.id,
      assetId: fitted.id,
      lengthSec: r2(lengthSec),
      startsAt: `${r2(plan.startAt)} s into the track`,
      ...(e
        ? {
            edit: `${e.kind === "cut" ? "Removed" : "Repeated"} ${r2(Math.abs(e.toSec - e.fromSec))} s of whole bars at ${at(e.atSec)} s on the timeline (track ${r2(Math.min(e.fromSec, e.toSec))}–${r2(Math.max(e.fromSec, e.toSec))} s), matched ${e.match} (1 = seamless)${e.match < 0.75 ? ": a rough join; pick another track or another startAtSec if it stands out" : ""}.`,
          }
        : { edit: "None needed: the track runs as written." }),
      ending:
        plan.ending === "fade"
          ? `Fades out from the bar line at ${at(plan.finalHitSec)} s to silence at the end${input.ending === "fade" ? "" : " (no clean edit reaches the track's own ending at this length)"}.`
          : `The track's last hit lands at ${at(plan.finalHitSec)} s and rings out for ${r2(plan.tailSec)} s${plan.fadeOutSec ? ` (faded over the last ${r2(plan.fadeOutSec)} s)` : ""}.`,
      ...(calmShare(mapped, lengthSec) > 0.45
        ? {
            energy: `Most of the fitted music is a calmer part of the track (${Math.round(calmShare(mapped, lengthSec) * 100)}%). If the film needs drive, call fit_music again with ending "fade" (keeps the energetic body) or a later startAtSec.`,
          }
        : {}),
      ...(pieces.length ? { removed: pieces.map((c) => c.id) } : {}),
      downbeats: mapped.downbeats.slice(0, 80).map((t) => at(t)),
      sections: mapped.sections.map((s) => ({ ...s, start: at(s.start), end: at(s.end) })),
      hits: mapped.hits.map((t) => at(t)),
      tip: "Times are on the timeline. Cut scene changes on these downbeats and section starts, and land the final card on the last hit; don't trim or fade this clip by hand (call fit_music again if the length changes).",
    };
  },

  view_media: async (input, ctx) => {
    useAgentStore.getState().setStatus("working", "Looking through the footage…", ctx.agent.name);
    const { durationSec, times, dataUrl } = await viewMedia(input.assetId, input.fromSec, input.toSec, input.count ?? 12);
    return {
      durationSec,
      times,
      frames: [{ timeSec: times[0] ?? 0, label: "frames numbered with their time in the source", dataUrl }],
    };
  },

  animate_photos: async (input, ctx) => {
    const p = getProject();
    const clips = input.clipIds.map((id) => p.clips[id]).filter((c): c is Extract<Clip, { type: "image" }> => c?.type === "image");
    if (!clips.length) return { error: "animate_photos needs the ids of image clips (photos on the timeline)." };
    const status = (text: string) => useAgentStore.getState().setStatus("working", text, ctx.agent.name);
    const animated: string[] = [];
    const failed: { clipId: string; error: string }[] = [];
    for (const clip of clips) {
      try {
        await ensureDepthForAsset(clip.assetId, status);
        animated.push(clip.id);
      } catch (err) {
        failed.push({ clipId: clip.id, error: err instanceof Error ? err.message : String(err) });
      }
    }
    // The move includes its own push: a zoom keyframed on top doubles it and tears the depth edges.
    let unzoomed = 0;
    if (animated.length)
      edit(ctx, `Animate ${animated.length} photo${animated.length > 1 ? "s" : ""}`, (d) => {
        for (const id of animated) {
          const clip = d.clips[id];
          let keyframes = clip?.keyframes;
          if (keyframes?.scale) {
            const { scale: _, ...rest } = keyframes;
            keyframes = rest;
            unzoomed++;
          }
          updateClip(
            d,
            id,
            {
              parallax: { move: input.move ?? "push", amount: input.amount ?? 0.5 },
              keyframes: keyframes && Object.keys(keyframes).length ? keyframes : null,
            },
            { actor: ctx.actor },
          );
        }
      });
    return {
      animated,
      ...(unzoomed ? { note: `Removed the scale keyframes on ${unzoomed} of them: the move pushes in by itself.` } : {}),
      ...(failed.length ? { failed } : {}),
    };
  },

  generate_image: async (input, ctx) => {
    useAgentStore.getState().setStatus("working", "Generating image…", ctx.agent.name);
    const asset = await generateImageAsset(input.prompt, input.aspect ?? "16:9");
    return { assetId: asset.id, width: asset.width, height: asset.height };
  },

  generate_music: async (input, ctx) => {
    useAgentStore.getState().setStatus("working", "Composing music…", ctx.agent.name);
    const asset = await generateMusicAsset({
      styles: input.styles,
      avoid: input.avoid,
      sections: input.sections,
      durationSec: input.durationSec,
      instrumental: input.instrumental,
    });
    const { bpm, downbeats, sections, hits } = await detectBeatsForAsset(asset.id);
    let clipId: string | undefined;
    if (input.startSec !== undefined) {
      clipId = edit(ctx, "Add music", (d) => {
        const clip = specToClip(
          d,
          { type: "audio", assetId: asset.id, startSec: input.startSec ?? 0, durationSec: asset.durationSec ?? 30, role: "music" },
          { createdBy: ctx.agent.kind, agent: ctx.agent.name, turnId: ctx.agent.turnId },
        );
        return insertClip(d, clip, "auto-track", { actor: ctx.actor });
      });
    }
    return {
      assetId: asset.id,
      durationSec: asset.durationSec,
      clipId,
      bpm,
      downbeats: downbeats.slice(0, 80).map(r2),
      sections,
      hits: hits.slice(0, 20).map(r2),
      tips: "Times are seconds into the track. Cut on downbeats, change scenes on section starts; the track already ends where you asked.",
    };
  },

  generate_voiceover: async (input, ctx) => {
    useAgentStore.getState().setStatus("working", "Recording voiceover…", ctx.agent.name);
    const asset = await generateVoiceoverAsset(input.text, input.voice, (text) =>
      useAgentStore.getState().setStatus("working", text, ctx.agent.name),
    );
    const fallback = lastVoiceoverFallback;
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
    // When each sentence is spoken, so the picture can be timed to the voice.
    const sentences: { text: string; startSec: number; endSec: number }[] = [];
    let words: CaptionWord[] = [];
    for (const w of asset.transcript?.words ?? []) {
      words.push(w);
      if (!/[.!?…:;]["')\]]?$/.test(w.text.trim())) continue;
      sentences.push({
        text: words
          .map((x) => x.text)
          .join("")
          .trim(),
        startSec: Math.round(words[0].startMs / 10) / 100,
        endSec: Math.round(w.endMs / 10) / 100,
      });
      words = [];
    }
    if (words.length)
      sentences.push({
        text: words
          .map((x) => x.text)
          .join("")
          .trim(),
        startSec: Math.round(words[0].startMs / 10) / 100,
        endSec: Math.round(words[words.length - 1].endMs / 10) / 100,
      });
    return {
      assetId: asset.id,
      durationSec: asset.durationSec,
      clipId,
      ...(sentences.length ? { sentences } : {}),
      ...(fallback
        ? {
            voice: asset.origin?.model,
            note: `The cloud voice failed (${fallback}), so the free local voice (Kokoro, English) spoke it. Tell the user once: a speech key with credits gives a more natural, expressive read.`,
          }
        : {}),
    };
  },

  set_brand: (input, ctx) => runShared("set_brand", input, ctx),
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

// Dev only: run any tool from the console or a test driver, as a test agent.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  Object.assign(window, {
    __reframerTool: (name: string, input: unknown) => executeTool(name, input, { name: "test", kind: "agent", turnId: "test" }),
  });
}
