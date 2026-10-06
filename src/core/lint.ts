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
  issues.push(...lintSoundAndRhythm(project, clips));

  return issues;
};

/** Editor-ear checks: music bed, ducking, music starts/ends, SFX restraint, transition and cutting rhythm. */
const lintSoundAndRhythm = (project: Project, clips: Clip[]): LintIssue[] => {
  const issues: LintIssue[] = [];
  const { fps } = project.settings;
  const duration = getProjectDuration(project);
  const sec = (f: number) => r1(f / fps);
  const audio = clips.filter((c): c is Extract<Clip, { type: "audio" }> => c.type === "audio" && !c.muted && c.volume > 0);
  const sfx = audio.filter((c) => c.role === "sfx").sort((a, b) => a.start - b.start);
  const music = audio.filter((c) => c.role === "music");
  const voices: Clip[] = [
    ...audio.filter((c) => c.role === "voice"),
    ...clips.filter((c) => c.type === "video" && !c.muted && c.volume > 0 && project.assets[c.assetId]?.hasAudio),
  ];
  const overlaps = (a: Clip, b: Clip) => a.start < getClipEnd(b) && b.start < getClipEnd(a);

  // Music bed.
  if (duration > 10 * fps && music.length === 0 && (sfx.length > 0 || voices.length > 0)) {
    issues.push({
      severity: "tip",
      code: "no-music",
      message:
        voices.length > 0
          ? "No music bed. A quiet track that fits the mood (search_audio) under the voice carries the pacing; duck it."
          : "No music bed. Find a real track that fits the mood (search_audio), then cut to its beats (detect_beats).",
    });
  }
  for (const m of music) {
    if (!m.duck && m.volume > 0.35 && voices.some((v) => overlaps(m, v))) {
      issues.push({
        severity: "warning",
        code: "music-not-ducked",
        clipId: m.id,
        timeSec: sec(m.start),
        message: "Music plays under speech without ducking. Set duck: true (or volume ≈ 0.2) so the voice sits clearly on top.",
      });
    }
    const asset = project.assets[m.assetId];
    const usedEnd = m.trimStart + m.duration * m.speed;
    const trackEndsLater = asset?.durationSec !== undefined && asset.durationSec * fps - usedEnd > fps * 0.75;
    if (getClipEnd(m) >= duration - fps / 2 && trackEndsLater && (m.fadeOut ?? 0) < fps * 0.4) {
      issues.push({
        severity: "warning",
        code: "music-hard-stop",
        clipId: m.id,
        timeSec: sec(getClipEnd(m)),
        message: "The music is chopped off at the end. Fade it out over 1–2 s, or end the edit on a downbeat where the track resolves.",
      });
    }
    if (m.trimStart > fps && (m.fadeIn ?? 0) < 3 && m.start > 0) {
      issues.push({
        severity: "tip",
        code: "music-abrupt-start",
        clipId: m.id,
        timeSec: sec(m.start),
        message: "Music enters mid-phrase with no fade. Start it on a downbeat or give it a short fade-in.",
      });
    }
  }

  // SFX restraint (Murch: more than ~2.5 layers at once turns into noise).
  for (let i = 0; i + 2 < sfx.length; i++) {
    if (sfx[i + 2].start - sfx[i].start <= 2) {
      issues.push({
        severity: "warning",
        code: "sfx-stacked",
        timeSec: sec(sfx[i].start),
        message: `Three or more sound effects start together at ${sec(sfx[i].start)}s. Keep one hero sound per moment, at most one layer under it.`,
      });
      break;
    }
  }
  const windowF = 4 * fps;
  for (let i = 0, j = 0; i < sfx.length; i++) {
    while (sfx[i].start - sfx[j].start > windowF) j++;
    if (i - j + 1 > 5) {
      issues.push({
        severity: "warning",
        code: "sfx-busy",
        timeSec: sec(sfx[j].start),
        message: `${i - j + 1} sound effects within 4 s around ${sec(sfx[j].start)}s. SFX on everything reads as noise; keep them for the moments that matter.`,
      });
      break;
    }
  }

  // Cutting rhythm (thresholds from editing research: film is >99% cuts; real edits are right-skewed).
  const m = timelineMetrics(project);
  if (m.shots >= 5) {
    if (m.nonCutShare > 0.25) {
      issues.push({
        severity: "warning",
        code: "transition-heavy",
        message: `${Math.round(m.nonCutShare * 100)}% of edit points have a transition. Editors cut ≥90% straight; keep transitions for changes of time, place or energy.`,
      });
    } else if (m.nonCutShare > 0.1) {
      issues.push({
        severity: "tip",
        code: "transition-heavy",
        message: `${Math.round(m.nonCutShare * 100)}% of edit points have a transition; aim for ≤10%, each with a reason.`,
      });
    }
    if (m.transitionTypes >= 4) {
      issues.push({
        severity: "warning",
        code: "transition-mix",
        message: `${m.transitionTypes} different transition types. Use one or two (plus one accent for the biggest moment) so it feels designed.`,
      });
    } else if (m.transitionTypes === 3) {
      issues.push({ severity: "tip", code: "transition-mix", message: "3 transition types; one or two reads as a deliberate language." });
    }
  }
  if (m.shots >= 6) {
    const uniform = m.cv < 0.35 || m.medianOverMean > 0.95 || m.longestEqualRun >= 7;
    if (uniform || m.longestEqualRun >= 5) {
      issues.push({
        severity: uniform ? "warning" : "tip",
        code: "robotic-pacing",
        message: `Shot lengths are too even (${m.longestEqualRun} similar shots in a row, spread ${m.cv.toFixed(2)}). Real edits have many short shots and a few long holds: quicken toward peaks, hold 1–2 s after key moments.`,
      });
    }
  }
  if (m.sfxPerMin > 16) {
    issues.push({
      severity: "warning",
      code: "sfx-everywhere",
      message: `${Math.round(m.sfxPerMin)} sound effects per minute. Keep ≤6–8 (≤12 for explainers): only real on-screen events, never plain cuts.`,
    });
  } else if (m.sfxPerMin > 12 && m.durationSec > 20) {
    issues.push({
      severity: "tip",
      code: "sfx-everywhere",
      message: `${Math.round(m.sfxPerMin)} sound effects per minute; most polished edits use ≤8.`,
    });
  }
  if (m.onBeatShare !== null && m.onBeatShare < 0.5) {
    issues.push({
      severity: "tip",
      code: "off-beat-cuts",
      message: `Only ${Math.round(m.onBeatShare * 100)}% of cuts land on the beat. Snap cuts to beats or downbeats (detect_beats) so the edit breathes with the music.`,
    });
  }
  return issues;
};

export type TimelineMetrics = {
  durationSec: number;
  /** Shots on the main picture track. */
  shots: number;
  aslSec: number;
  medianOverMean: number;
  /** Coefficient of variation of shot lengths. */
  cv: number;
  /** Longest run of consecutive shots within ±10% of the same length. */
  longestEqualRun: number;
  /** Share of edit points that carry a transition. */
  nonCutShare: number;
  transitionTypes: number;
  sfxPerMin: number;
  /** Share of cuts within 2 frames of a beat (music-only edits), else null. */
  onBeatShare: number | null;
};

/** Edit rhythm measured from the timeline, so the agent stops judging it by eye. */
export const timelineMetrics = (project: Project): TimelineMetrics => {
  const { fps } = project.settings;
  const duration = getProjectDuration(project);
  const clips = Object.values(project.clips).filter((c) => !c.hidden);
  const byTrack = new Map<string, Clip[]>();
  for (const c of clips) if (c.type === "video" || c.type === "image") byTrack.set(c.trackId, [...(byTrack.get(c.trackId) ?? []), c]);
  const main = [...byTrack.values()].sort((a, b) => b.length - a.length)[0]?.sort((a, b) => a.start - b.start) ?? [];
  const lengths = main.map((c) => c.duration);
  const mean = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const sorted = [...lengths].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const sd = lengths.length ? Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length) : 0;
  let longestEqualRun = lengths.length ? 1 : 0;
  for (let i = 0; i < lengths.length; i++) {
    let j = i + 1;
    while (j < lengths.length && Math.abs(lengths[j] - lengths[i]) <= lengths[i] * 0.1) j++;
    longestEqualRun = Math.max(longestEqualRun, j - i);
  }
  const transitions = main.slice(1).filter((c) => c.transitionIn);
  const audio = clips.filter((c): c is Extract<Clip, { type: "audio" }> => c.type === "audio" && !c.muted && c.volume > 0);
  const sfxCount = audio.filter((c) => c.role === "sfx").length;
  const hasVoice =
    audio.some((c) => c.role === "voice") ||
    clips.some((c) => c.type === "video" && !c.muted && c.volume > 0 && project.assets[c.assetId]?.hasAudio);
  const bed = audio.filter((c) => c.role === "music").sort((a, b) => b.duration - a.duration)[0];
  const beats = bed ? project.assets[bed.assetId]?.analysis?.beats : undefined;
  let onBeatShare: number | null = null;
  if (bed && beats?.length && !hasVoice) {
    const beatFrames = beats.map((b) => bed.start + (b * fps - bed.trimStart) / bed.speed);
    const cuts = main
      .slice(1)
      .map((c) => c.start)
      .filter((f) => f > bed.start && f < getClipEnd(bed));
    if (cuts.length >= 6) onBeatShare = cuts.filter((f) => beatFrames.some((b) => Math.abs(b - f) <= 2)).length / cuts.length;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    durationSec: r2(duration / fps),
    shots: main.length,
    aslSec: r2(mean / fps),
    medianOverMean: mean ? r2(median / mean) : 0,
    cv: mean ? r2(sd / mean) : 0,
    longestEqualRun,
    nonCutShare: main.length > 1 ? r2(transitions.length / (main.length - 1)) : 0,
    transitionTypes: new Set(transitions.map((c) => c.transitionIn?.type)).size,
    sfxPerMin: duration ? r2(sfxCount / (duration / fps / 60)) : 0,
    onBeatShare: onBeatShare === null ? null : r2(onBeatShare),
  };
};
