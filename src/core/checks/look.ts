import type { Clip, Project } from "@/core/schema";
import { type Pixels, resample } from "./pixels";

/**
 * Do the footage shots look like one film? Stock photos and clips arrive in every grade (cool and
 * grey, warm and saturated, dark, bright), and side by side they read as a montage of strangers.
 * Measured from the rendered frames: each full-frame photo or video clip's warmth, saturation and
 * brightness, compared across the shots.
 */

type Look = { warmth: number; saturation: number; brightness: number };

const lookOf = (frame: Pixels): Look | null => {
  const w = 96;
  const h = Math.max(1, Math.round((frame.h / frame.w) * w));
  const { px } = resample(frame, w, h);
  let warmth = 0;
  let saturation = 0;
  let brightness = 0;
  const n = w * h;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const gr = px[i + 1];
    const b = px[i + 2];
    const max = Math.max(r, gr, b);
    const min = Math.min(r, gr, b);
    warmth += (r - b) / 255;
    saturation += max ? (max - min) / max : 0;
    brightness += (0.299 * r + 0.587 * gr + 0.114 * b) / 255;
  }
  return { warmth: warmth / n, saturation: saturation / n, brightness: brightness / n };
};

/** The photo or video that fills the frame at `frame` (the topmost one; overlays above it don't count). */
const footageAt = (project: Project, frame: number): Clip | undefined => {
  const { width: W, height: H } = project.settings;
  for (const track of project.tracks) {
    if (track.hidden) continue;
    for (const c of Object.values(project.clips)) {
      if (c.trackId !== track.id || c.hidden || frame < c.start || frame >= c.start + c.duration) continue;
      if (c.type !== "video" && c.type !== "image") continue;
      const s = c.transform.scale;
      if (c.transform.width * s >= W * 0.8 && c.transform.height * s >= H * 0.8) return c;
    }
  }
  return undefined;
};

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const describe = (l: Look, all: Look[]) => {
  const avg = (k: keyof Look) => all.reduce((s, x) => s + x[k], 0) / all.length;
  const words: string[] = [];
  if (l.warmth > avg("warmth") + 0.06) words.push("warm");
  if (l.warmth < avg("warmth") - 0.06) words.push("cool");
  if (l.saturation > avg("saturation") + 0.08) words.push("saturated");
  if (l.saturation < avg("saturation") - 0.08) words.push("muted");
  if (l.brightness > avg("brightness") + 0.12) words.push("bright");
  if (l.brightness < avg("brightness") - 0.12) words.push("dark");
  return words.join(" and ") || "neutral";
};

/** Full-frame photos that play as flat stills (no 2.5D move): the slideshow look. */
export const measurePhotoMotion = (project: Project): string[] => {
  const { width: W, height: H } = project.settings;
  const flat = Object.values(project.clips).filter(
    (c) =>
      c.type === "image" &&
      !c.hidden &&
      !c.parallax &&
      c.transform.width * c.transform.scale >= W * 0.8 &&
      c.transform.height * c.transform.scale >= H * 0.8,
  );
  if (flat.length < 2) return [];
  return [
    `${flat.length} full-frame photos play as flat stills, which reads as a slideshow: bring them to life with animate_photos (a 2.5D camera move through each photo's depth; vary push, left, right and rise shot to shot) and cut them on the beat.`,
  ];
};

/**
 * The same component filling the frame three or more times reads as a template, however its props
 * change (four stat cards that differ only in their number). Measured from the timeline, so the critic's
 * eye can't miss it.
 */
export const measureReuse = (project: Project): string[] => {
  const { width: W, height: H, fps } = project.settings;
  const scenes = new Map<string, { name: string; starts: number[] }>();
  const trackIndex = new Map(project.tracks.map((t, i) => [t.id, i]));
  const clips = Object.values(project.clips);
  // A component over footage is an overlay (type on photos): consistent type is a design system, not a template.
  const overFootage = (c: (typeof clips)[number]) =>
    clips.some(
      (o) =>
        o.id !== c.id &&
        !o.hidden &&
        (o.type === "image" || o.type === "video" || o.type === "component" || o.type === "background") &&
        (trackIndex.get(o.trackId) ?? 0) > (trackIndex.get(c.trackId) ?? 0) &&
        Math.min(o.start + o.duration, c.start + c.duration) - Math.max(o.start, c.start) >= c.duration * 0.5,
    );
  for (const c of clips) {
    if (c.type !== "component" || c.hidden) continue;
    if (c.duration < fps * 1.2) continue;
    if (c.transform.width * c.transform.scale < W * 0.8 || c.transform.height * c.transform.scale < H * 0.8) continue;
    if (overFootage(c)) continue;
    const name = c.component.startsWith("code:") ? (project.components?.[c.component.slice(5)]?.name ?? c.component) : c.component;
    const entry = scenes.get(c.component) ?? { name, starts: [] };
    entry.starts.push(c.start / fps);
    scenes.set(c.component, entry);
  }
  const findings: string[] = [];
  for (const { name, starts } of scenes.values()) {
    if (starts.length < 3) continue;
    const at = starts
      .sort((a, b) => a - b)
      .map((s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`)
      .join(", ");
    findings.push(
      `${starts.length} scenes are the same layout (${name}, at ${at}): one composition swapped ${starts.length} times reads as a template. Give each idea its own composition and its own visual (a timeline, gauge, map, thermometer, photo), placed and scaled differently, using the whole frame. (One graphic that deliberately evolves is fine when the change itself is the event: new data drawing on, the camera moving to a new part of it.)`,
    );
  }
  return findings;
};

/** One finding when the footage shots disagree on warmth, saturation or brightness. */
/** Each full-frame footage shot's average look, with the frame it was first seen at. */
const shotLooks = (project: Project, samples: { frame: number; pixels: Pixels }[]) => {
  const shots = new Map<string, { first: number; looks: Look[] }>();
  for (const { frame, pixels } of samples) {
    const clip = footageAt(project, frame);
    const look = clip ? lookOf(pixels) : null;
    if (!clip || !look) continue;
    const s = shots.get(clip.id) ?? { first: frame, looks: [] };
    s.looks.push(look);
    shots.set(clip.id, s);
  }
  const mean = (looks: Look[]): Look => ({
    warmth: looks.reduce((s, l) => s + l.warmth, 0) / looks.length,
    saturation: looks.reduce((s, l) => s + l.saturation, 0) / looks.length,
    brightness: looks.reduce((s, l) => s + l.brightness, 0) / looks.length,
  });
  return [...shots.values()].map((s) => ({ first: s.first, look: mean(s.looks) }));
};

/**
 * Footage that reads grey or dim under a brief that asks for energy: black-and-white or washed-out
 * shots feel slow and somber whatever the cut does.
 */
export const measureMood = (project: Project, samples: { frame: number; pixels: Pixels }[], energetic: boolean): string[] => {
  if (!energetic) return [];
  const per = shotLooks(project, samples);
  if (per.length < 2) return [];
  const fps = project.settings.fps;
  const grey = per.filter((p) => p.look.saturation < 0.08);
  if (grey.length)
    return [
      `${grey.length} footage shot${grey.length > 1 ? "s are" : " is"} nearly black and white (${grey
        .slice(0, 4)
        .map((p) => clock(p.first / fps))
        .join(
          ", ",
        )}): under a brief that asks for energy, ${grey.length > 1 ? "they read" : "it reads"} slow and somber. Use color footage, or grade it warmer and brighter.`,
    ];
  const sat = per.reduce((n, p) => n + p.look.saturation, 0) / per.length;
  const lum = per.reduce((n, p) => n + p.look.brightness, 0) / per.length;
  if (sat < 0.18 && lum < 0.32)
    return [
      `The footage reads dim and grey (average saturation ${sat.toFixed(2)}, brightness ${lum.toFixed(2)}) for a brief that asks for energy: pick brighter, more colorful, more active shots, or lift the grade.`,
    ];
  return [];
};

export const measureLook = (project: Project, samples: { frame: number; pixels: Pixels }[]): string[] => {
  const fps = project.settings.fps;
  const per = shotLooks(project, samples);
  if (per.length < 3) return [];
  const range = (k: keyof Look) => Math.max(...per.map((p) => p.look[k])) - Math.min(...per.map((p) => p.look[k]));
  const off = range("warmth") > 0.16 || range("saturation") > 0.24 || range("brightness") > 0.3;
  if (!off) return [];
  const all = per.map((p) => p.look);
  const extremes = [...per]
    .map((p) => ({ ...p, label: describe(p.look, all) }))
    .filter((p) => p.label !== "neutral")
    .slice(0, 4)
    .map((p) => `${clock(p.first / fps)} ${p.label}`);
  return [
    `The footage doesn't share one look (${extremes.join(", ")}): side by side the shots read as a stock montage. Give every photo and video clip the same grade (one LUT such as film-print or warm-vlog at 0.4–0.6 with a shared temperature), then even out exposure shot to shot.`,
  ];
};
