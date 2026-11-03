import fs from "node:fs/promises";
import path from "node:path";
import { lintText } from "@/agent/text-checks";
import { fingerprint, isEnergetic, measureFrames, measurePace } from "@/core/checks/frames";
import {
  caseFindings,
  contrastFindings,
  glyphFindings,
  LAYOUT_ARTIFACT,
  type LayoutFound,
  type LayoutKind,
  type LayoutScan,
  safeAreaFindings,
  tallyLayout,
} from "@/core/checks/layout";
import { measureLook, measureMood, measurePhotoMotion, measureReuse } from "@/core/checks/look";
import type { Pixels } from "@/core/checks/pixels";
import { measureMix, measureSound } from "@/core/checks/sound";
import { projectLanguage } from "@/core/language";
import { type LintIssue, lintProject } from "@/core/lint";
import { getProjectDuration } from "@/core/project-utils";
import type { Project } from "@/core/schema";
import { RENDERS_DIR } from "@/server/paths";
import { audioProfiles } from "../audio";
import type { Command } from "../command";
import { type CliContext, resolveProject } from "../context";
import { CliError, usage } from "../errors";
import { contactSheet, pixelsOf } from "../sharp";
import { openStillSession } from "../stills";

export type Severity = "error" | "warning" | "tip";
export type Finding = { check: string; severity: Severity; message: string; clipId?: string; atSec?: number | [number, number] };

const r2 = (n: number) => Math.round(n * 100) / 100;
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

const LAYOUT_SEVERITY: Record<LayoutKind, Severity> = {
  edge: "error",
  clipped: "error",
  glyphs: "error",
  overlap: "error",
  contrast: "error",
  case: "error",
  small: "warning",
  "safe-area": "warning",
  margin: "warning",
};

/** Linter estimates of text placement that a measured frame answers exactly. */
const ESTIMATED_LAYOUT = new Set([
  "off-canvas",
  "unsafe-zone",
  "outside-title-safe",
  "low-contrast",
  "text-overlap",
  "text-too-small",
  "body-too-small",
]);
const SOUND_VERDICTS = new Set(["silent", "no-music"]);

const fromLint = (issue: LintIssue, check = "lint"): Finding => ({
  check: `${check}.${issue.code}`,
  severity: issue.severity,
  message: issue.message,
  ...(issue.clipId ? { clipId: issue.clipId } : {}),
  ...(issue.timeSec !== undefined ? { atSec: issue.timeSec } : {}),
});

const strings = (check: string, severity: Severity, messages: string[]): Finding[] =>
  messages.map((message) => ({ check, severity, message }));

type Sample = { frame: number; pixels: Pixels; png: Buffer; print: number[] };

/** Frames rendered with the layout probe on (and text probes on up to 20 of them), measured. */
const measureFrameChecks = async (ctx: CliContext, project: Project, frames: number[], opts: { scale: number; safeArea: boolean }) => {
  const { width: W, height: H, fps } = project.settings;
  const language = projectLanguage(project);
  const every = Math.max(1, Math.ceil(frames.length / 20));
  const samples: Sample[] = [];
  const rows: { frame: number; layout: LayoutFound[]; contrast?: LayoutFound[] }[] = [];
  const seenClips = new Set<string>();
  let failed = 0;
  let firstError = "";
  const session = await openStillSession(ctx, project);
  try {
    for (const [i, frame] of frames.entries()) {
      if (i % 10 === 0) ctx.log(`Measuring frame ${i + 1}/${frames.length} (${clock(frame / fps)})…`);
      let scan: LayoutScan | undefined;
      const onArtifact = (filename: string, content: string) => {
        if (!filename.startsWith(LAYOUT_ARTIFACT)) return;
        try {
          const parsed = JSON.parse(content) as LayoutScan & { error?: string };
          if (parsed.error) ctx.log(`Couldn't measure the layout at frame ${frame}: ${parsed.error}`);
          else scan = parsed;
        } catch {
          // An unreadable scan only loses this frame's layout.
        }
      };
      let png: Buffer | undefined;
      // Media still loading can fail a frame once; a second try usually lands.
      for (let attempt = 0; attempt < 2 && !png; attempt++) {
        try {
          png = await session.png(frame, { scale: opts.scale, props: { layoutProbe: true }, onArtifact });
        } catch (err) {
          firstError ||= err instanceof Error ? err.message : String(err);
        }
      }
      if (!png) {
        failed++;
        continue;
      }
      const pixels = await pixelsOf(png);
      samples.push({ frame, pixels, png, print: fingerprint(pixels) });
      const blocks = scan?.blocks ?? [];
      for (const b of blocks) if (b.clipId) seenClips.add(b.clipId);
      const probe =
        scan && i % every === 0
          ? await session
              .png(frame, { scale: opts.scale, props: { textProbe: true } })
              .then((p) => pixelsOf(p))
              .catch(() => undefined)
          : undefined;
      rows.push({
        frame,
        layout: [
          ...(scan?.found ?? []),
          ...glyphFindings(blocks),
          ...caseFindings(blocks, language),
          ...(opts.safeArea ? safeAreaFindings(blocks, W, H) : []),
        ],
        ...(probe && scan ? { contrast: contrastFindings(blocks, pixels, probe, W, H) } : {}),
      });
    }
  } finally {
    await session.close();
  }
  if (!samples.length)
    throw new CliError("E_RENDER", `Couldn't render any frame to check${firstError ? `: ${firstError.slice(0, 300)}` : ""}`);
  const layout: Finding[] = tallyLayout(rows, fps).map((issue) => ({
    check: `layout.${issue.kind}`,
    severity: LAYOUT_SEVERITY[issue.kind],
    message: issue.message,
    ...(issue.clipId ? { clipId: issue.clipId } : {}),
    atSec: issue.firstFrame === issue.lastFrame ? r2(issue.firstFrame / fps) : [r2(issue.firstFrame / fps), r2(issue.lastFrame / fps)],
  }));
  return { samples, layout, seenClips, failed, probes: rows.filter((r) => r.contrast).length };
};
export type CheckOptions = {
  /** What the video is for: pace and mood are judged against its energy words. */
  brief?: string;
  /** Target length in seconds. */
  target?: number;
  /** Timeline checks only, no frames rendered. */
  fast?: boolean;
  /** Seconds between measured frames. */
  every?: number;
  /** TikTok/Reels/Shorts interface zones (default: on for vertical video). */
  safeArea?: boolean;
  /** Folder for a contact sheet of the measured frames. */
  sheetDir?: string;
};

const lengthFinding = (durationSec: number, target: number): Finding => ({
  check: "frames",
  severity: "warning",
  message: `Runs ${durationSec.toFixed(1)} s but the brief asks for ${target.toFixed(0)} s.`,
});

/** Every check on one project (saved or only in memory); `passed` when no error-level finding remains. */
export const runChecks = async (ctx: CliContext, project: Project, opts: CheckOptions = {}) => {
  const started = Date.now();
  const { width: W, height: H, fps } = project.settings;
  const total = getProjectDuration(project);
  const durationSec = total / fps;
  const brief = opts.brief ?? "";
  const target = opts.target;
  if (target !== undefined && !(target > 0)) throw usage("--target must be above 0 seconds");

  const findings: Finding[] = [];
  // The timeline itself: the linter, words on screen, photos, repeated layouts, the soundtrack.
  const lint = lintProject(project);
  findings.push(
    ...lintText(project).map((i) => fromLint(i, "text")),
    ...strings("photos", "warning", measurePhotoMotion(project)),
    ...strings("reuse", "warning", measureReuse(project)),
    ...strings("sound", "warning", measureSound(project, durationSec)),
  );
  try {
    findings.push(...strings("mix", "warning", await measureMix(project, audioProfiles(ctx.appRoot))));
  } catch (err) {
    ctx.log(`Skipped the mix check: ${err instanceof Error ? err.message : err}`);
  }

  let sampled: Record<string, unknown> = { frames: 0 };
  let sheet: string | undefined;
  let measured = new Set<string>();
  if (!opts.fast) {
    const every = opts.every ?? (durationSec > 300 ? Math.ceil(durationSec / 300) : 1);
    if (!(every > 0)) throw usage("--every must be above 0");
    const frames: number[] = [];
    for (let sec = 0; sec < durationSec; sec += every) frames.push(Math.min(total - 1, Math.round((sec + Math.min(0.5, every / 2)) * fps)));
    const safeArea = opts.safeArea ?? H / W >= 1.5;
    const { samples, layout, seenClips, failed, probes } = await measureFrameChecks(ctx, project, frames, {
      scale: Math.min(1, 480 / W),
      safeArea,
    });
    measured = seenClips;
    findings.push(...layout);
    const prints = samples.map((s) => s.print);
    // Holds, empty stretches, repeats and pace count seconds: they need one frame a second.
    if (every === 1) {
      findings.push(...strings("frames", "warning", measureFrames(prints, durationSec, target)));
      if (brief) findings.push(...strings("pace", "warning", measurePace(prints, durationSec, brief)));
    }
    const looks = samples.map((s) => ({ frame: s.frame, pixels: s.pixels }));
    findings.push(
      ...strings("mood", "warning", measureMood(project, looks, isEnergetic(brief))),
      ...strings("look", "warning", measureLook(project, looks)),
    );
    sampled = { frames: samples.length, everySec: every, textProbes: probes, ...(failed ? { failedFrames: failed } : {}), safeArea };
    if (opts.sheetDir) {
      await fs.mkdir(opts.sheetDir, { recursive: true });
      const step = Math.max(1, Math.round(samples.length / 16));
      sheet = path.join(opts.sheetDir, `${project.id}-check-sheet.jpg`);
      await fs.writeFile(
        sheet,
        await contactSheet(samples.filter((_, i) => i % step === 0).map((s) => ({ png: s.png, label: clock(s.frame / fps) }))),
      );
    }
  }
  // measureFrames only weighs the length at one frame a second.
  if (target !== undefined && Math.abs(durationSec - target) / target > 0.08 && !findings.some((f) => f.message.startsWith("Runs ")))
    findings.push(lengthFinding(durationSec, target));
  // Estimates the measured frames answered exactly give way to the measurement, and the linter's
  // one-line soundtrack verdicts to the sound check's fuller ones.
  const soundSaid = findings.some((f) => f.check === "sound");
  findings.unshift(
    ...lint
      .filter((i) => !(i.clipId && measured.has(i.clipId) && ESTIMATED_LAYOUT.has(i.code)))
      .filter((i) => !(soundSaid && SOUND_VERDICTS.has(i.code)))
      .map((i) => fromLint(i)),
  );

  const rank: Record<Severity, number> = { error: 0, warning: 1, tip: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
  const count = (s: Severity) => findings.filter((f) => f.severity === s).length;
  return {
    projectId: project.id,
    durationSec: r2(durationSec),
    passed: count("error") === 0,
    summary: { errors: count("error"), warnings: count("warning"), tips: count("tip") },
    findings,
    sampled,
    ...(sheet ? { sheet } : {}),
    elapsedSec: r2((Date.now() - started) / 1000),
  };
};

/** `--strict`: a failed check is the command's failure (exit 6), with the full result attached. */
export const strictFailure = (result: Awaited<ReturnType<typeof runChecks>>) =>
  new CliError(
    "E_CHECK",
    `${result.summary.errors} problem${result.summary.errors > 1 ? "s" : ""} to fix`,
    result,
    "Fix the error-level findings (each names its clip and time), then check again.",
  );

export const checkCommand: Command = {
  name: "check",
  summary:
    "Measure what a viewer would notice: text off-frame, cut off, overlapping, unreadable or under the app's buttons, letters a font lacks, holds, pace, look, sound and mix",
  usage: 'reframer check <project> [--brief "energetic promo"] [--target 30] [--fast] [--strict] [--sheet]',
  flags: {
    brief: { type: "string", description: "What the video is for; pace and mood are judged against its energy words" },
    target: { type: "number", description: "Target length in seconds" },
    fast: { type: "boolean", description: "Timeline checks only (no frames rendered): seconds instead of a minute" },
    every: { type: "number", description: "Seconds between measured frames (default 1; videos over 5 min space them out)" },
    "safe-area": { type: "boolean", description: "Check vertical video against TikTok/Reels/Shorts UI (default on for 9:16)" },
    strict: { type: "boolean", description: "Exit with code 6 (E_CHECK) when an error-level finding remains" },
    sheet: { type: "boolean", description: "Also write a labelled contact sheet of the measured frames" },
    out: { type: "string", alias: "o", description: "Folder for the contact sheet (default: the project's renders folder)" },
  },
  examples: [
    "reframer check proj_x",
    'reframer check proj_x --brief "calm explainer" --target 45 --strict',
    "reframer check proj_x --fast",
  ],
  run: async (ctx, { positionals, flags }) => {
    const project = await resolveProject(positionals[0]);
    const result = await runChecks(ctx, project, {
      brief: flags.brief as string | undefined,
      target: flags.target as number | undefined,
      fast: Boolean(flags.fast),
      every: flags.every as number | undefined,
      safeArea: flags.safeArea as boolean | undefined,
      sheetDir: flags.sheet ? (flags.out ? ctx.resolvePath(String(flags.out)) : path.join(RENDERS_DIR, project.id, "checks")) : undefined,
    });
    if (flags.strict && !result.passed) throw strictFailure(result);
    return result;
  },
};
