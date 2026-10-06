/**
 * Cheap film grain: a handful of pre-generated noise tiles (data URLs) that
 * components cycle through per frame as a repeating background. Far cheaper
 * than per-frame SVG turbulence at full resolution.
 */

const TILE = 192;
const TILE_COUNT = 6;
let tiles: string[] | null = null;

const makeTile = (seed: number): string => {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(TILE, TILE);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < img.data.length; i += 4) {
    // Deterministic LCG noise, mid-grey centred so it reads well in `overlay`.
    s = (s * 9301 + 49297) % 233280;
    const v = 128 + (s / 233280 - 0.5) * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
};

export const getGrainTile = (frame: number): string => {
  if (!tiles) tiles = Array.from({ length: TILE_COUNT }, (_, i) => makeTile(i + 1));
  return tiles[Math.abs(Math.floor(frame)) % TILE_COUNT] ?? "";
};

export const GRAIN_TILE_SIZE = TILE;
