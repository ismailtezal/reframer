import { readSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

type PexelsVideo = {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string;
  user: { name: string };
  video_files: { link: string; width: number | null; height: number | null; file_type: string }[];
};
type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  photographer: string;
  src: { original: string; large2x: string; medium: string };
};

/** Stock search through Pexels with the user's own (free) key. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("query")?.trim();
  const type = params.get("type") === "photo" ? "photo" : "video";
  const orientation = params.get("orientation");
  if (!query) return Response.json({ error: "query required" }, { status: 400 });
  const key = (await readSettings()).integrations.pexels;
  if (!key) {
    return Response.json(
      { error: "Stock search needs a free Pexels key. Add it in Settings → Media services (pexels.com/api)." },
      { status: 400 },
    );
  }
  const qs = new URLSearchParams({ query, per_page: "15" });
  if (orientation && ["landscape", "portrait", "square"].includes(orientation)) qs.set("orientation", orientation);
  const endpoint = type === "video" ? `https://api.pexels.com/videos/search?${qs}` : `https://api.pexels.com/v1/search?${qs}`;
  const res = await fetch(endpoint, { headers: { Authorization: key }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return Response.json({ error: `Pexels answered ${res.status}. Check the key in Settings.` }, { status: 502 });
  const data = (await res.json()) as { videos?: PexelsVideo[]; photos?: PexelsPhoto[] };

  if (type === "video") {
    const results = (data.videos ?? []).map((v) => {
      // Prefer an HD mp4 up to 1920 wide; 4K files are slow to import and edit.
      const files = v.video_files.filter((f) => f.file_type === "video/mp4" && f.width);
      const hd = files.filter((f) => (f.width ?? 0) <= 1920).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
      const best = hd ?? [...files].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0];
      return {
        id: `pexels-video-${v.id}`,
        type: "video" as const,
        url: best?.link ?? "",
        preview: v.image,
        width: best?.width ?? v.width,
        height: best?.height ?? v.height,
        durationSec: v.duration,
        author: v.user.name,
        attribution: `Video by ${v.user.name} on Pexels`,
      };
    });
    return Response.json({ results: results.filter((r) => r.url) });
  }

  const results = (data.photos ?? []).map((p) => ({
    id: `pexels-photo-${p.id}`,
    type: "photo" as const,
    url: p.src.large2x || p.src.original,
    preview: p.src.medium,
    width: p.width,
    height: p.height,
    author: p.photographer,
    attribution: `Photo by ${p.photographer} on Pexels`,
  }));
  return Response.json({ results });
}
