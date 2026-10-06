"use client";

import { toast } from "sonner";
import { getCaptionPreset, scaledCaptionStyle } from "@/core/caption-presets";
import { createAudioClip, createCaptionsClip } from "@/core/defaults";
import { addMarker, addTrack, insertClip, USER, updateClip } from "@/core/ops";
import type { Asset, Clip, Project } from "@/core/schema";
import { getSfx } from "@/core/sfx";
import { applyStyleDNA, getStylePreset, type StyleDNA } from "@/core/styles";
import type { StylePart } from "@/core/styles/apply";
import { run } from "./actions";
import { detectBeatsForAsset, generateVoiceoverAsset, transcribeAsset } from "./media/ai";
import { usePlaybackStore } from "./store/playback-store";
import { getProject } from "./store/project-store";
import { useUIStore } from "./store/ui-store";

/** Actions behind the Styles, Captions and Audio library tabs (all undoable, attributed to you). */

const frameNow = () => usePlaybackStore.getState().frame;

const audioTrack = (d: Project, preferRole?: "sfx") => {
  const tracks = d.tracks.filter((t) => t.kind === "audio" && !t.locked);
  // Keep SFX off the music/voice track when there's a second audio track.
  if (preferRole === "sfx" && tracks.length > 1) return tracks[tracks.length - 1].id;
  return tracks[0]?.id ?? addTrack(d, { kind: "audio" });
};

/** Inserts a built-in sound effect inside an edit (returns the new clip id). */
export const insertBuiltinSfx = (d: Project, id: string, start: number, volume = 0.8) => {
  const sfx = getSfx(id);
  if (!sfx) return undefined;
  const assetId = `asset_sfx_${sfx.id.replace(/[^a-z0-9]/g, "")}`;
  d.assets[assetId] ??= {
    id: assetId,
    type: "audio",
    name: sfx.name,
    src: sfx.src,
    mimeType: "audio/wav",
    durationSec: sfx.durationSec,
    source: "builtin",
    createdAt: Date.now(),
  };
  const clip = createAudioClip(d.settings, d.assets[assetId], {
    trackId: audioTrack(d, "sfx"),
    start,
    role: "sfx",
    volume,
    name: sfx.name,
  });
  return insertClip(d, clip, "auto-track", { actor: USER });
};

/** Adds a built-in sound effect at the playhead. */
export const addSfx = (id: string, at?: number) => {
  const sfx = getSfx(id);
  if (!sfx) return;
  const clipId = run(`Add ${sfx.name}`, (d) => insertBuiltinSfx(d, id, at ?? frameNow()));
  if (clipId) useUIStore.getState().select([clipId]);
};

/** Adds an imported sound (e.g. a recorded effect from the audio library) on the SFX track at the playhead. */
export const addSoundAsset = (asset: Asset, at?: number) => {
  const clipId = run(`Add ${asset.name}`, (d) => {
    const clip = createAudioClip(d.settings, asset, {
      trackId: audioTrack(d, "sfx"),
      start: at ?? frameNow(),
      role: "sfx",
      volume: 0.8,
      name: asset.name,
    });
    return insertClip(d, clip, "auto-track", { actor: USER });
  });
  if (clipId) useUIStore.getState().select([clipId]);
};

/** Applies a style's look (grade, type, captions, motion, transitions) to the whole video or the selection. */
export const applyStyleLook = (dna: StyleDNA, parts?: StylePart[]) => {
  const selection = useUIStore.getState().selectedClipIds;
  const result = run(`Apply ${dna.name} style`, (d) =>
    applyStyleDNA(d, dna, { parts, clipIds: selection.length ? selection : undefined, actor: USER }),
  );
  if (!result) return;
  const changed = Object.values(result.changed).reduce((a, b) => a + b, 0);
  if (changed === 0) toast.info(`Nothing to restyle yet. Add text, captions or footage, then apply ${dna.name} again.`);
  else toast.success(`${dna.name} applied: ${changed} change${changed === 1 ? "" : "s"}${selection.length ? " to the selection" : ""}.`);
};

export const applyStyleById = (id: string, parts?: StylePart[]) => {
  const dna = getStylePreset(id);
  if (dna) applyStyleLook(dna, parts);
};

/** The clip whose speech captions should follow: the selection, else the longest video, else voice audio. */
const speechSource = (p: Project): Extract<Clip, { assetId: string }> | undefined => {
  const media = Object.values(p.clips).filter(
    (c): c is Extract<Clip, { type: "video" | "audio" }> => c.type === "video" || c.type === "audio",
  );
  const selected = media.find((c) => useUIStore.getState().selectedClipIds.includes(c.id));
  if (selected) return selected;
  const videos = media.filter((c) => c.type === "video" && p.assets[c.assetId]?.hasAudio !== false).sort((a, b) => b.duration - a.duration);
  return videos[0] ?? media.find((c) => c.type === "audio" && c.role !== "sfx" && c.role !== "music");
};

/** Restyles existing captions with a preset, or transcribes the main speech clip and adds captions. */
export const applyCaptionPreset = async (presetId: string) => {
  const preset = getCaptionPreset(presetId);
  if (!preset) return;
  const p = getProject();
  const existing = Object.values(p.clips).filter((c) => c.type === "captions");
  if (existing.length) {
    const selected = existing.filter((c) => useUIStore.getState().selectedClipIds.includes(c.id));
    const targets = selected.length ? selected : existing;
    run(`Captions: ${preset.name}`, (d) => {
      for (const c of targets)
        updateClip(d, c.id, { style: { ...scaledCaptionStyle(preset, d.settings), preset: preset.id } }, { actor: USER });
    });
    return;
  }
  const source = speechSource(p);
  if (!source) {
    toast.info("Add a video or voice clip first. Captions follow its speech.");
    return;
  }
  const toastId = toast.loading("Transcribing speech…");
  try {
    const transcript = await transcribeAsset(source.assetId);
    if (!transcript.words.length) {
      toast.error("No speech found in that clip.", { id: toastId });
      return;
    }
    const id = run("Add captions", (d) => {
      const clip = createCaptionsClip(d.settings, {
        trackId: d.tracks.find((t) => t.kind === "visual" && !t.locked)?.id ?? d.tracks[0].id,
        start: source.start,
        duration: source.duration,
        words: transcript.words,
        timeBase: "source",
        sourceClipId: source.id,
        style: { ...scaledCaptionStyle(preset, d.settings), preset: preset.id },
      });
      return insertClip(d, clip, "auto-track", { actor: USER });
    });
    if (id) useUIStore.getState().select([id]);
    toast.success(`Captions added: ${transcript.words.length} words`, { id: toastId });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err), { id: toastId });
  }
};

/** Generates a voiceover with the user's TTS key and drops it at the playhead. */
export const addVoiceover = async (text: string, voice?: string) => {
  const toastId = toast.loading("Recording voiceover…");
  try {
    const asset = await generateVoiceoverAsset(text, voice);
    const id = run("Add voiceover", (d) => {
      const clip = createAudioClip(d.settings, asset, { trackId: audioTrack(d), start: frameNow(), role: "voice", name: "Voiceover" });
      return insertClip(d, clip, "auto-track", { actor: USER });
    });
    if (id) useUIStore.getState().select([id]);
    toast.success("Voiceover added", { id: toastId });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err), { id: toastId });
  }
};

/** Finds the beat in the selected (or first) music clip and drops beat markers on the ruler. */
export const markBeats = async () => {
  const p = getProject();
  const audio = Object.values(p.clips).filter((c): c is Extract<Clip, { type: "audio" }> => c.type === "audio");
  const selected = audio.find((c) => useUIStore.getState().selectedClipIds.includes(c.id));
  const clip = selected ?? audio.find((c) => c.role === "music") ?? audio.find((c) => c.role !== "sfx");
  if (!clip) {
    toast.info("Add a music track first, then mark its beats.");
    return;
  }
  const toastId = toast.loading("Listening for the beat…");
  try {
    const { bpm, beats } = await detectBeatsForAsset(clip.assetId);
    const fps = p.settings.fps;
    const end = clip.start + clip.duration;
    const frames = beats
      .map((t) => clip.start + Math.round((t * fps - clip.trimStart) / clip.speed))
      .filter((f) => f >= clip.start && f < end);
    run(`Mark ${frames.length} beats`, (d) => {
      d.markers = d.markers.filter((m) => m.kind !== "beat");
      for (const frame of frames) addMarker(d, { frame, label: "Beat", kind: "beat" });
    });
    toast.success(`${Math.round(bpm)} BPM · ${frames.length} beats marked`, { id: toastId });
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err), { id: toastId });
  }
};
