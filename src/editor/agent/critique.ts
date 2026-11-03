"use client";

import { renderStillOnWeb } from "@remotion/web-renderer";
import { diff, fingerprint, isEnergetic, measureFrames, measurePace } from "@/core/checks/frames";
import { measureLook, measureMood, measurePhotoMotion, measureReuse } from "@/core/checks/look";
import type { Pixels } from "@/core/checks/pixels";
import { getProjectDuration } from "@/core/project-utils";
import type { Project } from "@/core/schema";
import { ProjectComposition } from "@/remotion/ProjectComposition";
import { getProject } from "../store/project-store";
import { bitmapPixels, measureLayout } from "./layout-check";
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

/** Text probes for up to `max` evenly spread samples (the rest stay undefined), as pixels. */
const renderProbes = async (project: Project, frames: number[], scale: number, max = 20) => {
  const every = Math.max(1, Math.ceil(frames.length / max));
  const out: (Pixels | null | undefined)[] = [];
  for (const [i, f] of frames.entries())
    out.push(
      i % every === 0
        ? await renderBitmap(project, f, scale, true)
            .then(bitmapPixels)
            .catch(() => undefined)
        : undefined,
    );
  return out;
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

/** The critic's overall score per project, round by round (this session). */
const scoreHistory = new Map<string, number[]>();

export const critiqueVideo = async (input: { brief: string; targetDurationSec?: number }) => {
  const project = getProject();
  const { width, fps } = project.settings;
  const totalFrames = getProjectDuration(project);
  const durationSec = totalFrames / fps;

  // Once a second at 480 px: the measurements, and every n-th frame for the contact sheet.
  const scale = Math.min(1, 480 / width);
  const samples: { sec: number; bitmap: ImageBitmap; pixels: Pixels; print: number[] }[] = [];
  let firstError: unknown;
  for (let sec = 0; sec < durationSec; sec += 1) {
    const frame = Math.min(totalFrames - 1, Math.round((sec + 0.5) * fps));
    // Media that's still loading can fail a frame once; a second try usually lands.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const bitmap = await renderBitmap(project, frame, scale);
        const pixels = bitmapPixels(bitmap);
        if (!pixels) throw new Error("no 2D canvas");
        samples.push({ sec, bitmap, pixels, print: fingerprint(pixels) });
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
    ...measureFrames(
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
      samples.map((s) => s.pixels),
      await renderProbes(project, sampleFrames, scale),
    ).catch(() => [])),
    // Photos left as flat stills, and footage shots that don't share a grade.
    ...measurePhotoMotion(project),
    ...measureReuse(project),
    ...measureMood(
      project,
      samples.map((s, i) => ({ frame: sampleFrames[i], pixels: s.pixels })),
      isEnergetic(input.brief),
    ),
    ...measureLook(
      project,
      samples.map((s, i) => ({ frame: sampleFrames[i], pixels: s.pixels })),
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
        const pixels: (Pixels | null | undefined)[] = [];
        for (const f of frames)
          pixels.push(
            await renderBitmap(project, f, scale)
              .then(bitmapPixels)
              .catch(() => undefined),
          );
        return measureLayout(project, frames, pixels, await renderProbes(project, frames, scale));
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
          const pixels = bitmap ? bitmapPixels(bitmap) : null;
          if (pixels) prints.push(fingerprint(pixels));
        }
        const diffs = prints.slice(1).map((p, i) => Math.round(diff(prints[i], p)));
        return [`diffs: ${diffs.join(" ")}`, ...measurePace(prints, total / fps, brief)];
      },
      look: async (brief = "") => {
        const project = getProject();
        const total = getProjectDuration(project);
        const fps = project.settings.fps;
        const scale = Math.min(1, 480 / project.settings.width);
        const out: { frame: number; pixels: Pixels }[] = [];
        for (let s = 0; s < total / fps; s++) {
          const frame = Math.min(total - 1, Math.round((s + 0.5) * fps));
          const bitmap = await renderBitmap(project, frame, scale).catch(() => undefined);
          const pixels = bitmap ? bitmapPixels(bitmap) : null;
          if (pixels) out.push({ frame, pixels });
        }
        return [...measureLook(project, out), ...measureMood(project, out, isEnergetic(brief))];
      },
    },
  });
}
