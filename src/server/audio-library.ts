import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { CACHE_DIR } from "./paths";

/**
 * Searchable libraries of real music and sound effects that creators can use
 * in commercial videos, so the agent never has to synthesize music:
 * - Kevin MacLeod's royalty-free catalogue (CC BY 4.0, ~1,400 tracks with BPM,
 *   instruments and mood tags), the most used library music on YouTube,
 *   from incompetech's own pieces.json.
 * - Openverse (api.openverse.org, no key): Freesound effects and Jamendo /
 *   Wikimedia music. Anonymous use allows 20 results per page and about 20
 *   requests a minute, so results are cached.
 *
 * Only licenses that allow commercial use with no share-alike or
 * no-derivatives terms are returned: CC0, Public Domain Mark and CC BY
 * (attribution — the credit line is included with every result).
 */

export type AudioKind = "music" | "sfx";

export type AudioResult = {
  id: string;
  kind: AudioKind;
  title: string;
  creator?: string;
  source: string;
  durationSec?: number;
  /** Direct, downloadable audio file. */
  url: string;
  license: string;
  licenseUrl?: string;
  /** Credit line to put in the video description (required for CC BY). */
  attribution?: string;
  tags: string[];
  genre?: string;
  bpm?: number;
  description?: string;
};

const UA = "Reframer/0.1 (open-source video editor; https://github.com/ismailtezal/reframer)";

// --- Kevin MacLeod (incompetech) ---------------------------------------------

type Piece = {
  title: string;
  filename: string;
  length?: string;
  instruments?: string;
  genre?: string;
  bpm?: string;
  description?: string;
  feel?: string;
};

const GENRES: Record<string, string> = {
  "2": "African",
  "3": "Blues",
  "4": "Classical",
  "5": "Contemporary",
  "6": "Disco",
  "7": "Electronica",
  "8": "Funk",
  "9": "Holiday",
  "10": "Horror",
  "11": "Jazz",
  "12": "Latin",
  "13": "Modern",
  "14": "Musical",
  "15": "Polka",
  "16": "Pop",
  "18": "Reggae",
  "19": "Rock",
  "20": "Silent Film Score",
  "21": "Ska",
  "22": "Soundtrack",
  "23": "Stings",
  "24": "Unclassifiable",
  "25": "World",
  "26": "Urban",
};

/** Everyday words → incompetech's mood ("feel") and genre vocabulary. */
const SYNONYMS: Record<string, string[]> = {
  calm: ["calming", "relaxed"],
  chill: ["relaxed", "calming", "grooving"],
  relaxing: ["relaxed", "calming"],
  peaceful: ["calming", "relaxed"],
  upbeat: ["bright", "bouncy", "uplifting", "driving"],
  happy: ["bright", "bouncy", "uplifting"],
  positive: ["uplifting", "bright"],
  inspiring: ["uplifting", "epic"],
  inspirational: ["uplifting", "epic"],
  motivational: ["uplifting", "driving"],
  corporate: ["bright", "uplifting"],
  energetic: ["driving", "action", "intense"],
  energy: ["driving", "action"],
  hype: ["driving", "action", "aggressive"],
  sport: ["driving", "action"],
  tech: ["electronica", "driving"],
  technology: ["electronica", "driving"],
  electronic: ["electronica"],
  edm: ["electronica", "driving"],
  dark: ["dark", "somber"],
  tense: ["suspenseful", "unnerving", "intense"],
  tension: ["suspenseful", "unnerving"],
  suspense: ["suspenseful", "mysterious"],
  scary: ["eerie", "unnerving", "horror"],
  creepy: ["eerie", "unnerving"],
  horror: ["horror", "eerie"],
  epic: ["epic", "intense", "action"],
  cinematic: ["epic", "soundtrack", "intense"],
  trailer: ["epic", "intense", "action", "soundtrack"],
  dramatic: ["intense", "epic", "somber"],
  funny: ["humorous", "bouncy"],
  comedy: ["humorous", "bouncy"],
  quirky: ["humorous", "bouncy"],
  playful: ["bouncy", "humorous", "bright"],
  mysterious: ["mysterious", "mystical"],
  magical: ["mystical"],
  fantasy: ["mystical", "epic"],
  sad: ["somber", "calming"],
  emotional: ["somber", "uplifting"],
  romantic: ["calming", "relaxed"],
  nostalgic: ["somber", "relaxed"],
  groovy: ["grooving"],
  funky: ["grooving", "funk"],
  lofi: ["relaxed", "grooving", "urban"],
  hiphop: ["urban", "grooving"],
  "hip-hop": ["urban", "grooving"],
  action: ["action", "driving", "intense"],
  aggressive: ["aggressive", "intense"],
  documentary: ["soundtrack", "contemporary"],
};

const FAST = new Set(["fast", "upbeat", "energetic", "hype", "action", "sport", "edm", "driving"]);
const SLOW = new Set(["slow", "calm", "chill", "relaxing", "peaceful", "sad", "ambient", "lofi", "romantic"]);

const MACLEOD_FILE = path.join(CACHE_DIR, "incompetech-pieces.json");
let pieces: Promise<Piece[]> | null = null;

const loadPieces = () => {
  pieces ??= (async () => {
    try {
      const stat = await fs.stat(MACLEOD_FILE);
      if (Date.now() - stat.mtimeMs < 14 * 24 * 3600 * 1000) return JSON.parse(await fs.readFile(MACLEOD_FILE, "utf8")) as Piece[];
    } catch {
      // No cache yet.
    }
    const res = await fetch("https://incompetech.com/music/royalty-free/pieces.json", {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`incompetech ${res.status}`);
    const data = (await res.json()) as Piece[] | Record<string, Piece>;
    const list = (Array.isArray(data) ? data : Object.values(data)).filter((p) => p.title && p.filename);
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(MACLEOD_FILE, JSON.stringify(list));
    return list;
  })().catch((err) => {
    pieces = null;
    throw err;
  });
  return pieces;
};

const words = (s: string): string[] => s.toLowerCase().match(/[a-z0-9-]+/g) ?? [];

const seconds = (hms?: string) => {
  const parts = (hms ?? "").split(":").map(Number);
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
};

const searchMacLeod = async (opts: { query: string; minSec?: number; maxSec?: number; limit: number }) => {
  const all = await loadPieces();
  const q = words(opts.query);
  const terms = new Set(q.flatMap((w) => [w, ...(SYNONYMS[w] ?? [])]));
  const wantFast = q.some((w) => FAST.has(w));
  const wantSlow = q.some((w) => SLOW.has(w));
  return all
    .map((p) => {
      const durationSec = seconds(p.length);
      const genre = GENRES[p.genre ?? ""] ?? "";
      const feel = words(p.feel ?? "");
      const instruments = words(p.instruments ?? "");
      const title = words(p.title);
      const genreWords = words(genre);
      const description = words(p.description ?? "");
      let score = 0;
      for (const t of terms) {
        if (feel.includes(t)) score += 3;
        if (genreWords.includes(t)) score += 2;
        if (instruments.includes(t)) score += 2;
        if (title.includes(t)) score += 1.5;
        if (description.includes(t)) score += 0.5;
      }
      const bpm = Number(p.bpm) || undefined;
      if (bpm && wantFast && bpm >= 115) score += 1;
      if (bpm && wantSlow && bpm <= 95) score += 1;
      return { p, score, durationSec, genre, bpm };
    })
    .filter((x) => x.score > 0 && x.durationSec >= (opts.minSec ?? 0) && x.durationSec <= (opts.maxSec ?? Number.POSITIVE_INFINITY))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit)
    .map(
      ({ p, durationSec, genre, bpm }): AudioResult => ({
        id: `macleod:${p.filename}`,
        kind: "music",
        title: p.title,
        creator: "Kevin MacLeod",
        source: "incompetech",
        durationSec,
        url: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(p.filename)}`,
        license: "CC BY 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        attribution: `"${p.title}" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License. http://creativecommons.org/licenses/by/4.0/`,
        tags: [...words(p.feel ?? ""), ...words(p.instruments ?? "")].slice(0, 12),
        genre,
        bpm,
        description: p.description,
      }),
    );
};

// --- Openverse ----------------------------------------------------------------

type OpenverseAudio = {
  id: string;
  title?: string;
  creator?: string;
  source?: string;
  duration?: number | null;
  url?: string;
  foreign_landing_url?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  attribution?: string;
  tags?: { name: string }[];
  genres?: string[] | null;
  mature?: boolean;
};

const LICENSE_LABEL: Record<string, string> = { cc0: "CC0", pdm: "Public domain", by: "CC BY" };
const cache = new Map<string, { at: number; results: AudioResult[] }>();
const CACHE_TTL = 6 * 3600 * 1000;

const searchOpenverse = async (opts: { kind: AudioKind; query: string; limit: number }) => {
  const key = `${opts.kind}:${opts.query.toLowerCase().trim()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.results;
  const params = new URLSearchParams({
    q: opts.query.slice(0, 200),
    license: "cc0,pdm,by",
    // Anonymous requests may not ask for more than 20.
    page_size: "20",
    mature: "false",
    source: opts.kind === "sfx" ? "freesound" : "jamendo,wikimedia_audio",
  });
  const res = await fetch(`https://api.openverse.org/v1/audio/?${params}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 429) throw new Error("The sound library is rate-limited right now; try again in a minute.");
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const data = (await res.json()) as { results?: OpenverseAudio[] };
  const results = (data.results ?? [])
    .filter((r) => r.url && r.license && LICENSE_LABEL[r.license] && !r.mature)
    .map(
      (r): AudioResult => ({
        id: `openverse:${r.id}`,
        kind: opts.kind,
        title: (r.title ?? "Untitled").replace(/\.(wav|mp3|aiff?|flac|ogg)$/i, ""),
        creator: r.creator,
        source: r.source ?? "openverse",
        durationSec: r.duration ? Math.round(r.duration / 100) / 10 : undefined,
        url: r.url as string,
        license: `${LICENSE_LABEL[r.license as string]}${r.license_version && r.license !== "pdm" ? ` ${r.license_version}` : ""}`,
        licenseUrl: r.license_url,
        // Credit = title, author, source and license (TASL); Openverse's own line lacks the source link.
        attribution:
          r.license === "by" ? `${r.attribution ?? r.title}${r.foreign_landing_url ? ` Source: ${r.foreign_landing_url}` : ""}` : undefined,
        tags: (r.tags ?? []).map((t) => t.name.toLowerCase()).slice(0, 12),
        genre: r.genres?.[0],
      }),
    );
  cache.set(key, { at: Date.now(), results });
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return results;
};

/** Searches the libraries; music leads with Kevin MacLeod's tagged catalogue, then Openverse. */
export const searchAudio = async (opts: { kind: AudioKind; query: string; minSec?: number; maxSec?: number; limit?: number }) => {
  const limit = Math.min(20, Math.max(1, opts.limit ?? 10));
  // Hour-long mixes are never what a video needs unless asked for.
  const maxSec = opts.maxSec ?? (opts.kind === "music" ? 20 * 60 : Number.POSITIVE_INFINITY);
  const inLength = (r: AudioResult) => r.durationSec === undefined || (r.durationSec >= (opts.minSec ?? 0) && r.durationSec <= maxSec);
  if (opts.kind === "sfx") {
    const results = await searchOpenverse({ kind: "sfx", query: opts.query, limit });
    // Short, clean effects first: the agent trims, but a 2-minute field recording is rarely what's wanted.
    return results
      .filter(inLength)
      .sort((a, b) => Number((a.durationSec ?? 0) > 20) - Number((b.durationSec ?? 0) > 20))
      .slice(0, limit);
  }
  const [mac, ov] = await Promise.allSettled([
    searchMacLeod({ ...opts, limit }),
    searchOpenverse({ kind: "music", query: opts.query, limit }),
  ]);
  const a = mac.status === "fulfilled" ? mac.value : [];
  const b = ov.status === "fulfilled" ? ov.value.filter(inLength) : [];
  if (!a.length && !b.length && mac.status === "rejected" && ov.status === "rejected")
    throw new Error("The music libraries are unreachable.");
  // Two MacLeod picks (tagged by mood and tempo) for every Openverse one.
  const out: AudioResult[] = [];
  for (let i = 0, j = 0; out.length < limit && (i < a.length || j < b.length); ) {
    if (i < a.length) out.push(a[i++]);
    if (i < a.length && out.length < limit) out.push(a[i++]);
    if (j < b.length && out.length < limit) out.push(b[j++]);
  }
  return out;
};
