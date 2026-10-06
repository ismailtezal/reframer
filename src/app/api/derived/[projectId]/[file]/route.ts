import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import { getPeaks, getPoster, getProbe, getThumbs, PEAKS_RATE, thumbPath } from "@/server/derived";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ projectId: string; file: string }> };

const IMMUTABLE = "private, max-age=31536000, immutable";

const sendFile = async (file: string, type: string) => {
  const stat = await fs.stat(file);
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: { "Content-Type": type, "Content-Length": String(stat.size), "Cache-Control": IMMUTABLE },
  });
};

/**
 * Derived media for a project file: `?kind=probe | thumbs | thumb&i=N | poster | peaks`.
 * Generated on first request (and right after upload), then served from cache.
 */
export async function GET(request: Request, ctx: Ctx) {
  const { projectId, file: raw } = await ctx.params;
  const file = decodeURIComponent(raw);
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  try {
    switch (kind) {
      case "probe":
        return Response.json(await getProbe(projectId, file), { headers: { "Cache-Control": IMMUTABLE } });
      case "thumbs":
        return Response.json(await getThumbs(projectId, file), { headers: { "Cache-Control": IMMUTABLE } });
      case "thumb": {
        await getThumbs(projectId, file);
        return await sendFile(thumbPath(projectId, file, Number(params.get("i") ?? 0)), "image/jpeg");
      }
      case "poster": {
        const poster = await getPoster(projectId, file);
        return await sendFile(poster.path, poster.type);
      }
      case "peaks": {
        const peaks = await getPeaks(projectId, file);
        return new Response(new Uint8Array(peaks), {
          headers: { "Content-Type": "application/octet-stream", "x-peaks-rate": String(PEAKS_RATE), "Cache-Control": IMMUTABLE },
        });
      }
      default:
        return Response.json({ error: "kind must be probe, thumbs, thumb, poster or peaks" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: /No (video|audio|image)/.test(message) ? 404 : 500 });
  }
}
