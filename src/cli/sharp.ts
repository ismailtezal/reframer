import { CliError } from "./errors";

type Sharp = typeof import("sharp").default;

let cached: Promise<Sharp> | null = null;

/** sharp (libvips) for decoding and tiling frames; installed with the app's image dependencies. */
export const loadSharp = () => {
  cached ??= import("sharp")
    .then((m) => (m as unknown as { default?: Sharp }).default ?? (m as unknown as Sharp))
    .catch(() => {
      cached = null;
      throw new CliError("E_ENV", "The image library (sharp) isn't installed", undefined, "Run `npm install` in the Reframer folder.");
    });
  return cached;
};

/** RGBA pixels of a PNG (optionally resized), for measuring what a frame shows. */
export const pixelsOf = async (png: Buffer, width?: number, height?: number) => {
  const sharp = await loadSharp();
  const img = sharp(png).ensureAlpha();
  const resized = width ? img.resize(width, height, { fit: "fill" }) : img;
  const { data, info } = await resized.raw().toBuffer({ resolveWithObject: true });
  return { px: data, w: info.width, h: info.height };
};

const escapeXml = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** One image with the frames in a grid, each labelled (the whole video at a glance). */
export const contactSheet = async (frames: { png: Buffer; label: string }[], opts: { columns?: number; tileWidth?: number } = {}) => {
  const sharp = await loadSharp();
  const cols = Math.min(opts.columns ?? 4, frames.length);
  const tw = opts.tileWidth ?? 480;
  const meta = await sharp(frames[0].png).metadata();
  const th = Math.round(((meta.height ?? 1080) / (meta.width ?? 1920)) * tw);
  const rows = Math.ceil(frames.length / cols);
  const gap = 4;
  const tiles = await Promise.all(
    frames.map(async (f) => {
      const label = Buffer.from(
        `<svg width="${tw}" height="${th}"><rect x="0" y="0" width="${Math.min(tw, 14 + f.label.length * 11)}" height="26" fill="rgba(0,0,0,0.72)"/><text x="7" y="19" font-family="Arial, sans-serif" font-size="17" font-weight="bold" fill="#fff">${escapeXml(f.label)}</text></svg>`,
      );
      return sharp(f.png)
        .resize(tw, th, { fit: "contain", background: "#000" })
        .composite([{ input: label, top: 0, left: 0 }])
        .png()
        .toBuffer();
    }),
  );
  return sharp({
    create: { width: cols * tw + (cols - 1) * gap, height: rows * th + (rows - 1) * gap, channels: 3, background: "#141414" },
  })
    .composite(tiles.map((input, i) => ({ input, left: (i % cols) * (tw + gap), top: Math.floor(i / cols) * (th + gap) })))
    .jpeg({ quality: 86 })
    .toBuffer();
};
