import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { assertSafeId, mediaDir, safeFileName } from "@/server/paths";

type Ctx = { params: Promise<{ projectId: string; file: string }> };

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".cube": "text/plain; charset=utf-8",
};

/** Serves project media with HTTP Range support (required for fast video seeking). */
export async function GET(request: Request, ctx: Ctx) {
  const { projectId, file } = await ctx.params;
  const fileName = safeFileName(decodeURIComponent(file));
  const filePath = path.join(mediaDir(assertSafeId(projectId)), fileName);
  let size: number;
  try {
    size = (await fs.stat(filePath)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const type = MIME[path.extname(fileName).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=31536000, immutable",
    "Access-Control-Allow-Origin": "*",
  };

  const range = request.headers.get("range");
  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    if (!match) return new Response("Bad range", { status: 416 });
    let start = match[1] ? Number(match[1]) : 0;
    let end = match[2] ? Number(match[2]) : size - 1;
    if (!match[1] && match[2]) {
      // Suffix range: last N bytes.
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    }
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
