"use client";

/**
 * Client side of derived media (see src/server/derived.ts): URLs and cached
 * loaders for posters, filmstrip thumbnails and waveform peaks. Everything is
 * produced by native FFmpeg on the local server, never decoded in the page.
 */

export const DERIVED_VERSION = 1;

export type ThumbLayout = { interval: number; count: number; width: number; height: number };
export type Peaks = { rate: number; data: Uint8Array };

/** `/api/media/<project>/<file>` → `/api/derived/<project>/<file>` (null for anything else). */
const derivedBase = (src: string | undefined): string | null => {
  if (!src) return null;
  const m = src.match(/^\/api\/media\/([^/?#]+)\/([^?#]+)$/);
  return m ? `/api/derived/${m[1]}/${m[2]}` : null;
};

export const hasDerived = (src: string | undefined) => derivedBase(src) !== null;

export const posterUrl = (src: string | undefined) => {
  const base = derivedBase(src);
  return base ? `${base}?kind=poster&v=${DERIVED_VERSION}` : null;
};

export const thumbUrl = (src: string, index: number) => `${derivedBase(src)}?kind=thumb&i=${index}&v=${DERIVED_VERSION}`;

export const probeUrl = (src: string) => `${derivedBase(src)}?kind=probe&v=${DERIVED_VERSION}`;

const layoutCache = new Map<string, Promise<ThumbLayout | null>>();
const layoutReady = new Map<string, ThumbLayout | null>();

/** Filmstrip layout for a video (cached for the session). */
export const loadThumbLayout = (src: string): Promise<ThumbLayout | null> => {
  const cached = layoutCache.get(src);
  if (cached) return cached;
  const base = derivedBase(src);
  const p: Promise<ThumbLayout | null> = base
    ? fetch(`${base}?kind=thumbs&v=${DERIVED_VERSION}`)
        .then((r) => (r.ok ? (r.json() as Promise<ThumbLayout>) : null))
        .catch(() => null)
    : Promise.resolve(null);
  p.then((l) => layoutReady.set(src, l));
  layoutCache.set(src, p);
  return p;
};

/** Synchronous read of an already-loaded layout (undefined while loading). */
export const peekThumbLayout = (src: string) => layoutReady.get(src);

const peaksCache = new Map<string, Promise<Peaks | null>>();
const peaksReady = new Map<string, Peaks | null>();

/** Waveform peaks (0–255 per 10 ms) for an audio or video file. */
export const loadPeaks = (src: string): Promise<Peaks | null> => {
  const cached = peaksCache.get(src);
  if (cached) return cached;
  const base = derivedBase(src);
  const p: Promise<Peaks | null> = base
    ? fetch(`${base}?kind=peaks&v=${DERIVED_VERSION}`)
        .then(async (r) => {
          if (!r.ok) return null;
          const rate = Number(r.headers.get("x-peaks-rate") ?? 100);
          return { rate, data: new Uint8Array(await r.arrayBuffer()) };
        })
        .catch(() => null)
    : Promise.resolve(null);
  p.then((v) => peaksReady.set(src, v));
  peaksCache.set(src, p);
  return p;
};

export const peekPeaks = (src: string) => peaksReady.get(src);

/** Downsamples peaks to `bars` values over a time range (max per bar). */
export const peaksInRange = (peaks: Peaks, startSec: number, endSec: number, bars: number): Float32Array => {
  const out = new Float32Array(Math.max(0, bars));
  if (bars <= 0) return out;
  const { data, rate } = peaks;
  const step = ((endSec - startSec) * rate) / bars;
  for (let i = 0; i < bars; i++) {
    const a = Math.floor(startSec * rate + i * step);
    const b = Math.max(a + 1, Math.floor(startSec * rate + (i + 1) * step));
    let v = 0;
    for (let j = Math.max(0, a); j < Math.min(data.length, b); j++) if (data[j] > v) v = data[j];
    out[i] = v / 255;
  }
  return out;
};

/**
 * Moves heavy, regenerable data out of a project: data-URL thumbnails become
 * cached poster URLs and stored waveform arrays are dropped (peaks are served
 * on demand). Keeps autosave, agent context and render payloads small.
 */
export const slimProject = <P extends { assets: Record<string, { type: string; src: string; thumbnail?: string; waveform?: number[] }> }>(
  project: P,
): { project: P; changed: boolean } => {
  let changed = false;
  const assets: P["assets"] = { ...project.assets };
  for (const [id, asset] of Object.entries(project.assets)) {
    if (!hasDerived(asset.src)) continue;
    const next = { ...asset };
    if (next.thumbnail?.startsWith("data:") && (asset.type === "video" || asset.type === "image")) {
      next.thumbnail = posterUrl(asset.src) ?? undefined;
      changed = true;
    }
    if (next.waveform) {
      delete next.waveform;
      changed = true;
    }
    (assets as Record<string, typeof asset>)[id] = next;
  }
  return changed ? { project: { ...project, assets }, changed } : { project, changed };
};
