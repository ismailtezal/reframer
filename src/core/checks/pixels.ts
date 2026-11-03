/**
 * Frames as plain RGBA pixel arrays, so the checks run the same on a canvas in the editor and on a
 * decoded PNG in the CLI.
 */

/** RGBA pixels, row by row (canvas ImageData, a decoded PNG, sharp's raw output). */
export type Pixels = { px: ArrayLike<number>; w: number; h: number };

/** Area-averaged resize: every target pixel is the mean of the source pixels it covers. */
export const resample = (src: Pixels, w: number, h: number): Pixels => {
  const out = new Float32Array(w * h * 4);
  const sx = src.w / w;
  const sy = src.h / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.min(src.h - 1, Math.floor(y * sy));
    const y1 = Math.max(y0 + 1, Math.min(src.h, Math.floor((y + 1) * sy)));
    for (let x = 0; x < w; x++) {
      const x0 = Math.min(src.w - 1, Math.floor(x * sx));
      const x1 = Math.max(x0 + 1, Math.min(src.w, Math.floor((x + 1) * sx)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.w + xx) * 4;
          r += src.px[i];
          g += src.px[i + 1];
          b += src.px[i + 2];
          a += src.px[i + 3];
        }
      }
      const n = (y1 - y0) * (x1 - x0);
      const o = (y * w + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = a / n;
    }
  }
  return { px: out, w, h };
};

/** WCAG relative luminance of an sRGB color (0–255 channels). */
export const luminance = (r: number, g: number, b: number) => {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/** WCAG contrast ratio of two relative luminances. */
export const contrastOf = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
