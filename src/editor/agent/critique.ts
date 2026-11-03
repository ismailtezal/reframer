"use client";

import { renderStillOnWeb } from "@remotion/web-renderer";
import { getProjectDuration } from "@/core/project-utils";
import type { Project } from "@/core/schema";
import { ProjectComposition } from "@/remotion/ProjectComposition";
import { getProject } from "../store/project-store";
import { measureLayout } from "./layout-check";
import { measureLook, measureMood, measurePhotoMotion, measureReuse } from "./look-check";
import { measureMix, measureSound } from "./sound-check";

/**
 * Critique for a finished video: renders it once a second, measures what a viewer would notice
 * (frames holding still, shots that repeat, near-empty frames, length against the brief), builds a
 * contact sheet and a motion strip, and asks an independent critic (/api/critique) to score it.
 */

/** A frame as a bitmap (lossless, so a text probe can be compared with it pixel for pixel). */
const renderBitmap = async (project: Project, frame: number, scale: number, textProbe = false) => {
  const { width, height, fps } = project.settings;
  const result = await renderStillOnWeb({
    composition: {
      id: "reframer-critique",
      component: ProjectComposition,
      width,
      height,
      fps,
      durationInFrames: getProjectDuration(project),
      defaultProps: { project, editor: false, textProbe },
    },
    inputProps: { project, editor: false, textProbe },
    frame,
    scale,
    delayRenderTimeoutInMilliseconds: 20000,
  });
  return createImageBitmap(await result.blob({ format: "png" }));
};

/** Text probes for up to `max` evenly spread samples (the rest stay undefined). */
const renderProbes = async (project: Project, frames: number[], scale: number, max = 20) => {
  const every = Math.max(1, Math.ceil(frames.length / max));
  const out: (ImageBitmap | undefined)[] = [];
  for (const [i, f] of frames.entries())
    out.push(i % every === 0 ? await renderBitmap(project, f, scale, true).catch(() => undefined) : undefined);
  return out;
};

/** 32×18 grayscale fingerprint of a frame. */
const fingerprint = (bitmap: ImageBitmap) => {
  const c = new OffscreenCanvas(32, 18);
  const g = c.getContext("2d");
  if (!g) return [];
  g.drawImage(bitmap, 0, 0, 32, 18);
  const px = g.getImageData(0, 0, 32, 18).data;
  const out: number[] = [];
  for (let i = 0; i < px.length; i += 4) out.push(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
  return out;
};
const diff = (a: number[], b: number[]) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0) / Math.max(1, a.length);
const spread = (a: number[]) => {
  const m = a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length));
};
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** Tiles bitmaps into one JPEG data URL, optionally with timestamp labels. */
const tile = async (frames: { bitmap: ImageBitmap; label?: string }[], cols: number, tileWidth: number) => {
  const { width, height } = frames[0].bitmap;
  const tw = tileWidth;
  const th = Math.round((height / width) * tw);
  const rows = Math.ceil(frames.length / cols);
  const canvas = new OffscreenCanvas(cols * (tw + 4) - 4, rows * (th + 4) - 4);
  const g = canvas.getContext("2d");
  if (!g) throw new Error("no 2D canvas");
  g.fillStyle = "#222";
  g.fillRect(0, 0, canvas.width, canvas.height);
  frames.forEach(({ bitmap, label }, i) => {
    const x = (i % cols) * (tw + 4);
    const y = Math.floor(i / cols) * (th + 4);
    g.drawImage(bitmap, x, y, tw, th);
    if (label) {
      g.fillStyle = "rgba(0,0,0,0.7)";
      g.fillRect(x, y, 58, 22);
      g.fillStyle = "#fff";
      g.font = "16px sans-serif";
      g.fillText(label, x + 6, y + 16);
    }
  });
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
};

/** What a viewer would notice, measured from frames sampled once a second. */
const measure = (prints: number[][], durationSec: number, targetSec?: number) => {
  const findings: string[] = [];
  // Holding still: under 1.5 grey levels of change per second for 3 s or more.
  let runStart = -1;
  for (let i = 1; i <= prints.length; i++) {
    const still = i < prints.length && diff(prints[i - 1], prints[i]) < 1.5;
    if (still && runStart < 0) runStart = i - 1;
    if (!still && runStart >= 0) {
      if (i - 1 - runStart >= 3)
        findings.push(
          `Holds almost perfectly still from ${clock(runStart)} to ${clock(i - 1)} (${i - 1 - runStart} s): add camera movement or secondary animation, or cut it shorter.`,
        );
      runStart = -1;
    }
  }
  // Near-empty: a flat frame (one color) for 2 s or more.
  let flatStart = -1;
  for (let i = 0; i <= prints.length; i++) {
    const flat = i < prints.length && spread(prints[i]) < 8;
    if (flat && flatStart < 0) flatStart = i;
    if (!flat && flatStart >= 0) {
      if (i - flatStart >= 2) findings.push(`Nearly empty (one flat color) from ${clock(flatStart)} to ${clock(i)}.`);
      flatStart = -1;
    }
  }
  // Repeats: detailed frames 8 s or more apart that look nearly identical.
  const pairs: string[] = [];
  for (let i = 0; i < prints.length; i++) {
    if (spread(prints[i]) < 15) continue;
    for (let j = i + 8; j < prints.length; j++) {
      if (spread(prints[j]) >= 15 && diff(prints[i], prints[j]) < 9) {
        pairs.push(`${clock(i)} ≈ ${clock(j)}`);
        i = j;
        break;
      }
    }
  }
  if (pairs.length) findings.push(`Shots repeat almost identically: ${pairs.slice(0, 6).join(", ")} — vary framing, scale or scene.`);
  if (targetSec && Math.abs(durationSec - targetSec) / targetSec > 0.08) {
    findings.push(`Runs ${durationSec.toFixed(1)} s but the brief asks for ${targetSec.toFixed(0)} s.`);
  }
  return findings;
};

// Whole words in any script (\b only knows ASCII letters, so "hızlı" would never match).
const words = (list: string) => new RegExp(`(?<![\\p{L}\\p{N}])(${list})(?![\\p{L}\\p{N}])`, "iu");
const FAST = words(
  "energetic|high[- ]energy|fast|hype|punchy|bold|upbeat|dynamic|action|sport|explosive|enerjik|hızlı|dinamik|coşkulu|hareketli",
);
const SLOW = words("calm|cozy|cosy|relaxing|chill|gentle|slow|peaceful|soothing|meditative|sakin|huzurlu|rahatlatıcı|yavaş|dingin");
const SPOT = words("promo|ad|advert|commercial|spot|reel|teaser|trailer|intro|launch|tanıtım|reklam|fragman");
/** A new shot: the mean grey level moves this much from one second to the next (camera moves and text
 * animation stay well under it; a cut to another picture lands around 40–90). */
const CHANGE = 40;

/**
 * Pace against the brief's energy. Picture changes are counted from the per-second fingerprints
 * (scene changes inside one component count too); an energetic brief wants a new picture about every
 * second, a calm one lets shots breathe.
 */
const measurePace = (prints: number[][], durationSec: number, brief: string) => {
  if (prints.length < 6) return [];
  let changes = 0;
  for (let i = 1; i < prints.length; i++) if (diff(prints[i - 1], prints[i]) > CHANGE) changes++;
  const shot = durationSec / (changes + 1);
  if (FAST.test(brief) && !SLOW.test(brief) && shot > 2.2)
    return [
      `The picture changes about every ${shot.toFixed(1)} s, slow for a brief that asks for energy: cut every 0.8–1.6 s on the beat (whips, punch-ins, match cuts), keeping one or two longer holds for the key lines.`,
    ];
  if (SLOW.test(brief) && !FAST.test(brief) && shot < 1.2)
    return [
      `The picture changes about every ${shot.toFixed(1)} s, frantic for a calm brief: let shots breathe for 2–4 s with slow camera moves.`,
    ];
  // Short spots (promos, ads, reels, teasers, intros) move even when the tone is calm: every second counts.
  const limit = SLOW.test(brief) ? 3.2 : 2.6;
  if (SPOT.test(brief) && durationSec <= 35 && shot > limit)
    return [
      `The picture changes about every ${shot.toFixed(1)} s, slow for a ${durationSec.toFixed(0)}-second spot: keep shots to about ${(limit - 0.6).toFixed(1)} s on average (a calm tone can still cut on the beat), drop shots that carry no message, and let only the key moment hold longer.`,
    ];
  return [];
};

/** The critic's overall score per project, round by round (this session). */
const scoreHistory = new Map<string, number[]>();

export const critiqueVideo = async (input: { brief: string; targetDurationSec?: number }) => {
  const project = getProject();
  const { width, fps } = project.settings;
  const totalFrames = getProjectDuration(project);
  const durationSec = totalFrames / fps;

  // Once a second at 480 px: the measurements, and every n-th frame for the contact sheet.
  const scale = Math.min(1, 480 / width);
  const samples: { sec: number; bitmap: ImageBitmap; print: number[] }[] = [];
  let firstError: unknown;
  for (let sec = 0; sec < durationSec; sec += 1) {
    const frame = Math.min(totalFrames - 1, Math.round((sec + 0.5) * fps));
    // Media that's still loading can fail a frame once; a second try usually lands.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const bitmap = await renderBitmap(project, frame, scale);
        samples.push({ sec, bitmap, print: fingerprint(bitmap) });
        break;
      } catch (err) {
        firstError ??= err;
        console.warn("[reframer] critique frame failed", err);
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }
  if (!samples.length) {
    const why = firstError instanceof Error ? firstError.message : String(firstError ?? "");
    return {
      error: `Couldn't render any frames${why ? ` (${why.slice(0, 300)})` : ""}. Check get_errors for a broken component, fix it, then call critique_video again.`,
    };
  }
  const sampleFrames = samples.map((s) => Math.min(totalFrames - 1, Math.round((s.sec + 0.5) * fps)));
  const findings = [
    ...measure(
      samples.map((s) => s.print),
      durationSec,
      input.targetDurationSec,
    ),
    ...measurePace(
      samples.map((s) => s.print),
      durationSec,
      input.brief,
    ),
    // Text that runs off the frame, overlaps, is too small or hard to read, measured from the real layout.
    ...(await measureLayout(
      project,
      sampleFrames,
      samples.map((s) => s.bitmap),
      await renderProbes(project, sampleFrames, scale),
    ).catch(() => [])),
    // Photos left as flat stills, and footage shots that don't share a grade.
    ...measurePhotoMotion(project),
    ...measureReuse(project),
    ...measureMood(
      project,
      samples.map((s, i) => ({ frame: sampleFrames[i], bitmap: s.bitmap })),
      FAST.test(input.brief) && !SLOW.test(input.brief),
    ),
    ...measureLook(
      project,
      samples.map((s, i) => ({ frame: sampleFrames[i], bitmap: s.bitmap })),
    ),
    // The critic only sees frames; the soundtrack is checked from the timeline and the audio itself.
    ...measureSound(project, durationSec),
    ...(await measureMix(project).catch(() => [])),
  ];
  const every = Math.max(1, Math.round(samples.length / 16));
  const sheet = await tile(
    samples.filter((_, i) => i % every === 0).map((s) => ({ bitmap: s.bitmap, label: clock(s.sec) })),
    4,
    480,
  );

  // Motion strip: 12 consecutive frames at 6 fps from the middle (2 s).
  const stripStart = Math.max(0, Math.round((durationSec / 2 - 1) * fps));
  const strip: { bitmap: ImageBitmap }[] = [];
  for (let i = 0; i < 12; i++) {
    const frame = Math.min(totalFrames - 1, stripStart + Math.round((i * fps) / 6));
    try {
      strip.push({ bitmap: await renderBitmap(project, frame, Math.min(1, 400 / width)) });
    } catch {
      // A missing strip frame only thins the strip.
    }
  }
  const stripUrl = strip.length ? await tile(strip, 4, 400) : sheet;

  const res = await fetch("/api/critique", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief: input.brief, sheet, strip: stripUrl, durationSec, targetDurationSec: input.targetDurationSec, findings }),
  });
  const body = (await res.json()) as { verdict?: { overall?: number }; unavailable?: string; error?: string };
  // Rounds that don't move the score mean the fixes were patches on a structural problem.
  const overall = typeof body.verdict?.overall === "number" ? body.verdict.overall : undefined;
  const history = scoreHistory.get(project.id) ?? [];
  const stuck = overall !== undefined && history.length > 0 && overall <= history[history.length - 1];
  if (overall !== undefined) scoreHistory.set(project.id, [...history, overall].slice(-6));
  return {
    ...(body.verdict ? { verdict: body.verdict } : {}),
    ...(body.unavailable ? { note: body.unavailable } : {}),
    ...(body.error ? { criticError: body.error } : {}),
    durationSec: Math.round(durationSec * 10) / 10,
    findings,
    rule: [
      "The findings are measured from the render (layout, sound, length), not opinions: fix every one of them, including the length against the brief (tighten the script or the cut).",
      stuck
        ? `The score didn't rise since the last round (${history[history.length - 1]} → ${overall}): your fixes were patches on a structural problem. Rebuild the weakest scene or sequence the critic names (new framing, new motion, new asset) instead of adjusting it.`
        : "Then fix the critic's problems, worst first.",
      "Call critique_video again; stop when overall ≥ 8 or after 4 rounds, and tell the user the final score.",
    ].join(" "),
    frames: [
      { timeSec: 0, label: "contact sheet", dataUrl: sheet },
      { timeSec: durationSec / 2, label: "motion strip", dataUrl: stripUrl },
    ],
  };
};

// Dev only: lets the checks run on the open project from the console (or a test driver).
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  Object.assign(window, {
    __reframerChecks: {
      layout: async () => {
        const project = getProject();
        const total = getProjectDuration(project);
        const fps = project.settings.fps;
        const frames = Array.from({ length: Math.floor(total / fps) }, (_, s) => Math.min(total - 1, Math.round((s + 0.5) * fps)));
        const scale = Math.min(1, 480 / project.settings.width);
        const bitmaps: (ImageBitmap | undefined)[] = [];
        for (const f of frames) bitmaps.push(await renderBitmap(project, f, scale).catch(() => undefined));
        return measureLayout(project, frames, bitmaps, await renderProbes(project, frames, scale));
      },
      sound: () => measureSound(getProject(), getProjectDuration(getProject()) / getProject().settings.fps),
      pace: async (brief: string) => {
        const project = getProject();
        const total = getProjectDuration(project);
        const fps = project.settings.fps;
        const scale = Math.min(1, 480 / project.settings.width);
        const prints: number[][] = [];
        for (let s = 0; s < total / fps; s++) {
          const bitmap = await renderBitmap(project, Math.min(total - 1, Math.round((s + 0.5) * fps)), scale).catch(() => undefined);
          if (bitmap) prints.push(fingerprint(bitmap));
        }
        const diffs = prints.slice(1).map((p, i) => Math.round(diff(prints[i], p)));
        return [`diffs: ${diffs.join(" ")}`, ...measurePace(prints, total / fps, brief)];
      },
      look: async (brief = "") => {
        const project = getProject();
        const total = getProjectDuration(project);
        const fps = project.settings.fps;
        const scale = Math.min(1, 480 / project.settings.width);
        const out: { frame: number; bitmap: ImageBitmap }[] = [];
        for (let s = 0; s < total / fps; s++) {
          const frame = Math.min(total - 1, Math.round((s + 0.5) * fps));
          const bitmap = await renderBitmap(project, frame, scale).catch(() => undefined);
          if (bitmap) out.push({ frame, bitmap });
        }
        return [...measureLook(project, out), ...measureMood(project, out, FAST.test(brief) && !SLOW.test(brief))];
      },
    },
  });
}
