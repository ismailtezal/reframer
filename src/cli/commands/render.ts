import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BUILTIN_PRESETS, EXTENSION, type ExportSettings, normalizeExportSettings } from "@/core/export";
import { getProjectDuration } from "@/core/project-utils";
import type { Project } from "@/core/schema";
import { RENDERS_DIR } from "@/server/paths";
import { cancelRender, getJob, startRender } from "@/server/render";
import { parseNumberList } from "../args";
import type { Command } from "../command";
import { type CliContext, resolveProject } from "../context";
import { CliError, usage } from "../errors";
import { startMediaServer } from "../media-server";
import { contactSheet } from "../sharp";
import { openStillSession } from "../stills";

const r2 = (n: number) => Math.round(n * 100) / 100;
const clock = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, "0")}`;

/**
 * Lower the CPU priority of this process and everything it starts (render processes, Chrome, FFmpeg
 * inherit it), so a render in the background doesn't take frames from a game or a call.
 */
const lowerPriority = (level: string, ctx: CliContext) => {
  const p = os.constants.priority;
  const value = level === "idle" ? p.PRIORITY_LOW : level === "low" ? p.PRIORITY_BELOW_NORMAL : null;
  if (value === null) return;
  try {
    os.setPriority(0, value);
  } catch (err) {
    ctx.log(`Couldn't lower the priority (${err instanceof Error ? err.message : err}); rendering at normal priority.`);
  }
};

export const stillCommand: Command = {
  name: "still",
  summary: "Render frames as PNG (and optionally one contact sheet): how an agent sees its work",
  usage: "reframer still <project> [--frames 0,30,90 | --at 1.5,3 | --every 2] [--out <dir>] [--scale 0.5] [--sheet]",
  flags: {
    frames: { type: "list", description: "Frame numbers (ranges too: 0-90:30)" },
    at: { type: "list", description: "Times in seconds" },
    every: { type: "number", description: "A frame every N seconds across the video" },
    count: { type: "number", description: "N frames evenly across the video (default 6 when nothing else is given)" },
    out: { type: "string", alias: "o", description: "Folder for the PNGs (default: the project's renders/stills folder)" },
    scale: { type: "number", description: "Size factor, e.g. 0.5 for half size (default 1)" },
    sheet: { type: "boolean", description: "Also tile the frames into one labelled contact sheet (JPEG)" },
  },
  examples: ["reframer still proj_x --frames 0,30,90", "reframer still proj_x --every 2 --scale 0.5 --sheet"],
  run: async (ctx, { positionals, flags }) => {
    const project = await resolveProject(positionals[0]);
    const fps = project.settings.fps;
    const total = getProjectDuration(project);
    let frames: number[] = [];
    if (flags.frames) frames.push(...parseNumberList(flags.frames as string[], "frames").map(Math.round));
    if (flags.at) frames.push(...parseNumberList(flags.at as string[], "at").map((s) => Math.round(s * fps)));
    if (typeof flags.every === "number") {
      if (!(flags.every > 0)) throw usage("--every must be above 0");
      for (let s = 0; s * fps < total; s += flags.every) frames.push(Math.round(s * fps));
    }
    if (!frames.length) {
      const n = Math.max(1, Math.min(60, Math.round((flags.count as number | undefined) ?? 6)));
      frames = Array.from({ length: n }, (_, i) => Math.min(total - 1, Math.round(((i + 0.5) * total) / n)));
    }
    frames = [...new Set(frames.map((f) => Math.max(0, Math.min(total - 1, f))))].sort((a, b) => a - b);
    if (frames.length > 120) throw usage(`That's ${frames.length} frames; ask for at most 120 (use --every with a larger step).`);
    const scale = (flags.scale as number | undefined) ?? 1;
    if (!(scale > 0 && scale <= 2)) throw usage("--scale must be above 0 and at most 2");
    const outDir = flags.out ? ctx.resolvePath(String(flags.out)) : path.join(RENDERS_DIR, project.id, "stills");
    await fs.mkdir(outDir, { recursive: true });

    const session = await openStillSession(ctx, project);
    const done: { frame: number; timeSec: number; path: string; png: Buffer }[] = [];
    try {
      for (const frame of frames) {
        ctx.log(`Frame ${frame} (${clock(frame / fps)})…`);
        const png = await session.png(frame, { scale });
        const file = path.join(outDir, `${project.id}-f${String(frame).padStart(5, "0")}.png`);
        await fs.writeFile(file, png);
        done.push({ frame, timeSec: r2(frame / fps), path: file, png });
      }
    } finally {
      await session.close();
    }
    let sheet: string | undefined;
    if (flags.sheet) {
      sheet = path.join(outDir, `${project.id}-sheet.jpg`);
      await fs.writeFile(sheet, await contactSheet(done.map((d) => ({ png: d.png, label: `${d.frame} · ${clock(d.timeSec)}` }))));
    }
    return {
      projectId: project.id,
      size: { width: Math.round(project.settings.width * scale), height: Math.round(project.settings.height * scale) },
      frames: done.map(({ png: _png, ...d }) => d),
      ...(sheet ? { sheet } : {}),
    };
  },
};

const FORMATS = Object.keys(EXTENSION);

/** Export settings from flags, on top of a preset. */
export const exportSettingsFromFlags = (flags: Record<string, unknown>): ExportSettings => {
  const presetId = flags.preset as string | undefined;
  const preset = presetId ? BUILTIN_PRESETS.find((p) => p.id === presetId) : undefined;
  if (presetId && !preset) throw usage(`Unknown --preset "${presetId}"`, `Presets: ${BUILTIN_PRESETS.map((p) => p.id).join(", ")}`);
  const s: Partial<ExportSettings> = { ...preset?.settings };
  if (flags.format) {
    if (!FORMATS.includes(String(flags.format))) throw usage(`Unknown --format "${flags.format}"`, `Formats: ${FORMATS.join(", ")}`);
    s.format = flags.format as ExportSettings["format"];
  }
  if (flags.codec) s.videoCodec = flags.codec as ExportSettings["videoCodec"];
  if (flags.resolution !== undefined) s.resolution = flags.resolution === "project" ? "project" : Number(flags.resolution);
  if (typeof flags.crf === "number") s.crf = flags.crf;
  if (flags.speed) s.speed = flags.speed as ExportSettings["speed"];
  if (flags.audio === false) s.includeAudio = false;
  if (flags.loudness !== undefined) s.loudness = flags.loudness === "off" ? null : Number(flags.loudness);
  if (typeof flags.parallelism === "number") s.parallelism = flags.parallelism;
  if (flags.hardware) s.hardware = flags.hardware as ExportSettings["hardware"];
  return normalizeExportSettings(s);
};

export const RENDER_FLAGS: Command["flags"] = {
  out: { type: "string", alias: "o", description: "Output file (default: the project's renders folder)" },
  preset: { type: "string", description: `Export preset: ${BUILTIN_PRESETS.map((p) => p.id).join(", ")}` },
  format: { type: "string", description: `Container: ${FORMATS.join(", ")} (default mp4; from --out's extension when given)` },
  codec: { type: "string", description: "Video codec: h264, h265, vp9, prores" },
  resolution: { type: "string", description: 'Short side in px (1080, 720, …) or "project"' },
  crf: { type: "number", description: "Constant quality, 0–51, lower is better (default 18)" },
  speed: { type: "string", description: "Encoder speed: fastest, fast, balanced, smallest" },
  audio: { type: "boolean", description: "Include sound (--no-audio for picture only)" },
  loudness: { type: "string", description: 'Normalize to this LUFS (default -14) or "off"' },
  parallelism: { type: "number", description: "Render processes (default: sized to the machine)" },
  hardware: { type: "string", description: "NVIDIA encoding: auto, on, off" },
  priority: { type: "string", description: "normal, low (below normal; a game keeps its FPS) or idle" },
};

/** Renders a project to a file with the app's export pipeline; resolves when the file is written. */
export const renderProject = async (
  ctx: CliContext,
  project: Project,
  flags: Record<string, unknown>,
  opts: { from?: number; to?: number } = {},
) => {
  const out = flags.out ? ctx.resolvePath(String(flags.out)) : undefined;
  const ext = out ? path.extname(out).slice(1).toLowerCase() : "";
  if (out && !flags.format && FORMATS.includes(ext)) flags.format = ext;
  const priority = String(flags.priority ?? "normal");
  if (!["normal", "low", "idle"].includes(priority)) throw usage("--priority is normal, low or idle");
  if (priority !== "normal" && flags.parallelism === undefined) flags.parallelism = 2;
  const settings = exportSettingsFromFlags(flags);
  const fps = project.settings.fps;
  const total = getProjectDuration(project);
  const from = opts.from !== undefined ? Math.max(0, Math.round(opts.from * fps)) : undefined;
  const to = opts.to !== undefined ? Math.min(total - 1, Math.round(opts.to * fps) - 1) : undefined;
  if (from !== undefined && to !== undefined && to < from) throw usage("--to must come after --from");
  lowerPriority(priority, ctx);
  if (out) await fs.mkdir(path.dirname(out), { recursive: true });

  const media = await startMediaServer(ctx.appRoot);
  const started = Date.now();
  const job = startRender({
    project,
    origin: media.origin,
    settings,
    range: from !== undefined || to !== undefined ? [from ?? 0, to ?? total - 1] : undefined,
    outputPath: out,
  });
  const onSignal = () => cancelRender(job.id);
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  let lastLog = 0;
  let lastStage = "";
  try {
    for (;;) {
      await new Promise((r) => setTimeout(r, 400));
      const j = getJob(job.id);
      if (!j) throw new CliError("E_RENDER", "The render job disappeared");
      const now = Date.now();
      if (j.stage !== lastStage && (now - lastLog > 1500 || !j.stage.startsWith("Rendering frame"))) {
        ctx.log(
          `${Math.round(j.progress * 100)}% · ${j.stage}${j.fps ? ` · ${j.fps} fps` : ""}${j.etaSec !== undefined ? ` · ${j.etaSec}s left` : ""}`,
        );
        lastLog = now;
        lastStage = j.stage;
      }
      if (j.status === "done") {
        const stat = await fs.stat(j.outputPath);
        return {
          projectId: project.id,
          path: j.outputPath,
          sizeBytes: stat.size,
          durationSec: r2(j.totalFrames / fps),
          elapsedSec: r2((Date.now() - started) / 1000),
          summary: j.summary,
          ...(j.engine ? { engine: j.engine } : {}),
          priority,
        };
      }
      if (j.status === "error") throw new CliError("E_RENDER", j.error ?? "The render failed");
      if (j.status === "cancelled") throw new CliError("E_RENDER", "The render was cancelled");
    }
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    await media.close();
  }
};

export const renderToFile = async (
  ctx: CliContext,
  projectRef: string | undefined,
  flags: Record<string, unknown>,
  opts: { from?: number; to?: number } = {},
) => renderProject(ctx, await resolveProject(projectRef), flags, opts);

export const renderCommand: Command = {
  name: "render",
  summary: "Export a project to a video (or audio) file, headless; --priority low keeps a game's FPS",
  usage: "reframer render <project> [--out x.mp4] [--priority low] [--preset social] [--from 0 --to 10]",
  flags: {
    ...RENDER_FLAGS,
    from: { type: "number", description: "Start at this second" },
    to: { type: "number", description: "End at this second" },
  },
  examples: ["reframer render proj_x --out recap.mp4 --priority low", "reframer render proj_x --preset gif --from 0 --to 4 --out loop.gif"],
  run: async (ctx, { positionals, flags }) =>
    renderToFile(ctx, positionals[0], flags, { from: flags.from as number | undefined, to: flags.to as number | undefined }),
};
