import { transcriptText } from "../core/captions";
import { describeAspect, getClipEnd, getProjectDuration } from "../core/project-utils";
import type { Clip, Project } from "../core/schema";

/**
 * Compact, token-efficient view of a project for agents. Times are seconds
 * (2 decimals), positions px. Defaults are omitted to keep it short.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

const clipSummary = (clip: Clip, project: Project) => {
  const fps = project.settings.fps;
  const { width: W, height: H } = project.settings;
  const t = clip.transform;
  const out: Record<string, unknown> = {
    id: clip.id,
    type: clip.type,
    start: r2(clip.start / fps),
    end: r2(getClipEnd(clip) / fps),
  };
  if (clip.name) out.name = clip.name;
  const fullFrame = Math.abs(t.width - W) < 2 && Math.abs(t.height - H) < 2 && Math.abs(t.x - W / 2) < 2 && Math.abs(t.y - H / 2) < 2;
  if (!fullFrame && clip.type !== "audio") out.box = [Math.round(t.x), Math.round(t.y), Math.round(t.width), Math.round(t.height)];
  if (t.scale !== 1) out.scale = r2(t.scale);
  if (t.rotation) out.rotation = r2(t.rotation);
  if (t.opacity !== 1) out.opacity = r2(t.opacity);

  switch (clip.type) {
    case "video": {
      const a = project.assets[clip.assetId];
      out.asset = clip.assetId;
      if (a) out.source = a.name;
      if (clip.trimStart) out.trimStart = r2(clip.trimStart / fps);
      if (clip.speed !== 1) out.speed = clip.speed;
      if (clip.volume !== 1) out.volume = r2(clip.volume);
      if (clip.muted) out.muted = true;
      break;
    }
    case "audio": {
      out.asset = clip.assetId;
      const a = project.assets[clip.assetId];
      if (a) out.source = a.name;
      if (clip.role) out.role = clip.role;
      if (clip.volume !== 1) out.volume = r2(clip.volume);
      if (clip.trimStart) out.trimStart = r2(clip.trimStart / fps);
      break;
    }
    case "image":
      out.asset = clip.assetId;
      out.fit = clip.fit;
      break;
    case "text":
      out.text = clip.text.length > 90 ? `${clip.text.slice(0, 87)}…` : clip.text;
      out.font = `${clip.style.fontFamily} ${clip.style.fontWeight} ${Math.round(clip.style.fontSize)}px ${clip.style.color}`;
      if (clip.textAnimation && clip.textAnimation.type !== "none") out.textAnim = `${clip.textAnimation.type}/${clip.textAnimation.unit}`;
      break;
    case "shape":
      out.shape = clip.shape;
      if (clip.fill?.type === "solid") out.fill = clip.fill.color;
      break;
    case "background":
      out.fill = clip.fill.type === "solid" ? clip.fill.color : `${clip.fill.type}(${clip.fill.stops.map((s) => s.color).join(",")})`;
      break;
    case "captions":
      out.words = clip.words.length;
      out.captionStyle = clip.style.preset ?? clip.style.fontFamily;
      if (clip.sourceClipId) out.source = clip.sourceClipId;
      break;
    case "component": {
      out.component = clip.component;
      const props: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(clip.props)) {
        if (typeof v === "string") props[k] = v.length > 60 ? `${v.slice(0, 57)}…` : v;
        else if (typeof v === "number" || typeof v === "boolean") props[k] = v;
      }
      if (Object.keys(props).length) out.props = props;
      break;
    }
  }
  const anim: string[] = [];
  if (clip.animations?.in) anim.push(`in:${clip.animations.in.type}`);
  if (clip.animations?.out) anim.push(`out:${clip.animations.out.type}`);
  if (clip.animations?.loop) anim.push(`loop:${clip.animations.loop.type}`);
  if (anim.length) out.anim = anim.join(" ");
  if (clip.transitionIn) out.transitionIn = `${clip.transitionIn.type} ${r2(clip.transitionIn.duration / fps)}s`;
  if (clip.effects?.length) out.effects = clip.effects.map((e) => (e.type === "grade" && e.lut ? `grade(${e.lut})` : e.type)).join(",");
  if (clip.keyframes && Object.keys(clip.keyframes).length) out.keyframed = Object.keys(clip.keyframes).join(",");
  if (clip.locked) out.locked = true;
  if (clip.hidden) out.hidden = true;
  if (clip.meta?.humanEdited) out.humanEdited = true;
  if (clip.meta?.createdBy && clip.meta.createdBy !== "user") out.by = clip.meta.agent ?? clip.meta.createdBy;
  return out;
};

export type SummaryOptions = {
  rangeSec?: [number, number];
  includeTranscripts?: boolean;
  selection?: string[];
  playheadFrame?: number;
};

export const summarizeProject = (project: Project, opts: SummaryOptions = {}) => {
  const fps = project.settings.fps;
  const { width, height } = project.settings;
  const range = opts.rangeSec ? [opts.rangeSec[0] * fps, opts.rangeSec[1] * fps] : null;
  const tracks = project.tracks.map((track) => {
    const clips = Object.values(project.clips)
      .filter((c) => c.trackId === track.id)
      .filter((c) => !range || (c.start < range[1] && getClipEnd(c) > range[0]))
      .sort((a, b) => a.start - b.start)
      .map((c) => clipSummary(c, project));
    const t: Record<string, unknown> = { id: track.id, name: track.name, kind: track.kind, clips };
    if (track.locked) t.locked = true;
    if (track.hidden) t.hidden = true;
    if (track.muted) t.muted = true;
    return t;
  });
  const assets = Object.values(project.assets).map((a) => {
    const out: Record<string, unknown> = { id: a.id, type: a.type, name: a.name };
    if (a.durationSec) out.durationSec = r2(a.durationSec);
    if (a.width && a.height) out.size = `${a.width}x${a.height}`;
    if (a.hasAudio) out.hasAudio = true;
    if (a.transcript) {
      out.transcript = opts.includeTranscripts
        ? transcriptText(a.transcript.words)
        : `available (${a.transcript.words.length} words) — pass includeTranscripts to read`;
    }
    if (a.analysis?.bpm) out.bpm = a.analysis.bpm;
    if (a.source === "generated") out.generated = true;
    return out;
  });
  const summary: Record<string, unknown> = {
    name: project.name,
    canvas: {
      width,
      height,
      aspect: describeAspect(width, height),
      fps,
      durationSec: r2(getProjectDuration(project) / fps),
      background: project.settings.backgroundColor,
    },
    tracks,
    assets,
  };
  if (project.markers.length) summary.markers = project.markers.map((m) => ({ t: r2(m.frame / fps), label: m.label, kind: m.kind }));
  if (project.brand) summary.brand = project.brand;
  if (project.styleId) summary.style = project.styleId;
  const comps = Object.values(project.components);
  if (comps.length) summary.codeComponents = comps.map((c) => ({ id: c.id, name: c.name }));
  if (opts.selection?.length) summary.selection = opts.selection;
  if (opts.playheadFrame !== undefined) summary.playheadSec = r2(opts.playheadFrame / fps);
  return summary;
};
