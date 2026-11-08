// Textures and height maps for the island shots (generic UI, no real brand logos):
// phone screens (3 states), video-call laptop screen, coconut marker faces, sign paint,
// sand-writing height map, footprint-loop height + heat density maps.
//   node textures.mjs <out-dir> [--sign "REFRAMER" --sign2 "ADA OFİSİ"]
// The on-screen words are the example's (Turkish UI); change them for your own story.
import fs from "node:fs";
import path from "node:path";
import { loadSharp, parseArgs } from "../../env.mjs";
const sharp = loadSharp();
const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(args._[0] ?? "tex");
const SIGN = String(args.sign ?? "REFRAMER").replace(/[<&>]/g, "");
const SIGN2 = String(args.sign2 ?? "ADA OFİSİ").replace(/[<&>]/g, "");
fs.mkdirSync(OUT, { recursive: true });
const svgPng = (svg, file) => sharp(Buffer.from(svg)).png().toFile(path.join(OUT, file));
const UI = "Segoe UI, Arial, sans-serif";

// ---------------------------------------------------------------- phone screens 720x1560
const status = `<text x="60" y="70" font-family="${UI}" font-size="34" font-weight="600" fill="#fff">09:41</text>
  <text x="660" y="70" text-anchor="end" font-family="${UI}" font-size="30" font-weight="600" fill="#ff5a52">Servis Yok</text>`;
const bars = (x, y) => [0, 1, 2, 3].map((i) => `<rect x="${x + i * 16}" y="${y - (i + 1) * 9}" width="10" height="${(i + 1) * 9}" rx="2" fill="#5a5d66"/>`).join("") +
  `<line x1="${x - 6}" y1="${y + 4}" x2="${x + 64}" y2="${y - 44}" stroke="#ff5a52" stroke-width="7" stroke-linecap="round"/>`;
const card = (y, title, body, accent) => `<g transform="translate(40 ${y})">
  <rect width="640" height="150" rx="34" fill="#2a2c33" fill-opacity="0.96"/>
  <rect x="28" y="30" width="90" height="90" rx="22" fill="${accent}"/>
  <text x="146" y="70" font-family="${UI}" font-size="34" font-weight="700" fill="#fff">${title}</text>
  <text x="146" y="118" font-family="${UI}" font-size="30" fill="#ff8a84">${body}</text></g>`;
const phone = (cards) => `<svg width="720" height="1560" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a44"/><stop offset="1" stop-color="#0b0f17"/></linearGradient></defs>
  <rect width="720" height="1560" fill="url(#bg)"/>${status}
  <g transform="translate(360 520)">${bars(-40, 0)}</g>
  <text x="360" y="640" text-anchor="middle" font-family="${UI}" font-size="76" font-weight="800" fill="#fff">Sinyal yok</text>
  <text x="360" y="700" text-anchor="middle" font-family="${UI}" font-size="32" fill="#9aa3b2">Şebeke bulunamadı</text>
  ${cards}</svg>`;
await svgPng(phone(""), "phone_a.png");
await svgPng(phone(card(820, "Slack", "Bağlanılamıyor", "#7b5cc4")), "phone_b.png");
await svgPng(phone(card(820, "Slack", "Bağlanılamıyor", "#7b5cc4") + card(1000, "Mail", "Gönderilemedi (1)", "#2f7de1")), "phone_c.png");

// ---------------------------------------------------------------- laptop video-call screen 1600x1000
const camOff = (x, y) => `<g transform="translate(${x} ${y})"><rect x="0" y="8" width="44" height="32" rx="6" fill="none" stroke="#e8e8ec" stroke-width="5"/>
  <path d="M44 18 L62 8 L62 40 L44 30 Z" fill="none" stroke="#e8e8ec" stroke-width="5" stroke-linejoin="round"/>
  <line x1="-4" y1="46" x2="64" y2="2" stroke="#ff5a52" stroke-width="6" stroke-linecap="round"/></g>`;
const tile = (x, y, n) => `<g transform="translate(${x} ${y})"><rect width="740" height="400" rx="18" fill="#1f2127"/>
  <circle cx="370" cy="175" r="78" fill="#6b4a2c"/><text x="370" y="200" text-anchor="middle" font-family="${UI}" font-size="66" font-weight="700" fill="#f3e6d6">HC</text>
  <rect x="18" y="338" width="330" height="46" rx="10" fill="#000" fill-opacity="0.45"/>
  <text x="34" y="372" font-family="${UI}" font-size="30" fill="#fff">Hindistan Cevizi ${n}</text>${camOff(650, 334)}</g>`;
const laptop = `<svg width="1600" height="1000" xmlns="http://www.w3.org/2000/svg"><rect width="1600" height="1000" fill="#121317"/>
  <text x="40" y="58" font-family="${UI}" font-size="34" font-weight="700" fill="#fff">Günlük Toplantı · 09:00</text>
  <text x="1560" y="58" text-anchor="end" font-family="${UI}" font-size="30" fill="#9aa3b2">5 katılımcı · kameralar kapalı</text>
  ${tile(40, 90, 1)}${tile(820, 90, 2)}${tile(40, 510, 3)}${tile(820, 510, 4)}
  <rect x="0" y="930" width="1600" height="70" fill="#0c0d10"/><rect x="1380" y="942" width="180" height="46" rx="23" fill="#e5484d"/>
  <text x="1470" y="975" text-anchor="middle" font-family="${UI}" font-size="28" font-weight="700" fill="#fff">Ayrıl</text></svg>`;
await svgPng(laptop, "laptop_call.png");

// ---------------------------------------------------------------- coconut marker faces 512x512 (transparent)
const ink = `stroke="#000" stroke-width="20" stroke-linecap="round" fill="none"`;
const faces = [
  `<circle cx="180" cy="210" r="22" fill="#000"/><circle cx="330" cy="210" r="22" fill="#000"/><path d="M170 330 Q255 400 345 330" ${ink}/>`,
  `<path d="M150 215 Q180 195 210 215" ${ink}/><path d="M300 215 Q330 195 360 215" ${ink}/><path d="M200 340 L310 340" ${ink}/>`,
  `<circle cx="180" cy="215" r="26" ${ink}/><circle cx="330" cy="215" r="26" ${ink}/><ellipse cx="255" cy="345" rx="34" ry="44" ${ink}/>`,
  `<path d="M150 220 L210 220" ${ink}/><path d="M300 220 L360 220" ${ink}/><path d="M190 335 Q255 370 320 335" ${ink}/><path d="M150 170 L205 190" ${ink}/><path d="M360 170 L305 190" ${ink}/>`,
];
for (const [i, f] of faces.entries()) await svgPng(`<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">${f}</svg>`, `coco_face${i + 1}.png`);

// ---------------------------------------------------------------- sign paint 1024x400 (white on transparent)
await svgPng(`<svg width="1024" height="400" xmlns="http://www.w3.org/2000/svg">
  <text x="512" y="190" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="120" letter-spacing="4" fill="#fff">${SIGN}</text>
  <text x="512" y="320" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="92" letter-spacing="6" fill="#fff">${SIGN2}</text></svg>`, "sign_paint.png");

// ---------------------------------------------------------------- height maps (float32 little-endian, row 0 = +Y edge)
async function mask(svg, w, h) {
  const { data, info } = await sharp(Buffer.from(svg)).resize(w, h).raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) out[i] = data[i * info.channels];
  return out;
}
async function blur(buf, w, h, sigma) {
  if (sigma <= 0) return buf;
  const { data, info } = await sharp(buf, { raw: { width: w, height: h, channels: 1 } }).blur(sigma).raw().toBuffer({ resolveWithObject: true });
  if (info.channels === 1) return data;
  const out = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) out[i] = data[i * info.channels];
  return out;
}
function writeF32(file, arr, meta) {
  fs.writeFileSync(path.join(OUT, file), Buffer.from(new Float32Array(arr).buffer));
  fs.writeFileSync(path.join(OUT, file.replace(/\.f32$/, ".json")), JSON.stringify(meta));
}
// sand writing: 1.7 m x 2.5 m at 4 mm/px (three lines, fits a vertical frame)
{
  const W = 425, H = 625, res = 0.004, cx = 1.5, cy = -1.9;
  const F = "Segoe Print, Ink Free, Comic Sans MS";
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="#000"/>
    <text x="${W / 2}" y="150" text-anchor="middle" font-family="${F}" font-size="112" fill="#fff">SOS</text>
    <path d="M${W / 2 - 140} 110 L${W / 2 + 140} 98" stroke="#fff" stroke-width="9" stroke-linecap="round"/>
    <text x="${W / 2}" y="345" text-anchor="middle" font-family="${F}" font-size="104" fill="#fff">WiFi</text>
    <text x="${W / 2}" y="520" text-anchor="middle" font-family="${F}" font-size="76" fill="#fff">ŞİFRESİ?</text></svg>`;
  const m = await mask(svg, W, H);
  const g = await blur(m, W, H, 1.6), r = await blur(m, W, H, 5);
  const hgt = new Array(W * H);
  for (let i = 0; i < W * H; i++) hgt[i] = -0.014 * (g[i] / 255) + 0.006 * Math.max(0, r[i] / 255 - g[i] / 255) * 1.6;
  writeF32("writing.f32", hgt, { W, H, res, cx, cy });
  await sharp(m, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(OUT, "writing_mask_preview.png"));
}
// footprints: two laps along the shore, island-wide map 15 m x 15 m (2048 px, 7.3 mm/px), row 0 = +Y edge
{
  const W = 2048, H = 2048, size = 15.0, res = size / W, x0 = -size / 2, y1 = size / 2;
  const shoreR = (a) => 5.4 * (1 + 0.10 * Math.sin(3 * a + 0.7) + 0.06 * Math.sin(5 * a + 2.1) + 0.035 * Math.sin(9 * a + 0.3));
  const px = (x) => (x - x0) / res, py = (y) => (y1 - y) / res;
  const foot = (x, y, ang, left) => {
    const s = (left ? -1 : 1) / res / 100; // shape drawn in cm units
    return `<g transform="translate(${px(x).toFixed(1)} ${py(y).toFixed(1)}) rotate(${((-ang * 180) / Math.PI + 90).toFixed(1)}) scale(${(s * (left ? 1 : 1)).toFixed(3)} ${Math.abs(s).toFixed(3)})">
      <ellipse cx="0" cy="8" rx="4.2" ry="5.2" fill="#fff"/><ellipse cx="0.6" cy="-2" rx="4.6" ry="6.5" fill="#fff"/>
      <circle cx="-3.4" cy="-10.8" r="1.7" fill="#fff"/><circle cx="-1.2" cy="-11.6" r="1.4" fill="#fff"/><circle cx="0.9" cy="-11.4" r="1.3" fill="#fff"/>
      <circle cx="2.8" cy="-10.6" r="1.2" fill="#fff"/><circle cx="4.3" cy="-9.2" r="1.1" fill="#fff"/></g>`;
  };
  const prints = [];
  for (const [k, ph] of [[0.66, 0.0], [0.74, 0.17]]) {
    let a = ph, prev = null, left = true;
    const pts = [];
    for (let i = 0; i <= 4000; i++) { const aa = ph + (2 * Math.PI * i) / 4000; const r = k * shoreR(aa); pts.push([r * Math.cos(aa), r * Math.sin(aa)]); }
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [xa, ya] = pts[i - 1], [xb, yb] = pts[i];
      acc += Math.hypot(xb - xa, yb - ya);
      if (acc < 0.36) continue;
      acc = 0;
      const tang = Math.atan2(yb - ya, xb - xa);
      const off = left ? 0.085 : -0.085;
      prints.push(foot(xb - Math.sin(tang) * off, yb + Math.cos(tang) * off, tang, left));
      left = !left;
    }
  }
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="#000"/>${prints.join("")}</svg>`;
  const m = await mask(svg, W, H);
  const g = await blur(m, W, H, 1.1), r = await blur(m, W, H, 3.4), d = await blur(m, W, H, 22);
  const hgt = new Array(W * H), heat = new Array(W * H);
  let dmax = 1;
  for (let i = 0; i < W * H; i++) dmax = Math.max(dmax, d[i]);
  for (let i = 0; i < W * H; i++) {
    hgt[i] = -(g[i] / 255) + 0.45 * Math.max(0, r[i] / 255 - g[i] / 255);
    heat[i] = d[i] / dmax;
  }
  writeF32("prints.f32", hgt, { W, H, res, x0, y1, size });
  writeF32("heat.f32", heat, { W, H, res, x0, y1, size });
  await sharp(m, { raw: { width: W, height: H, channels: 1 } }).resize(512, 512).png().toFile(path.join(OUT, "prints_mask_preview.png"));
  console.log("footprints", prints.length);
}
console.log("textures done ->", OUT);
