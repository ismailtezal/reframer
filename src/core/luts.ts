/**
 * Procedural 3D LUTs, generated as `.cube` text so the repo ships no binary
 * or licensed LUT files. Each look is a pure function rgb → rgb in 0..1.
 * Ids are referenced by Style DNA presets and grade effects.
 */

type RGB = [number, number, number];
type LookFn = (c: RGB) => RGB;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const luma = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Filmic S-curve around a pivot; strength 0 = identity. */
const sCurve = (x: number, strength: number, pivot = 0.45) => {
  const k = 1 + strength * 4;
  const y = x < pivot ? pivot * (x / pivot) ** k : 1 - (1 - pivot) * ((1 - x) / (1 - pivot)) ** k;
  return mix(x, y, Math.min(1, strength * 1.5));
};

const saturate = (c: RGB, amount: number): RGB => {
  const l = luma(c);
  return [mix(l, c[0], amount), mix(l, c[1], amount), mix(l, c[2], amount)];
};

/** Adds a tint to shadows and highlights separately. */
const splitTone = (c: RGB, shadow: RGB, shadowAmt: number, highlight: RGB, highlightAmt: number): RGB => {
  const l = luma(c);
  const sw = (1 - smoothstep(0, 0.55, l)) * shadowAmt;
  const hw = smoothstep(0.45, 1, l) * highlightAmt;
  return [
    c[0] + (shadow[0] - 0.5) * sw + (highlight[0] - 0.5) * hw,
    c[1] + (shadow[1] - 0.5) * sw + (highlight[1] - 0.5) * hw,
    c[2] + (shadow[2] - 0.5) * sw + (highlight[2] - 0.5) * hw,
  ];
};

const lift = (c: RGB, blacks: number, whites = 1): RGB => c.map((v) => blacks + v * (whites - blacks)) as RGB;

const warm = (c: RGB, amt: number): RGB => [c[0] + amt * 0.06, c[1] + amt * 0.015, c[2] - amt * 0.06];

const hex = (h: string): RGB => {
  const n = Number.parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const LOOKS: Record<string, { label: string; description: string; fn: LookFn }> = {
  "film-print": {
    label: "Film print",
    description: "Kodak-print style: rich S-curve, teal shadows, warm highlights, soft rolloff.",
    fn: (c) => {
      let o = c.map((v) => sCurve(v, 0.35)) as RGB;
      o = splitTone(o, hex("#1d5a66"), 0.22, hex("#ffb06a"), 0.16);
      o = saturate(o, 0.92);
      return lift(o, 0.02, 0.97);
    },
  },
  "teal-orange": {
    label: "Teal & orange",
    description: "Blockbuster complementary grade: teal shadows, orange skin and highlights.",
    fn: (c) => {
      let o = c.map((v) => sCurve(v, 0.3)) as RGB;
      o = splitTone(o, hex("#0e4a5c"), 0.5, hex("#ff9e57"), 0.32);
      return saturate(o, 1.08);
    },
  },
  portra: {
    label: "Portra",
    description: "Warm, soft portrait film: gentle contrast, pastel greens, lifted blacks.",
    fn: (c) => {
      let o = warm(c, 0.6);
      o = o.map((v) => sCurve(v, 0.12)) as RGB;
      o = [o[0], mix(o[1], luma(o), 0.15), o[2] * 0.97 + 0.01];
      o = saturate(o, 0.88);
      return lift(o, 0.035, 0.98);
    },
  },
  "bleach-bypass": {
    label: "Bleach bypass",
    description: "Silvery, desaturated, high-contrast war-film look.",
    fn: (c) => {
      const l = luma(c);
      let o = saturate(c, 0.45);
      o = o.map((v) => sCurve(mix(v, l, 0.2), 0.6)) as RGB;
      return o;
    },
  },
  "mono-noir": {
    label: "Mono noir",
    description: "High-contrast black & white with deep blacks.",
    fn: (c) => {
      const l = sCurve(luma(c), 0.7, 0.42);
      return [l, l, l];
    },
  },
  "pastel-dream": {
    label: "Pastel dream",
    description: "Wes-Anderson-like pastel: flat contrast, pink highlights, lifted shadows.",
    fn: (c) => {
      let o = lift(c, 0.06, 0.96);
      o = splitTone(o, hex("#8a7bb0"), 0.12, hex("#ffc2b8"), 0.22);
      return saturate(o, 0.95);
    },
  },
  vhs: {
    label: "VHS",
    description: "Washed tape look: lifted blacks, clipped whites, magenta/green drift.",
    fn: (c) => {
      let o = lift(c, 0.07, 0.93);
      o = [o[0] * 1.04 + 0.01, o[1] * 0.98, o[2] * 1.02 + 0.015];
      return saturate(o, 1.18);
    },
  },
  "warm-vlog": {
    label: "Warm vlog",
    description: "Friendly warm white balance with skin-safe contrast.",
    fn: (c) => {
      let o = warm(c, 0.9);
      o = o.map((v) => sCurve(v, 0.12)) as RGB;
      return saturate(o, 1.05);
    },
  },
  "cool-doc": {
    label: "Cool documentary",
    description: "Cool shadows, neutral highlights, slightly desaturated — serious documentaries.",
    fn: (c) => {
      let o = splitTone(c, hex("#2f5f8a"), 0.3, hex("#f2efe6"), 0.05);
      o = o.map((v) => sCurve(v, 0.2)) as RGB;
      return saturate(o, 0.82);
    },
  },
  "matte-fade": {
    label: "Matte fade",
    description: "Lifted blacks, softened whites, subtle desaturation.",
    fn: (c) => saturate(lift(c, 0.08, 0.94), 0.9),
  },
  "vivid-pop": {
    label: "Vivid pop",
    description: "Bright, punchy, saturated — high-retention entertainment.",
    fn: (c) => {
      let o = c.map((v) => sCurve(v, 0.28)) as RGB;
      o = saturate(o, 1.3);
      return o.map((v) => v * 1.03) as RGB;
    },
  },
  "golden-hour": {
    label: "Golden hour",
    description: "Warm orange sunlight cast with soft highlights.",
    fn: (c) => {
      let o = splitTone(c, hex("#6b4a2e"), 0.12, hex("#ffbf69"), 0.35);
      o = warm(o, 0.5);
      return lift(o, 0.02, 0.97);
    },
  },
};

export const LUT_IDS = Object.keys(LOOKS);
export const LUT_LIBRARY = Object.entries(LOOKS).map(([id, v]) => ({
  id,
  label: v.label,
  description: v.description,
}));

export const applyLook = (id: string, c: RGB, intensity = 1): RGB => {
  const look = LOOKS[id];
  if (!look) return c;
  const out = look.fn(c).map(clamp01) as RGB;
  return intensity >= 1 ? out : mixRGB(c, out, intensity);
};

const cubeCache = new Map<string, string>();

/** Generates `.cube` text (Adobe/Resolve format) for a built-in look. */
export const getLutCube = (id: string, intensity = 1, size = 17): string | null => {
  if (!LOOKS[id]) return null;
  const key = `${id}|${Math.round(intensity * 100)}|${size}`;
  const cached = cubeCache.get(key);
  if (cached) return cached;
  const lines: string[] = [`TITLE "${LOOKS[id].label}"`, `LUT_3D_SIZE ${size}`, ""];
  const max = size - 1;
  // .cube order: red changes fastest.
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const [or, og, ob] = applyLook(id, [r / max, g / max, b / max], intensity);
        lines.push(`${or.toFixed(5)} ${og.toFixed(5)} ${ob.toFixed(5)}`);
      }
    }
  }
  const text = lines.join("\n");
  cubeCache.set(key, text);
  return text;
};

/** Blends an arbitrary `.cube` file toward identity (for uploaded LUTs with intensity < 1). */
export const blendCube = (cube: string, intensity: number): string => {
  if (intensity >= 1) return cube;
  const lines = cube.split(/\r?\n/);
  let size = 0;
  for (const line of lines) {
    const m = line.match(/^LUT_3D_SIZE\s+(\d+)/);
    if (m) size = Number(m[1]);
  }
  if (!size) return cube;
  const max = size - 1;
  let index = 0;
  return lines
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length !== 3 || parts.some((p) => Number.isNaN(Number(p)))) return line;
      const r = index % size;
      const g = Math.floor(index / size) % size;
      const b = Math.floor(index / (size * size));
      index++;
      const id: RGB = [r / max, g / max, b / max];
      const v = parts.map(Number) as RGB;
      return mixRGB(id, v, intensity)
        .map((x) => x.toFixed(5))
        .join(" ");
    })
    .join("\n");
};
