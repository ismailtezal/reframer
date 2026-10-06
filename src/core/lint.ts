import { contrastRatio } from "./color";
import { getClipEnd, getProjectDuration } from "./project-utils";
import type { Clip, Project } from "./schema";

/**
 * Deterministic "video linter": catches the mistakes that make AI-made videos
 * look amateur (illegible text, unsafe placement, dead air, slop patterns).
 * Used by the agent's review loop and shown to the user.
 */

export type LintIssue = {
  severity: "error" | "warning" | "tip";
  code: string;
  message: string;
  clipId?: string;
  timeSec?: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

const textBox = (clip: Clip) => {
  const t = clip.transform;
  const lines = clip.type === "text" ? Math.max(1, clip.text.split("\n").length) : 1;
  const h = clip.type === "text" ? clip.style.fontSize * clip.style.lineHeight * lines : t.height;
  return { x0: t.x - (t.width * t.scale) / 2, x1: t.x + (t.width * t.scale) / 2, y0: t.y - (h * t.scale) / 2, y1: t.y + (h * t.scale) / 2 };
};

export const lintProject = (project: Project): LintIssue[] => {
  const issues: LintIssue[] = [];
  const { width: W, height: H, fps } = project.settings;
  const unit = Math.min(W, H) / 1080;
  const portrait = H > W;
  const duration = getProjectDuration(project);
  const clips = Object.values(project.clips).filter((c) => !c.hidden);
  const texts = clips.filter((c): c is Extract<Clip, { type: "text" }> => c.type === "text");

  if (clips.length === 0) {
    return [{ severity: "tip", code: "empty", message: "The timeline is empty." }];
  }

  for (const clip of texts) {
    const size = clip.style.fontSize * clip.transform.scale;
    const words = clip.text.trim().split(/\s+/).length;
    if (size < 28 * unit) {
      issues.push({
        severity: "error",
        code: "text-too-small",
        clipId: clip.id,
        message: `Text "${clip.text.slice(0, 30)}" is ${Math.round(size)}px — below the 28px legibility floor at this resolution.`,
      });
    } else if (size < 36 * unit && words > 4) {
      issues.push({
        severity: "warning",
        code: "body-too-small",
        clipId: clip.id,
        message: `Body text "${clip.text.slice(0, 30)}…" is ${Math.round(size)}px; use ≥ 36px for sentences.`,
      });
    }
    if (words > 14) {
      issues.push({
        severity: "warning",
        code: "too-many-words",
        clipId: clip.id,
        message: `${words} words on one card — viewers can't read that in time. Split it or cut to ≤ 8–12 words.`,
      });
    }
    const secs = clip.duration / fps;
    const readSecs = words / 3.2 + 0.6;
    if (secs < readSecs && words > 3) {
      issues.push({
        severity: "warning",
        code: "too-fast",
        clipId: clip.id,
        timeSec: r1(clip.start / fps),
        message: `"${clip.text.slice(0, 30)}" is on screen ${r1(secs)}s but needs ~${r1(readSecs)}s to read.`,
      });
    }
    const b = textBox(clip);
    if (b.x0 < -2 || b.x1 > W + 2 || b.y0 < -2 || b.y1 > H + 2) {
      issues.push({
        severity: "error",
        code: "off-canvas",
        clipId: clip.id,
        message: `Text "${clip.text.slice(0, 30)}" extends outside the frame.`,
      });
    } else if (portrait && (b.y0 < H * 0.115 || b.y1 > H * 0.78 || b.x1 > W * 0.87)) {
      issues.push({
        severity: "warning",
        code: "unsafe-zone",
        clipId: clip.id,
        message: `Text "${clip.text.slice(0, 30)}" sits under platform UI (vertical safe zones: top 11.5%, bottom 22%, right 13%).`,
      });
    } else if (!portrait && (b.x0 < W * 0.05 || b.x1 > W * 0.95 || b.y0 < H * 0.05 || b.y1 > H * 0.95)) {
      issues.push({
        severity: "tip",
        code: "outside-title-safe",
        clipId: clip.id,
        message: `Text "${clip.text.slice(0, 30)}" is outside the 5% title-safe margin.`,
      });
    }
    if (!clip.style.gradient && !clip.style.stroke && !clip.style.background && !clip.style.shadow) {
      const below = clips.some(
        (c) =>
          c.id !== clip.id &&
          (c.type === "video" || c.type === "image" || c.type === "component") &&
          c.start < getClipEnd(clip) &&
          getClipEnd(c) > clip.start,
      );
      if (!below) {
        const ratio = contrastRatio(clip.style.color, project.settings.backgroundColor);
        if (ratio < 3)
          issues.push({
            severity: "error",
            code: "low-contrast",
            clipId: clip.id,
            message: `Text color has ${r1(ratio)}:1 contrast with the background (needs ≥ 3:1).`,
          });
      }
    }
  }

  // Overlapping text at the same time.
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i];
      const b = texts[j];
      if (a.start >= getClipEnd(b) || b.start >= getClipEnd(a)) continue;
      const ba = textBox(a);
      const bb = textBox(b);
      if (ba.x0 < bb.x1 && bb.x0 < ba.x1 && ba.y0 < bb.y1 && bb.y0 < ba.y1) {
        issues.push({
          severity: "error",
          code: "text-overlap",
          clipId: b.id,
          timeSec: r1(Math.max(a.start, b.start) / fps),
          message: `"${a.text.slice(0, 20)}" and "${b.text.slice(0, 20)}" overlap on screen.`,
        });
      }
    }
  }

  // Dead air: long stretches where nothing starts or ends.
  const events = [...new Set(clips.flatMap((c) => [c.start, getClipEnd(c)]).concat([0, duration]))].sort((a, b) => a - b);
  for (let i = 0; i < events.length - 1; i++) {
    const gap = (events[i + 1] - events[i]) / fps;
    const animated = clips.some(
      (c) =>
        c.start <= events[i] &&
        getClipEnd(c) >= events[i + 1] &&
        (c.type === "video" || c.animations?.loop || c.type === "component" || c.keyframes),
    );
    if (gap > 5 && !animated) {
      issues.push({
        severity: "warning",
        code: "static",
        timeSec: r1(events[i] / fps),
        message: `${r1(gap)}s with no visual change from ${r1(events[i] / fps)}s — add a cut, motion or new information every 2–4s.`,
      });
    }
  }

  // Empty or black stretches.
  const covered = (f: number) => clips.some((c) => c.type !== "audio" && c.start <= f && getClipEnd(c) > f);
  for (let f = 0; f < duration; f += fps) {
    if (!covered(f)) {
      issues.push({
        severity: "warning",
        code: "empty-frame",
        timeSec: r1(f / fps),
        message: `Nothing visible at ${r1(f / fps)}s (blank frame).`,
      });
      break;
    }
  }

  // Hook: nothing new in the first 3 seconds.
  const early = clips.filter((c) => c.type !== "audio" && c.start < 3 * fps);
  if (duration > 8 * fps && early.length <= 1 && !early.some((c) => c.type === "video")) {
    issues.push({
      severity: "tip",
      code: "weak-hook",
      message: "The first 3 seconds have a single static element — open on the most striking visual or a bold claim.",
    });
  }

  // Slop detector: every text uses the same fade-in.
  const entrances = clips
    .filter((c) => c.type === "text" || c.type === "component")
    .map((c) => c.animations?.in?.type ?? (c.type === "text" ? c.textAnimation?.type : undefined) ?? "none");
  if (entrances.length >= 4 && entrances.every((e) => e === "fade")) {
    issues.push({
      severity: "tip",
      code: "all-fades",
      message: "Every element fades in — vary entrances (rise-blur, mask reveals, cuts) for a less generic feel.",
    });
  }

  // Missing media.
  for (const c of clips) {
    if ("assetId" in c && !project.assets[c.assetId]) {
      issues.push({
        severity: "error",
        code: "missing-asset",
        clipId: c.id,
        message: `Clip "${c.name ?? c.id}" points to a missing asset.`,
      });
    }
  }

  // Sound.
  const hasAudio = clips.some((c) => c.type === "audio" || (c.type === "video" && !c.muted && project.assets[c.assetId]?.hasAudio));
  if (!hasAudio && duration > 4 * fps) {
    issues.push({ severity: "tip", code: "silent", message: "The video has no sound — add a music bed and a few SFX on key moments." });
  }

  return issues;
};
