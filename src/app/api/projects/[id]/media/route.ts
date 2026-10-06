import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { warmDerived } from "@/server/derived";
import { assertSafeId, mediaDir, safeFileName } from "@/server/paths";

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB

/**
 * Streams the raw request body to disk (no buffering, works for multi-GB
 * footage). Headers: `x-file-name`, `x-asset-id`. Returns the media URL.
 */
export async function POST(request: Request, ctx: Ctx) {
  const id = assertSafeId((await ctx.params).id);
  const assetId = assertSafeId(request.headers.get("x-asset-id") ?? "");
  const original = decodeURIComponent(request.headers.get("x-file-name") ?? "upload.bin");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return Response.json({ error: "File too large" }, { status: 413 });
  if (!request.body) return Response.json({ error: "Empty body" }, { status: 400 });

  const dir = mediaDir(id);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${assetId}-${safeFileName(original)}`;
  const target = path.join(dir, fileName);
  await pipeline(Readable.fromWeb(request.body as unknown as NodeReadableStream), createWriteStream(target));
  const stat = await fs.stat(target);
  // Probe, poster, filmstrip and waveform start right away, in the background.
  warmDerived(id, fileName);
  return Response.json({ src: `/api/media/${id}/${encodeURIComponent(fileName)}`, size: stat.size, fileName });
}
