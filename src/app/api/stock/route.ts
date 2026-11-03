import { USER_AGENT } from "@/server/net";
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
  video_pictures?: { picture: string; nr: number }[];
};
type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  photographer: string;
  src: { original: string; large2x: string; medium: string };
};

type OpenverseImage = {
  id: string;
  title?: string;
  url: string;
  thumbnail?: string;
  creator?: string;
  license: string;
  license_version?: string;
  license_url?: string;
  attribution?: string;
  width?: number;
  height?: number;
  source?: string;
};

const ORIENTATION_TO_OPENVERSE: Record<string, string> = { landscape: "wide", portrait: "tall", square: "square" };

/** Wikimedia originals can be 9000 px wide: ask Commons for a 1920 px rendition instead (fast to import). */
const sized = (url: string, width?: number) => {
  const m = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(\w)\/(\w\w)\/([^/]+\.(?:jpe?g|png))$/i.exec(url);
  return m && (width ?? 0) > 2400 ? `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${m[3]}/1920px-${m[3]}` : url;
};

/**
 * A small (~330 px) rendition straight from the image host's CDN when it has one (Wikimedia only serves its
 * standard widths, such as 250, 330, 500, 960, 1280 and 1920; Flickr its size suffixes):
 * Openverse's own thumbnail service is slow and rate-limited for a burst of previews.
 */
const thumbOf = (url: string) => {
  const wiki = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(\w)\/(\w\w)\/([^/]+\.(?:jpe?g|png))$/i.exec(url);
  if (wiki) return `https://upload.wikimedia.org/wikipedia/commons/thumb/${wiki[1]}/${wiki[2]}/${wiki[3]}/330px-${wiki[3]}`;
  if (/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/\d+px-[^/]+$/i.test(url))
    return url.replace(/\/\d+px-([^/]+)$/, "/330px-$1");
  const flickr = /^(https:\/\/(?:live|farm\d+)\.staticflickr\.com\/\d+\/\d+_[0-9a-f]+)(?:_[a-z0-9])?\.jpg$/i.exec(url);
  if (flickr) return `${flickr[1]}_n.jpg`;
  // Hosts whose links are already web-sized renditions (about 1000 px).
  if (/^https:\/\/(cdn\.stocksnap\.io\/img-thumbs|images\.rawpixel\.com\/editor_)/i.test(url)) return url;
  return undefined;
};

/**
 * Without a Pexels key: real photos with licenses that allow commercial use (CC0, public domain, CC BY,
 * with the credit line), from Openverse. No key needed; anonymous use is rate-limited.
 */
const searchOpenverse = async (query: string, orientation: string | null) => {
  const qs = new URLSearchParams({ q: query, license: "cc0,pdm,by", page_size: "20", mature: "false", size: "large" });
  const aspect = orientation ? ORIENTATION_TO_OPENVERSE[orientation] : undefined;
  if (aspect) qs.set("aspect_ratio", aspect);
  const res = await fetch(`https://api.openverse.org/v1/images/?${qs}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Openverse answered ${res.status}`);
  const data = (await res.json()) as { results?: OpenverseImage[] };
  return (data.results ?? [])
    .filter((r) => r.url && (r.width ?? 0) >= 1000)
    .map((r) => ({
      id: `openverse-${r.id}`,
      type: "photo" as const,
      url: sized(r.url, r.width),
      preview: thumbOf(r.url) ?? r.thumbnail ?? r.url,
      width: r.width,
      height: r.height,
      author: r.creator,
      license: `${r.license.toUpperCase()}${r.license_version ? ` ${r.license_version}` : ""}`,
      licenseUrl: r.license_url,
      attribution: r.attribution ?? `"${r.title ?? "Photo"}" by ${r.creator ?? "unknown"} (${r.license.toUpperCase()})`,
    }));
};

type CommonsVideo = {
  pageid: number;
  title: string;
  videoinfo?: {
    url: string;
    width: number;
    height: number;
    duration?: number;
    thumburl?: string;
    derivatives?: { src: string; type: string; width: number; height: number }[];
    extmetadata?: Record<string, { value?: string } | undefined>;
  }[];
};

const plainText = (html = "") =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Public domain, CC0 and CC BY: free for commercial use with a credit line, and no share-alike. */
const reusable = (license: string) => {
  const l = license.toLowerCase();
  if (/-sa\b|sharealike|share-alike|\bnc\b|\bnd\b|gfdl|\bfal\b|gpl/.test(l)) return false;
  return /^(cc0|cc by\b|cc-by\b|public domain|pd\b|pd-)/.test(l);
};

/**
 * A still from inside a Commons video (its thumbnailer seeks), at one of the standard widths. Whole
 * seconds only: a fractional seek silently returns the default frame.
 */
const commonsFrame = (originalUrl: string, sec: number) => {
  const m = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(\w)\/(\w\w)\/([^/?]+)/.exec(originalUrl);
  return m
    ? `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${m[3]}/330px-seek%3D${Math.floor(sec)}-${m[3]}.jpg`
    : undefined;
};

/**
 * Without a Pexels key: real footage from Wikimedia Commons (public domain, CC0 and CC BY only), in a
 * rendition the browser and renderer play (VP8/VP9 WebM, at most 1080p) and at least 720p.
 */
const searchCommonsVideo = async (query: string, orientation: string | null) => {
  const qs = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `${query} filetype:video`,
    gsrnamespace: "6",
    gsrlimit: "50",
    prop: "videoinfo",
    viprop: "url|size|derivatives|extmetadata",
    viurlwidth: "330",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${qs}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Wikimedia Commons answered ${res.status}`);
  const data = (await res.json()) as { query?: { pages?: Record<string, CommonsVideo & { index?: number }> } };
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const out = [];
  for (const p of pages) {
    const v = p.videoinfo?.[0];
    if (!v || !v.duration || v.duration < 3 || v.duration > 1200) continue;
    const license = plainText(v.extmetadata?.LicenseShortName?.value);
    if (!reusable(license)) continue;
    const short = (d: { width: number; height: number }) => Math.min(d.width, d.height);
    const rendition = (v.derivatives ?? [])
      .filter((d) => /webm/.test(d.type) && /vp[89]/.test(d.type) && short(d) <= 1080)
      .sort((a, b) => short(b) - short(a))[0];
    if (!rendition || short(rendition) < 720) continue;
    if (orientation === "landscape" && rendition.width <= rendition.height) continue;
    if (orientation === "portrait" && rendition.height <= rendition.width) continue;
    const name = p.title.replace(/^File:/, "").replace(/\.\w+$/, "");
    const author = plainText(v.extmetadata?.Artist?.value) || "unknown";
    const length = v.duration;
    const frames = [0.125, 0.375, 0.625, 0.875].map((f) => commonsFrame(v.url, length * f));
    out.push({
      id: `commons-${p.pageid}`,
      type: "video" as const,
      url: rendition.src,
      preview: v.thumburl ?? frames[1] ?? "",
      // Four moments for the first few only: Commons cuts each frame on demand and throttles bursts.
      ...(out.length < 6 && frames.every(Boolean) ? { previews: frames as string[] } : {}),
      width: rendition.width,
      height: rendition.height,
      durationSec: Math.round(v.duration * 10) / 10,
      title: name,
      author,
      license,
      licenseUrl: plainText(v.extmetadata?.LicenseUrl?.value) || undefined,
      attribution: `"${name}" by ${author}, ${license}, via Wikimedia Commons`,
    });
    if (out.length >= 10) break;
  }
  return out;
};

const STOP = new Set(["the", "and", "with", "for", "from", "into", "onto", "over", "under", "near", "of", "a", "an", "in", "on", "at"]);

/**
 * Partial queries for a descriptive one, best first: its names (capitalised words: "Cappadocia"), then
 * neighbouring word pairs, then single words.
 */
const relaxedQueries = (query: string) => {
  const raw = query.split(/[^\p{L}\p{N}-]+/u).filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));
  const names = raw.filter((w) => /^\p{Lu}/u.test(w)).map((w) => w.toLowerCase());
  const words = raw.map((w) => w.toLowerCase());
  return [...names, ...words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`), ...words].filter(
    (q, i, all) => q !== query.toLowerCase() && all.indexOf(q) === i,
  );
};

/**
 * Both libraries match every word of a query, so a descriptive one ("maple syrup iced coffee", "Cappadocia
 * hot air balloons sunrise") often finds nothing: top up with partial queries (a few requests at most).
 */
const relaxed = async <T extends { id: string }>(
  search: (q: string) => Promise<T[]>,
  query: string,
  opts: { enough: number; cap: number; perTry: number },
) => {
  const first = await search(query);
  if (first.length >= opts.enough) return first;
  const seen = new Set(first.map((r) => r.id));
  const out = [...first];
  // A few from each partial query, so the candidates cover every part of the request.
  for (const q of relaxedQueries(query).slice(0, 4)) {
    if (out.length >= opts.cap) break;
    try {
      let added = 0;
      for (const r of await search(q)) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(r);
        if (++added >= opts.perTry) break;
      }
    } catch {
      break;
    }
  }
  return out;
};

const searchOpenverseRelaxed = (query: string, orientation: string | null) =>
  relaxed((q) => searchOpenverse(q, orientation), query, { enough: 8, cap: 16, perTry: 4 });

const searchCommonsVideoRelaxed = (query: string, orientation: string | null) =>
  relaxed((q) => searchCommonsVideo(q, orientation), query, { enough: 4, cap: 10, perTry: 4 });

/** Stock search through Pexels with the user's own (free) key, or free-license photos without one. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("query")?.trim();
  const type = params.get("type") === "photo" ? "photo" : "video";
  const orientation = params.get("orientation");
  if (!query) return Response.json({ error: "query required" }, { status: 400 });
  const key = (await readSettings()).integrations.pexels;
  if (!key) {
    try {
      const [videos, photos] = await Promise.all([
        type === "video" ? searchCommonsVideoRelaxed(query, orientation).catch(() => []) : Promise.resolve([]),
        searchOpenverseRelaxed(query, orientation),
      ]);
      const results = [...videos, ...photos.slice(0, Math.max(6, 16 - videos.length))];
      return Response.json({
        results,
        note: videos.length
          ? `${videos.length} free-license videos from Wikimedia Commons come first (▶ in the sheet; each tile shows four moments across the clip), then photos from Openverse. Commons videos are often long: import one, look inside it with view_media and trim to the moment you need. Pass license and attribution to import_media so the credit is kept.`
          : (type === "video"
              ? "No free-license video matched (and no Pexels key for stock video): these are free-license photos; animate them with animate_photos. "
              : "") +
            "Free-license photos from Openverse: pass license and attribution to import_media so the credit is kept. A free Pexels key (Settings → Media services) adds stock video.",
      });
    } catch (err) {
      return Response.json(
        {
          error: `Stock search needs a free Pexels key (Settings → Media services), and the free photo search failed: ${err instanceof Error ? err.message : err}`,
        },
        { status: 502 },
      );
    }
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
      // Four moments across the clip for the contact sheet.
      const pics = [...(v.video_pictures ?? [])].sort((a, b) => a.nr - b.nr);
      const previews = pics.length >= 4 ? [0.125, 0.375, 0.625, 0.875].map((f) => pics[Math.floor(f * pics.length)].picture) : undefined;
      return {
        id: `pexels-video-${v.id}`,
        type: "video" as const,
        url: best?.link ?? "",
        preview: v.image,
        ...(previews ? { previews } : {}),
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
