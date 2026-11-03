import { mediaTypeFromName, normalizeMediaType, sniffMediaType } from "@/core/media-types";
import { fetchPublic, USER_AGENT } from "@/server/net";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024 * 1024;
const MEDIA = /^(video|audio|image)\//;

/** Reads a stream's first bytes, returning them and a stream that still starts at byte 0. */
const peek = async (body: ReadableStream<Uint8Array>, bytes: number) => {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < bytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  const head = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    head.set(c, at);
    at += c.byteLength;
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (head.byteLength) controller.enqueue(head);
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return { head, stream, cancel: () => reader.cancel().catch(() => undefined) };
};

/**
 * Proxies a public media URL for import (avoids CORS). Only media is passed through, typed by its
 * bytes: hosts label music as application/octet-stream or application/ogg.
 */
export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return Response.json({ error: "url required" }, { status: 400 });
  try {
    const upstream = await fetchPublic(target, { headers: { "User-Agent": USER_AGENT }, signal: request.signal });
    if (!upstream.ok || !upstream.body) return Response.json({ error: `The server answered ${upstream.status}.` }, { status: 502 });
    const declared = normalizeMediaType(upstream.headers.get("content-type") ?? "");
    const { head, stream, cancel } = await peek(upstream.body, 64);
    // Text (an HTML error page, say) is never media, whatever the link's extension says.
    const type =
      sniffMediaType(head) ??
      (MEDIA.test(declared) ? declared : declared.startsWith("text/") ? null : mediaTypeFromName(new URL(target).pathname));
    if (!type || !MEDIA.test(type)) {
      await cancel();
      return Response.json({ error: `That link isn't a video, audio file or image (${declared || "unknown type"}).` }, { status: 415 });
    }
    if (type === "image/svg+xml") {
      await cancel();
      return Response.json({ error: "SVG links can't be imported; download and drop the file instead." }, { status: 415 });
    }
    // fetch() decompresses, so a compressed response's length isn't the length we send.
    const length = upstream.headers.get("content-encoding") ? 0 : Number(upstream.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) {
      await cancel();
      return Response.json({ error: "That file is larger than 2 GB." }, { status: 413 });
    }
    return new Response(stream, {
      headers: {
        "Content-Type": type,
        ...(length ? { "Content-Length": String(length) } : {}),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
