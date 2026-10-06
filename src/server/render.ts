import "server-only";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Project } from "@/core/schema";
import { assertSafeId, CACHE_DIR, RENDERS_DIR } from "./paths";
import { readSettings } from "./settings";

/**
 * Final renders run here, on the user's machine, with Remotion's renderer:
 * the same React composition the editor previews, drawn by headless Chrome
 * and encoded with FFmpeg. Full CSS support, frame-exact output.
 */

export type RenderFormat = "mp4" | "webm" | "gif" | "prores";
export type RenderQuality = "standard" | "high" | "max";

export type RenderJob = {
  id: string;
  projectId: string;
  status: "preparing" | "rendering" | "done" | "error" | "cancelled";
  progress: number;
  stage: string;
  fileName: string;
  outputPath: string;
  startedAt: number;
  finishedAt?: number;
  error?: string;
  sizeBytes?: number;
};

type Internal = RenderJob & { cancel?: () => void; cancelled?: boolean };

const g = globalThis as unknown as { __reframerRenders?: Map<string, Internal>; __reframerBundle?: { key: string; url: Promise<string> } };
const jobs: Map<string, Internal> = g.__reframerRenders ?? new Map();
g.__reframerRenders = jobs;

const SOURCE_DIRS = ["src/remotion", "src/core"];

/** Changes whenever the composition's source changes, so dev edits are picked up. */
const sourceKey = async (): Promise<string> => {
  const hash = createHash("sha1");
  const walk = async (dir: string) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else hash.update(`${full}:${(await fs.stat(full)).mtimeMs}`);
    }
  };
  for (const d of SOURCE_DIRS) await walk(path.join(/*turbopackIgnore: true*/ process.cwd(), d)).catch(() => undefined);
  return hash.digest("hex").slice(0, 12);
};

const getServeUrl = async (onProgress: (p: number) => void): Promise<string> => {
  // Packaged desktop builds ship a prebuilt bundle (scripts/bundle-remotion.mjs).
  const prebuilt = process.env.REFRAMER_REMOTION_BUNDLE;
  if (prebuilt) return prebuilt;
  const key = await sourceKey();
  if (g.__reframerBundle?.key !== key) {
    const url = (async () => {
      const { bundle } = await import("@remotion/bundler");
      return bundle({
        entryPoint: path.join(/*turbopackIgnore: true*/ process.cwd(), "src/remotion/index.ts"),
        onProgress,
        outDir: path.join(CACHE_DIR, `remotion-bundle-${key}`),
        webpackOverride: (config) => ({
          ...config,
          resolve: {
            ...config.resolve,
            alias: {
              ...(config.resolve?.alias as Record<string, string> | undefined),
              "@": path.join(/*turbopackIgnore: true*/ process.cwd(), "src"),
            },
          },
        }),
      });
    })();
    g.__reframerBundle = { key, url };
    url.catch(() => {
      if (g.__reframerBundle?.url === url) g.__reframerBundle = undefined;
    });
  }
  return (g.__reframerBundle as { url: Promise<string> }).url;
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "video";

const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

const EXT: Record<RenderFormat, string> = { mp4: "mp4", webm: "webm", gif: "gif", prores: "mov" };

const update = (job: Internal, patch: Partial<RenderJob>) => Object.assign(job, patch);

const run = async (
  job: Internal,
  opts: { project: Project; origin: string; format: RenderFormat; quality: RenderQuality; scale: number; range?: [number, number] },
) => {
  const { renderMedia, selectComposition, makeCancelSignal, ensureBrowser } = await import("@remotion/renderer");
  const settings = await readSettings();

  const serveUrl = await getServeUrl((p) => update(job, { stage: `Preparing the renderer… ${Math.round(p)}%` }));
  if (job.cancelled) return;

  update(job, { stage: "Starting Chrome…" });
  await ensureBrowser({
    onBrowserDownload: () => ({
      version: null,
      onProgress: ({ percent }) =>
        update(job, { stage: `Downloading Chrome for rendering (first time only)… ${Math.round(percent * 100)}%` }),
    }),
  });
  if (job.cancelled) return;

  const inputProps = { project: opts.project, editor: false, mediaBaseUrl: opts.origin };
  const composition = await selectComposition({ serveUrl, id: "reframer", inputProps });
  const { cancelSignal, cancel } = makeCancelSignal();
  job.cancel = cancel;
  update(job, { status: "rendering", stage: "Rendering…" });
  await fs.mkdir(path.dirname(job.outputPath), { recursive: true });

  const crf =
    opts.format === "webm" ? { standard: 34, high: 28, max: 20 }[opts.quality] : { standard: 23, high: 18, max: 14 }[opts.quality];
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    outputLocation: job.outputPath,
    codec: opts.format === "mp4" ? "h264" : opts.format === "webm" ? "vp9" : opts.format === "gif" ? "gif" : "prores",
    ...(opts.format === "prores" ? { proResProfile: "hq" as const } : opts.format === "gif" ? { everyNthFrame: 2 } : { crf }),
    scale: opts.format === "gif" ? Math.min(opts.scale, 0.5) : opts.scale,
    frameRange: opts.range ?? null,
    imageFormat: "jpeg",
    jpegQuality: opts.quality === "standard" ? 85 : 95,
    cancelSignal,
    overwrite: true,
    ...(settings.remotionLicenseKey ? { licenseKey: settings.remotionLicenseKey } : {}),
    onProgress: ({ progress, renderedFrames, encodedFrames, stitchStage }) => {
      const total = composition.durationInFrames;
      update(job, {
        progress,
        stage:
          stitchStage === "muxing"
            ? "Adding audio…"
            : encodedFrames < renderedFrames
              ? `Rendering frame ${renderedFrames} of ${total}`
              : `Encoding frame ${encodedFrames} of ${total}`,
      });
    },
  });
  const stat = await fs.stat(job.outputPath);
  update(job, { status: "done", progress: 1, stage: "Done", finishedAt: Date.now(), sizeBytes: stat.size });
};

export const startRender = (opts: {
  project: Project;
  origin: string;
  format: RenderFormat;
  quality: RenderQuality;
  scale: number;
  range?: [number, number];
}): RenderJob => {
  const projectId = assertSafeId(opts.project.id);
  const fileName = `${slug(opts.project.name)}-${stamp()}.${EXT[opts.format]}`;
  const job: Internal = {
    id: randomUUID(),
    projectId,
    status: "preparing",
    progress: 0,
    stage: "Preparing…",
    fileName,
    outputPath: path.join(RENDERS_DIR, projectId, fileName),
    startedAt: Date.now(),
  };
  jobs.set(job.id, job);
  run(job, opts).catch((err: unknown) => {
    if (job.cancelled) update(job, { status: "cancelled", stage: "Cancelled", finishedAt: Date.now() });
    else update(job, { status: "error", error: err instanceof Error ? err.message : String(err), stage: "Failed", finishedAt: Date.now() });
  });
  return publicJob(job);
};

export const publicJob = (job: Internal): RenderJob => {
  const { cancel: _cancel, cancelled: _cancelled, ...rest } = job;
  return rest;
};

export const getJob = (id: string): RenderJob | undefined => {
  const job = jobs.get(id);
  return job ? publicJob(job) : undefined;
};

export const getJobInternal = (id: string) => jobs.get(id);

export const latestJobFor = (projectId: string): RenderJob | undefined => {
  const list = [...jobs.values()].filter((j) => j.projectId === projectId).sort((a, b) => b.startedAt - a.startedAt);
  return list[0] ? publicJob(list[0]) : undefined;
};

export const cancelRender = (id: string) => {
  const job = jobs.get(id);
  if (!job || job.status === "done" || job.status === "error") return false;
  job.cancelled = true;
  job.cancel?.();
  update(job, { status: "cancelled", stage: "Cancelled", finishedAt: Date.now() });
  return true;
};
