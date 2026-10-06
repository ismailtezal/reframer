export type RGBA = [number, number, number, number];

const NAMED: Record<string, RGBA> = {
  transparent: [0, 0, 0, 0],
  black: [0, 0, 0, 1],
  white: [255, 255, 255, 1],
  red: [255, 0, 0, 1],
  green: [0, 128, 0, 1],
  blue: [0, 0, 255, 1],
  yellow: [255, 255, 0, 1],
};

/** Parses hex / rgb() / rgba() / a few named colors. Returns null for anything else. */
export const parseColor = (input: string): RGBA | null => {
  const value = input.trim().toLowerCase();
  if (value in NAMED) return [...NAMED[value]] as RGBA;
  if (value.startsWith("#")) {
    let hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (hex.length !== 6 && hex.length !== 8) return null;
    const n = Number.parseInt(hex, 16);
    if (Number.isNaN(n)) return null;
    if (hex.length === 6) {
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
    }
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
      Number.parseInt(hex.slice(6, 8), 16) / 255,
    ];
  }
  const match = value.match(/^rgba?\(([^)]+)\)$/);
  if (match) {
    const parts = match[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = (p: string) => (p.endsWith("%") ? (Number.parseFloat(p) / 100) * 255 : Number.parseFloat(p));
    const alpha = parts[3] ? (parts[3].endsWith("%") ? Number.parseFloat(parts[3]) / 100 : Number.parseFloat(parts[3])) : 1;
    const rgba: RGBA = [channel(parts[0]), channel(parts[1]), channel(parts[2]), alpha];
    return rgba.some((v) => Number.isNaN(v)) ? null : rgba;
  }
  return null;
};

export const isColorString = (value: string): boolean => parseColor(value) !== null;

export const rgbaToString = ([r, g, b, a]: RGBA): string =>
  a >= 1
    ? `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
    : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.round(a * 1000) / 1000})`;

export const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

/** Interpolates two colors in (gamma-naive) RGB space. Falls back to a hold. */
export const mixColors = (a: string, b: string, t: number): string => {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return t < 1 ? a : b;
  return rgbaToString([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t, ca[3] + (cb[3] - ca[3]) * t]);
};

/** Relative luminance (0..1), used for contrast checks in the video linter. */
export const luminance = (color: string): number => {
  const c = parseColor(color);
  if (!c) return 0.5;
  const [r, g, b] = c.slice(0, 3).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (a: string, b: string): number => {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

export const withAlpha = (color: string, alpha: number): string => {
  const c = parseColor(color);
  if (!c) return color;
  return rgbaToString([c[0], c[1], c[2], alpha]);
};
