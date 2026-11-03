"use client";

/**
 * A numbered contact sheet of search candidates (stock photos and videos), so the agent picks
 * pictures by what they show rather than by their titles. Previews load through the app's own media
 * proxy, which keeps the canvas readable.
 */

const TILE_W = 320;
const TILE_H = 180;
const COLS = 4;

type Candidate = { preview: string; previews?: string[]; url?: string; type?: string; durationSec?: number };

/** Hosts that allow cross-origin reads load directly (HTTP/2, no proxy hop); others through the proxy. */
const DIRECT = /^https:\/\/(upload|thumb)\.wikimedia\.org\//;

const loadImage = (src: string, timeoutMs: number) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    if (DIRECT.test(src)) {
      img.crossOrigin = "anonymous";
      img.src = src;
    } else img.src = `/api/fetch?url=${encodeURIComponent(src)}`;
  });

/** A video tile shows four moments across the clip (2×2); anything else one picture. */
const sourcesOf = (it: Candidate) => (it.type === "video" && it.previews?.length === 4 ? it.previews : [it.preview]);

/**
 * Loads previews a few at a time (image hosts throttle bursts), falling back to the full picture.
 * Frames from inside a video can take Commons 5–15 s to cut the first time, so they get their own
 * wider pool and a longer wait.
 */
const loadAll = async (items: Candidate[]) => {
  const jobs = items.flatMap((it, i) => sourcesOf(it).map((src, k) => ({ i, k, src, frame: sourcesOf(it).length > 1 })));
  const out: (HTMLImageElement | null)[][] = items.map((it) => sourcesOf(it).map(() => null));
  const pool = async (list: typeof jobs, workers: number, timeoutMs: number) => {
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const { i, k, src } = list[next++];
        const it = items[i];
        out[i][k] = (await loadImage(src, timeoutMs)) ?? (k === 0 && it.url && it.type !== "video" ? await loadImage(it.url, 8000) : null);
      }
    };
    await Promise.all(Array.from({ length: workers }, worker));
  };
  await Promise.all([
    pool(
      jobs.filter((j) => !j.frame),
      4,
      6000,
    ),
    pool(
      jobs.filter((j) => j.frame),
      8,
      20_000,
    ),
  ]);
  // A video whose moments didn't load falls back to its poster.
  await Promise.all(
    items.map(async (it, i) => {
      if (out[i].length > 1 && !out[i].some(Boolean)) out[i] = [await loadImage(it.preview, 6000)];
    }),
  );
  return out;
};

/** Draws a picture letterboxed into a box, so its framing and orientation are visible. */
const drawFit = (g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
  const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * k;
  const dh = img.naturalHeight * k;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
};

/** JPEG data URL of the candidates' previews, labelled 1…n in result order (videos with their length). */
export const candidateSheet = async (items: Candidate[]) => {
  if (!items.length) return null;
  const images = await loadAll(items);
  if (!images.some((list) => list.some(Boolean))) return null;
  const rows = Math.ceil(items.length / COLS);
  const canvas = document.createElement("canvas");
  canvas.width = COLS * (TILE_W + 4) - 4;
  canvas.height = rows * (TILE_H + 4) - 4;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#141414";
  g.fillRect(0, 0, canvas.width, canvas.height);
  items.forEach((it, i) => {
    const x = (i % COLS) * (TILE_W + 4);
    const y = Math.floor(i / COLS) * (TILE_H + 4);
    const list = images[i];
    if (list.length === 4) {
      const w = TILE_W / 2;
      const h = TILE_H / 2;
      list.forEach((img, k) => {
        if (img) drawFit(g, img, x + (k % 2) * w, y + Math.floor(k / 2) * h, w - 1, h - 1);
      });
    } else if (list[0]) drawFit(g, list[0], x, y, TILE_W, TILE_H);
    else {
      g.fillStyle = "#777";
      g.font = "14px sans-serif";
      g.fillText("(no preview)", x + 12, y + TILE_H / 2);
    }
    const label = `${i + 1}${it.type === "video" && it.durationSec ? ` ▶ ${Math.round(it.durationSec)}s` : ""}`;
    g.font = "bold 18px sans-serif";
    const lw = g.measureText(label).width + 14;
    g.fillStyle = "rgba(0,0,0,0.75)";
    g.fillRect(x, y, lw, 26);
    g.fillStyle = "#fff";
    g.fillText(label, x + 7, y + 19);
  });
  return canvas.toDataURL("image/jpeg", 0.78);
};
