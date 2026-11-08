// Repaints a MakeHuman garment texture: covers its printed logo with nearby fabric, recolours its trims and prints
// your own text in fabric ink (slightly see-through, so the weave shows). Feed the result to rf3d_human.py's
// "garment_textures".
//   node garment-print.mjs --in <garment_diffuse.png> --out <shirt.png> --text "REFRAMER"
//        [--x 1147 --y 382 --size 54 --color "#f4f1ea" --font "Arial Black"]   where and how the text sits
//        [--cover 1147,372,178,-781,50]   cover the logo: centre x,y, radius, then copy fabric from dx,dy away
//        [--trim "#3a62b2"]               turn the orange trims this colour ("none" keeps them)
// Defaults fit male_casualsuit04's t-shirt (logo on the chest at 1147,372). Also writes <out>_crop.jpg of the print
// so you can check it before rendering.
import { loadSharp, parseArgs } from "./env.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.in || !args.out) {
  console.error('usage: node garment-print.mjs --in <diffuse.png> --out <png> --text "TEXT" [--x --y --size --color --cover --trim]');
  process.exit(2);
}
const sharp = loadSharp();
const img = sharp(String(args.in)).removeAlpha();
const { width: W, height: H } = await img.metadata();
const raw = await img.raw().toBuffer();
const ch = raw.length / (W * H); // read the real channel count: never assume 3

const trim = String(args.trim ?? "#3a62b2");
if (trim !== "none") {
  const [tr, tg, tb] = [1, 3, 5].map((i) => Number.parseInt(trim.slice(i, i + 2), 16));
  for (let i = 0; i < raw.length; i += ch) {
    const r = raw[i];
    const g = raw[i + 1];
    const b = raw[i + 2];
    if (r > 150 && r - b > 90 && g > 60 && r > g) {
      // keep the fabric's light and shade, change its hue
      const l = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
      const k = (0.55 + 0.6 * (l - 0.55)) / 0.55;
      raw[i] = Math.min(255, Math.round(tr * k));
      raw[i + 1] = Math.min(255, Math.round(tg * k));
      raw[i + 2] = Math.min(255, Math.round(tb * k));
    }
  }
}
const [cx, cy, R, dx, dy] = String(args.cover ?? "1147,372,178,-781,50").split(",").map(Number);
if (R > 0) {
  for (let y = cy - R; y <= cy + R; y++)
    for (let x = cx - R; x <= cx + R; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > R || x + dx < 0 || x + dx >= W || y + dy < 0 || y + dy >= H) continue;
      const a = Math.min(1, (R - d) / 18);
      const di = (y * W + x) * ch;
      const si = ((y + dy) * W + x + dx) * ch;
      for (let c = 0; c < 3; c++) raw[di + c] = Math.round(raw[di + c] * (1 - a) + raw[si + c] * a);
    }
}
const text = String(args.text ?? "").replace(/[<&>"]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;", '"': "&quot;" })[c]);
const x = Number(args.x ?? cx);
const y = Number(args.y ?? cy + 10);
const size = Number(args.size ?? 54);
const color = String(args.color ?? "#f4f1ea");
const font = String(args.font ?? "Arial Black, Segoe UI Black, Arial");
const layers = text
  ? [
      {
        input: Buffer.from(
          `<svg width="${W}" height="${H}"><text x="${x}" y="${y}" text-anchor="middle" font-family="${font}" font-weight="900" font-size="${size}" letter-spacing="2" fill="${color}" fill-opacity="0.9">${text}</text></svg>`,
        ),
        blend: "over",
      },
    ]
  : [];
const out = String(args.out);
await sharp(raw, { raw: { width: W, height: H, channels: ch } }).composite(layers).png().toFile(out);
const crop = out.replace(/\.png$/i, "") + "_crop.jpg";
const left = Math.max(0, Math.min(W - 600, x - 300));
const top = Math.max(0, Math.min(H - 500, y - 260));
await sharp(out).extract({ left, top, width: Math.min(600, W), height: Math.min(500, H) }).jpeg().toFile(crop);
console.log(JSON.stringify({ ok: true, out, crop, size: [W, H] }));
