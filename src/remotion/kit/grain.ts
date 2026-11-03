/**
 * Film grain / dither for the kit: pre-generated noise tiles cycled per frame. Uses mulberry32 —
 * a short LCG leaves faint line patterns that read as banding on dark gradients after encoding.
 * Soft (Gaussian-ish) values around mid-grey so it dithers gradients in `overlay` without looking dirty.
 */

const TILE = 256;
const TILE_COUNT = 8;
let tiles: string[] | null = null;

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const makeTile = (seed: number): string => {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(TILE, TILE);
  const rnd = mulberry32(seed * 7919 + 17);
  for (let i = 0; i < img.data.length; i += 4) {
    // Sum of three uniforms ≈ a soft bell curve: fine grain without salt-and-pepper specks.
    const v = 128 + (rnd() + rnd() + rnd() - 1.5) * 110;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
};

export const kitGrainTile = (frame: number): string => {
  if (!tiles) tiles = Array.from({ length: TILE_COUNT }, (_, i) => makeTile(i + 1));
  return tiles[Math.abs(Math.floor(frame)) % TILE_COUNT] ?? "";
};

export const KIT_GRAIN_TILE = TILE;
