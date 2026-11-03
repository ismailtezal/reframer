import { createWriteStream, existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { produce } from "immer";
import { newId } from "@/core/ids";
import { mediaTypeFromName, normalizeMediaType, sniffMediaType, withMediaExtension } from "@/core/media-types";
import { addAsset } from "@/core/ops";
import type { Asset } from "@/core/schema";
import { getPoster, getProbe } from "@/server/derived";
import { mediaDir, safeFileName } from "@/server/paths";
import type { Command } from "../command";
import { type CliContext, resolveProject, saveProject } from "../context";
import { CliError, invalid, notFound, usage } from "../errors";
import { isOpenInEditor } from "../live";
import { loadSharp } from "../sharp";

/**
 * Media into a project without the window: files are copied into the project's media folder (named the
 * way the app's uploads are), measured (FFmpeg for video and sound, libvips for images) and added as
 * assets, so `add_clips` can use them right away. URLs are downloaded first.
 */

const MAX_BYTES = 8 * 1024 * 1024 * 1024;

const kindOf = (type: string, name: string): Asset["type"] | null => {
  if (/\.cube$/i.test(name)) return "lut";
  const t = normalizeMediaType(type);
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("image/")) return "image";
  return null;
};

/** The first bytes of a file, for its format when the name doesn't tell. */
const head = async (file: string) => {
  const handle = await fs.open(file, "r");
  try {
    const buf = Buffer.alloc(64);
    const { bytesRead } = await handle.read(buf, 0, 64, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

/** Downloads a URL into the media folder; returns the stored file name and its type. */
const download = async (url: string, dir: string, assetId: string) => {
  const res = await fetch(url, { redirect: "follow" }).catch((err) => {
    throw new CliError("E_ENV", `Couldn't download ${url}: ${err instanceof Error ? err.message : err}`);
  });
  if (!res.ok || !res.body) throw notFound(`Downloading ${url} failed (${res.status})`);
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) throw invalid(`${url} is over 8 GB`);
  const type = normalizeMediaType(res.headers.get("content-type") ?? "");
  const disposition = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get("content-disposition") ?? "")?.[1];
  const fromPath = decodeURIComponent(new URL(url).pathname.split("/").pop() || "download");
  const original = withMediaExtension(disposition ? decodeURIComponent(disposition) : fromPath, type);
  const fileName = `${assetId}-${safeFileName(original)}`;
  await pipeline(Readable.fromWeb(res.body as unknown as NodeReadableStream), createWriteStream(path.join(dir, fileName)));
  return { fileName, original, type };
};

const importOne = async (ctx: CliContext, projectId: string, input: string, name?: string): Promise<Asset> => {
  const dir = mediaDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  const id = newId("asset");
  const isUrl = /^https?:\/\//i.test(input);
  let fileName: string;
  let original: string;
  let type: string;
  if (isUrl) {
    ctx.log(`Downloading ${input}…`);
    ({ fileName, original, type } = await download(input, dir, id));
  } else {
    const source = ctx.resolvePath(input);
    if (!existsSync(source)) throw notFound(`No file at ${source}`);
    const stat = await fs.stat(source);
    if (!stat.isFile()) throw usage(`${source} isn't a file`);
    if (stat.size > MAX_BYTES) throw invalid(`${source} is over 8 GB`);
    original = path.basename(source);
    fileName = `${id}-${safeFileName(original)}`;
    ctx.log(`Copying ${original} (${(stat.size / 1e6).toFixed(1)} MB)…`);
    await fs.copyFile(source, path.join(dir, fileName));
    type = mediaTypeFromName(original) ?? "";
  }
  const stored = path.join(dir, fileName);
  if (!type || type === "application/octet-stream") type = sniffMediaType(await head(stored)) ?? mediaTypeFromName(original) ?? "";
  const kind = kindOf(type, original);
  if (!kind) {
    await fs.rm(stored, { force: true });
    throw invalid(`${original} isn't a video, sound, image or LUT file Reframer can use`, { type: type || "unknown" });
  }
  const src = `/api/media/${projectId}/${encodeURIComponent(fileName)}`;
  const size = (await fs.stat(stored)).size;
  const asset: Asset = {
    id,
    type: kind,
    name: name ?? original,
    src,
    mimeType: type,
    size,
    source: isUrl ? "url" : "upload",
    createdAt: Date.now(),
    ...(isUrl ? { origin: { url: input } } : {}),
  };
  if (kind === "video" || kind === "audio") {
    const info = await getProbe(projectId, fileName).catch((err) => {
      throw invalid(`FFmpeg can't read ${original}: ${err instanceof Error ? err.message : err}`);
    });
    // A video file with no picture (a podcast export) is a sound.
    asset.type = info.hasVideo && kind === "video" ? "video" : "audio";
    asset.durationSec = info.durationSec;
    asset.hasAudio = info.hasAudio;
    if (asset.type === "video") {
      asset.width = info.width;
      asset.height = info.height;
      asset.fps = info.fps;
    }
  } else if (kind === "image") {
    const meta = await (await loadSharp())(stored).metadata();
    asset.width = meta.autoOrient?.width ?? meta.width;
    asset.height = meta.autoOrient?.height ?? meta.height;
  }
  if (asset.type === "video" || asset.type === "image") {
    // The poster the editor shows in its media bin, made now rather than on first open.
    await getPoster(projectId, fileName).catch(() => undefined);
    asset.thumbnail = `/api/derived/${projectId}/${encodeURIComponent(fileName)}?kind=poster&v=1`;
  }
  return asset;
};

export const importCommand: Command = {
  name: "import",
  summary: "Add media to a project (files or URLs): copied in, measured and ready for add_clips",
  usage: "reframer import <project> <file | url>... [--name <name>]",
  flags: {
    name: { type: "string", description: "Asset name (with one file; default: the file name)" },
    headless: { type: "boolean", description: "Write the project even when it's open in an editor" },
  },
  examples: ["reframer import proj_x ./broll/*.mp4 music.mp3", "reframer import proj_x https://example.com/logo.png --name Logo"],
  run: async (ctx, { positionals, flags }) => {
    const project = await resolveProject(positionals[0]);
    const inputs = positionals.slice(1);
    if (!inputs.length) throw usage("Name at least one file or URL to import");
    if (flags.name && inputs.length > 1) throw usage("--name works with one file at a time");
    const live = flags.headless ? null : await isOpenInEditor(project.id);
    if (live)
      throw new CliError(
        "E_CONFLICT",
        `${project.name} is open in an editor (${live.origin}), which would save over the import`,
        undefined,
        "Import from the editor's media bin, close the project, or pass --headless.",
      );
    // All or nothing: a missing file stops the import before anything is copied.
    const missing = inputs.filter((i) => !/^https?:\/\//i.test(i) && !existsSync(ctx.resolvePath(i)));
    if (missing.length)
      throw new CliError(
        "E_NOT_FOUND",
        `No file at ${missing.map((m) => ctx.resolvePath(m)).join(", ")}`,
        { missing },
        "Nothing was imported.",
      );
    const assets: Asset[] = [];
    try {
      for (const input of inputs) assets.push(await importOne(ctx, project.id, input, flags.name as string | undefined));
    } catch (err) {
      // Nothing is saved, so the files already copied would only be litter.
      await Promise.all(
        assets.map((a) => fs.rm(path.join(mediaDir(project.id), decodeURIComponent(a.src.split("/").pop() ?? "")), { force: true })),
      );
      if (err instanceof CliError) throw new CliError(err.code, `${err.message} (nothing was imported)`, err.details, err.hint);
      throw err;
    }
    const next = produce(project, (d) => {
      for (const a of assets) addAsset(d, a);
    });
    await saveProject(project, next, `import ${assets.length} file${assets.length > 1 ? "s" : ""}`);
    return {
      projectId: project.id,
      imported: assets.map((a) => ({
        assetId: a.id,
        type: a.type,
        name: a.name,
        ...(a.durationSec !== undefined ? { durationSec: Math.round(a.durationSec * 100) / 100 } : {}),
        ...(a.width ? { size: `${a.width}x${a.height}` } : {}),
        ...(a.hasAudio !== undefined ? { hasAudio: a.hasAudio } : {}),
      })),
      next: 'Place them with apply: [{"op":"add_clips","clips":[{"type":"video","assetId":"…","startSec":0,"durationSec":5}]}]',
    };
  },
};
