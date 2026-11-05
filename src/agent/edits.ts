import type { ToolInput } from "@/agent/tool-schemas";
import { getCaptionPreset, scaledCaptionStyle } from "@/core/caption-presets";
import { ASPECT_PRESETS, createCaptionsClip } from "@/core/defaults";
import { newId } from "@/core/ids";
import {
  type Actor,
  addMarker,
  addTrack,
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
import type { CaptionWord, Clip, Project } from "@/core/schema";
import { applyStyleDNA, getArchetypeBase, getStylePreset, type StyleDNA, StyleDNASchema } from "@/core/styles";
import { pairedSfxStart } from "@/core/transition-sfx";
import { specPatchToClipPatch, specToClip } from "@/editor/agent/convert";
import { describeToolCall } from "@/editor/agent/describe";
import { compileCodeComponent } from "@/remotion/code/runtime";

/**
 * The timeline edits behind the agent tools, as pure recipes on a project draft. The editor runs them
 * inside its undoable transactions (with live presence); the CLI runs the very same recipes on a
 * project file with immer. One implementation, so a tool behaves the same live and headless.
 *
 * A recipe throws an EditError when an edit can't be made (a missing clip, an occupied range, a locked
 * track). A result carrying `error` reports a request the recipe refused before changing anything.
 */

export type EditContext = {
  actor: Actor;
  /** Stamped on created clips: who made them and in which turn. */
  meta: NonNullable<Clip["meta"]>;
};

export const EDIT_TOOL_NAMES = [
  "add_clips",
  "update_clips",
  "delete_clips",
  "split_clip",
  "trim_clip",
  "ripple_delete_range",
  "set_keyframes",
  "set_transition",
  "apply_style",
  "add_markers",
  "set_canvas",
  "set_brand",
  "create_component",
  "update_component",
  "add_captions",
] as const;

export type EditToolName = (typeof EDIT_TOOL_NAMES)[number];

export const isEditTool = (name: string): name is EditToolName => (EDIT_TOOL_NAMES as readonly string[]).includes(name);

type Recipe<K extends EditToolName> = {
  /** Undo-history label. */
  label: (input: ToolInput<K>) => string;
  run: (draft: Project, input: ToolInput<K>, ctx: EditContext) => unknown;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const fr = (d: Project, sec: number) => Math.max(0, Math.round(sec * d.settings.fps));
const sec = (d: Project, frames: number) => r2(frames / d.settings.fps);
const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

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

/** A word as typed or spoken, without case or punctuation (any script). */
export const keywordKey = (text: string) =>
  text
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}$%']/gu, "");

const isKeyword = (text: string) => {
  const w = keywordKey(text);
  if (!w || KEYWORD_STOP.has(w)) return false;
  return /\d/.test(w) || w.startsWith("$") || w.endsWith("%") || w.length >= 8;
};

/**
 * Caption words with their emphasis: the words the caller named, else the guessed key words, and never
 * more than one per sentence (color everywhere is emphasis nowhere).
 */
export const emphasizeWords = (words: CaptionWord[], emphasize?: string[], guess?: boolean): CaptionWord[] => {
  const named = new Set((emphasize ?? []).map(keywordKey).filter(Boolean));
  let usedInSentence = false;
  return words.map((w) => {
    const wanted = named.size ? named.has(keywordKey(w.text)) : Boolean(guess && isKeyword(w.text));
    const emphasis = wanted && !usedInSentence ? true : undefined;
    if (emphasis) usedInSentence = true;
    if (/[.!?…]["')\]]?$/.test(w.text.trim())) usedInSentence = false;
    return { ...w, emphasis };
  });
};

/** A style preset by id, or a custom style merged onto its archetype; `error` when it doesn't hold. */
export const resolveStyle = (input: ToolInput<"apply_style">): { style: StyleDNA } | { error: string } => {
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
    return { style: parsed.data };
  }
  const style = input.styleId ? getStylePreset(input.styleId) : undefined;
  return style ? { style } : { error: `Unknown style "${input.styleId}". Use list_styles.` };
};

export const EDITS: { [K in EditToolName]: Recipe<K> } = {
  add_clips: {
    label: (input) =>
      input.clips.length === 1 ? describeToolCall("add_clips", input).replace(/^Added /, "Add ") : `Add ${input.clips.length} clips`,
    run: (d, input, ctx) => ({
      created: input.clips.map((spec) => {
        const clip = specToClip(d, spec, ctx.meta);
        const id = insertClip(d, clip, "auto-track", { actor: ctx.actor });
        return { id, type: clip.type, trackId: d.clips[id]?.trackId, startSec: sec(d, clip.start), endSec: sec(d, getClipEnd(clip)) };
      }),
    }),
  },

  update_clips: {
    label: (input) => (input.updates.length === 1 ? "Edit clip" : `Edit ${input.updates.length} clips`),
    run: (d, input, ctx) => {
      const results: { id: string; ok: boolean; error?: string }[] = [];
      for (const { id, patch } of input.updates) {
        try {
          const clip = d.clips[id];
          if (!clip) throw new Error(`Clip "${id}" not found`);
          const opts = { actor: ctx.actor, force: input.force };
          if (patch.trackId || patch.startSec !== undefined) {
            moveClip(
              d,
              id,
              { start: patch.startSec !== undefined ? fr(d, patch.startSec) : undefined, trackId: patch.trackId },
              "auto-track",
              opts,
            );
          }
          if (patch.durationSec !== undefined) {
            const c = d.clips[id];
            trimClip(d, id, { end: c.start + Math.max(1, fr(d, patch.durationSec)) }, opts);
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
          results.push({ id, ok: false, error: messageOf(err) });
        }
      }
      return { results };
    },
  },

  delete_clips: {
    label: (input) => `Delete ${input.ids.length} clip${input.ids.length > 1 ? "s" : ""}`,
    run: (d, input, ctx) => {
      removeClips(d, input.ids, { actor: ctx.actor, ripple: input.ripple });
      return { deleted: input.ids };
    },
  },

  split_clip: {
    label: () => "Split clip",
    run: (d, input, ctx) => {
      const ids = splitClip(d, input.id, fr(d, input.atSec), { actor: ctx.actor });
      return { left: ids[0], right: ids[1] };
    },
  },

  trim_clip: {
    label: () => "Trim clip",
    run: (d, input, ctx) => {
      trimClip(
        d,
        input.id,
        {
          start: input.startSec !== undefined ? fr(d, input.startSec) : undefined,
          end: input.endSec !== undefined ? fr(d, input.endSec) : undefined,
        },
        { actor: ctx.actor },
      );
      const c = d.clips[input.id];
      return c ? { id: c.id, startSec: sec(d, c.start), endSec: sec(d, getClipEnd(c)) } : { ok: true };
    },
  },

  ripple_delete_range: {
    label: (input) => `Cut ${r2(input.endSec - input.startSec)}s`,
    run: (d, input, ctx) => {
      rippleDeleteRange(d, { start: fr(d, input.startSec), end: fr(d, input.endSec), trackIds: input.trackIds }, { actor: ctx.actor });
      return { ok: true, removedSec: r2(input.endSec - input.startSec) };
    },
  },

  set_keyframes: {
    label: (input) => `Animate ${input.property}`,
    run: (d, input, ctx) => {
      setKeyframes(
        d,
        input.id,
        input.property,
        input.keyframes.map((k) => ({ frame: fr(d, k.timeSec), value: k.value, easing: k.easing })),
        { actor: ctx.actor },
      );
      return { ok: true, keyframes: input.keyframes.length };
    },
  },

  set_transition: {
    label: (input) => (input.transition ? `Add ${input.transition.type} transition` : "Remove transition"),
    run: (d, input, ctx) => {
      const duration = input.transition ? Math.max(1, fr(d, input.transition.durationSec)) : 0;
      setTransition(
        d,
        input.id,
        input.transition
          ? { type: input.transition.type, duration, direction: input.transition.direction, easing: input.transition.easing }
          : null,
        { actor: ctx.actor },
      );
      const clip = d.clips[input.id];
      const pair =
        input.withSound && input.transition && clip ? pairedSfxStart(input.transition.type, clip.start, duration, d.settings.fps) : null;
      if (!pair) return { ok: true };
      const sfxClip = specToClip(d, { type: "sfx", sound: pair.sfx, volume: pair.volume, startSec: pair.start / d.settings.fps }, ctx.meta);
      insertClip(d, sfxClip, "auto-track", { actor: ctx.actor });
      return { ok: true, sound: { sfx: pair.sfx, atSec: r2(pair.start / d.settings.fps) } };
    },
  },

  apply_style: {
    label: (input) => {
      const resolved = resolveStyle(input);
      return "style" in resolved ? `Apply ${resolved.style.name} style` : "Apply style";
    },
    run: (d, input, ctx) => {
      const resolved = resolveStyle(input);
      if ("error" in resolved) return resolved;
      return applyStyleDNA(d, resolved.style, { parts: input.parts, clipIds: input.clipIds, actor: ctx.actor });
    },
  },

  add_markers: {
    label: (input) => `Add ${input.markers.length} marker${input.markers.length > 1 ? "s" : ""}`,
    run: (d, input) => {
      for (const m of input.markers) addMarker(d, { frame: fr(d, m.timeSec), label: m.label, kind: m.kind ?? "note" });
      return { ok: true };
    },
  },

  set_canvas: {
    label: (input) => (input.aspect ? `Switch to ${input.aspect}` : "Change canvas"),
    run: (d, input) => {
      const preset = input.aspect ? ASPECT_PRESETS[input.aspect] : undefined;
      updateSettings(d, {
        ...(preset ? { width: preset.width, height: preset.height } : {}),
        ...(input.width ? { width: Math.round(input.width) } : {}),
        ...(input.height ? { height: Math.round(input.height) } : {}),
        ...(input.fps ? { fps: Math.round(input.fps) } : {}),
        ...(input.backgroundColor ? { backgroundColor: input.backgroundColor } : {}),
      });
      return { width: d.settings.width, height: d.settings.height, fps: d.settings.fps };
    },
  },

  set_brand: {
    label: () => "Set brand kit",
    run: (d, input) => {
      const prev = d.brand;
      d.brand = {
        name: input.name ?? prev?.name,
        colors: input.colors ?? prev?.colors ?? { primary: "#7C3AED", background: "#0B0B0F", text: "#FFFFFF" },
        fonts: input.fonts ?? prev?.fonts ?? { heading: "Inter Tight", body: "Inter" },
        logoAssetId: input.logoAssetId ?? prev?.logoAssetId,
      };
      return { ok: true };
    },
  },

  create_component: {
    label: (input) => `Create component ${input.name}`,
    run: (d, input, ctx) => {
      const compiled = compileCodeComponent(input.source);
      if (!compiled.ok) return { ok: false, error: compiled.error, hint: "Fix the code and call create_component again." };
      const id = newId("comp");
      upsertComponent(d, {
        id,
        name: input.name,
        description: input.description,
        source: input.source,
        propsSchema: input.propsSchema as Project["components"][string]["propsSchema"],
        createdBy: ctx.actor.kind === "agent" ? "agent" : "ai",
        updatedAt: Date.now(),
      });
      if (!input.place) return { ok: true, componentId: `code:${id}` };
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
        ctx.meta,
      );
      return { ok: true, componentId: `code:${id}`, clipId: insertClip(d, clip, "auto-track", { actor: ctx.actor }) };
    },
  },

  update_component: {
    label: (input) => `Update component ${input.componentId.replace(/^code:/, "")}`,
    run: (d, input) => {
      const id = input.componentId.replace(/^code:/, "");
      const existing = d.components[id];
      if (!existing) return { error: `Component ${input.componentId} not found` };
      let source = input.source;
      if (input.edits?.length) {
        if (input.source) return { error: "Send either `source` (a rewrite) or `edits` (changes to the current source), not both." };
        source = existing.source ?? "";
        for (const [i, e] of input.edits.entries()) {
          const count = source.split(e.find).length - 1;
          if (count === 0)
            return {
              error: `Edit ${i + 1}: its \`find\` text is not in the current source (nothing was changed). Copy it exactly, or send the whole source.`,
            };
          if (count > 1 && !e.all)
            return {
              error: `Edit ${i + 1}: its \`find\` text occurs ${count} times (nothing was changed). Add surrounding lines so it occurs once, or set all: true.`,
            };
          source = e.all ? source.split(e.find).join(e.replace) : source.replace(e.find, () => e.replace);
        }
      }
      if (source) {
        const compiled = compileCodeComponent(source);
        if (!compiled.ok) return { ok: false, error: compiled.error };
      }
      upsertComponent(d, {
        ...existing,
        source: source ?? existing.source,
        propsSchema: (input.propsSchema as typeof existing.propsSchema) ?? existing.propsSchema,
        updatedAt: Date.now(),
      });
      return { ok: true };
    },
  },

  add_captions: {
    label: () => "Add captions",
    run: (d, input, ctx) => {
      const clip = d.clips[input.clipId];
      if (!clip || (clip.type !== "video" && clip.type !== "audio")) return { error: "add_captions needs a video or audio clip id." };
      const transcript = d.assets[clip.assetId]?.transcript;
      if (!transcript?.words.length)
        throw new EditError("INVALID", "This clip's media has no transcript yet: transcribe it first (in the editor, or --live).");
      const words = emphasizeWords(transcript.words, input.emphasize, input.emphasizeKeywords);
      const preset = getCaptionPreset(input.preset ?? "bold-pop") ?? getCaptionPreset("bold-pop");
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
        meta: ctx.meta,
      });
      if (yPct !== undefined) captions.transform.y = Math.round(yPct * d.settings.height);
      // Captions sit above everything: the top visual track when it's free there, else a new track on top
      // (auto placement could drop them under the footage, where they're invisible).
      const top = d.tracks.find((t) => t.kind === "visual");
      const end = captions.start + captions.duration;
      const topFree =
        top &&
        !top.locked &&
        !Object.values(d.clips).some((c) => c.trackId === top.id && c.start < end && c.start + c.duration > captions.start);
      captions.trackId = topFree ? top.id : addTrack(d, { kind: "visual", name: "Captions", index: 0 });
      return { clipId: insertClip(d, captions, "exact", { actor: ctx.actor }), words: words.length };
    },
  },
};

/** Runs one edit recipe by name (the input already validated against its tool schema). */
export const runEdit = (draft: Project, name: EditToolName, input: unknown, ctx: EditContext): unknown =>
  (EDITS[name] as Recipe<EditToolName>).run(draft, input as never, ctx);

export const editLabel = (name: EditToolName, input: unknown): string => (EDITS[name] as Recipe<EditToolName>).label(input as never);
