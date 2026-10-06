import { fetchPublic } from "@/server/net";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024 * 1024;
const MEDIA = /^(video|audio|image)\//;
const EXT = /\.(mp4|mov|webm|mkv|m4v|mp3|wav|m4a|aac|ogg|flac|png|jpe?g|webp|gif|avif)(\?|$)/i;

/** Proxies a public media URL for import (avoids CORS). Only media responses are passed through. */
export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return Response.json({ error: "url required" }, { status: 400 });
  try {
    const upstream = await fetchPublic(target, { headers: { "User-Agent": "Reframer/0.1" }, signal: request.signal });
    if (!upstream.ok || !upstream.body) return Response.json({ error: `The server answered ${upstream.status}.` }, { status: 502 });
    const type = upstream.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (!MEDIA.test(type) && !(type === "application/octet-stream" && EXT.test(target))) {
      return Response.json({ error: `That link isn't a video, audio file or image (${type || "unknown type"}).` }, { status: 415 });
    }
    if (type === "image/svg+xml")
      return Response.json({ error: "SVG links can't be imported; download and drop the file instead." }, { status: 415 });
    const length = Number(upstream.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) return Response.json({ error: "That file is larger than 2 GB." }, { status: 413 });
    return new Response(upstream.body, {
      headers: {
        "Content-Type": type || "application/octet-stream",
        ...(length ? { "Content-Length": String(length) } : {}),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
