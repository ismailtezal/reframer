// Procedural Vox-style paper-collage pieces -> transparent PNGs (headless Chrome screenshots).
// usage: node draw.mjs [onlyName ...]   (run from the film folder)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import * as G from "./geo.mjs";

const ROOT = process.cwd();
const ART = path.join(ROOT, "art");
fs.mkdirSync(ART, { recursive: true });
// Any headless Chrome works; Reframer ships one with Remotion (set CHROME to use another).
const CH = process.env.CHROME ?? path.resolve("node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe");
const ONLY = process.argv.slice(2);

export const C = {
  ink: "#1F1712", paper: "#FBF6EA", cream: "#F3EAD7", news: "#EEE6D3", kraft: "#C9A57A",
  coffee: "#3B2317", coffeeDark: "#2A170E", coffeeMid: "#7A4A2E", crema: "#B9875A",
  red: "#E2412B", redDark: "#A8261A", green: "#2F6B45", greenD: "#1E4A30",
  ochre: "#D4952B", teal: "#155E63", porcelain: "#F8F4EA", copper: "#B8652F",
  ocean: "#EFE5CC", land: "#A8764F", mapSea: "#CFE0D6", mapLand: "#E6CC9F",
};

// ---------- helpers ----------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (n) => Math.round(n * 10) / 10;
let UID = 0; const uid = (p) => `${p}${++UID}`;
const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
function tornPath(pts, r, amp = 5, step = 9) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / step));
    const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
    let prev = 0;
    for (let k = 0; k < n; k++) {
      const t = k / n; let j = (r() * 2 - 1) * amp; j = prev * 0.45 + j * 0.55; prev = j;
      out.push([x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j]);
    }
  }
  return "M" + out.map((p) => f1(p[0]) + "," + f1(p[1])).join("L") + "Z";
}
function halftone({ x0, y0, x1, y1, fx, fy, R, step = 16, angle = 20, rmax = 6.5, color, opacity = 0.5, falloff = 1 }) {
  let s = `<g fill="${color}" opacity="${opacity}">`;
  const a = (angle * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const span = R + step;
  for (let u = -span; u <= span; u += step) for (let v = -span; v <= span; v += step) {
    const x = fx + u * ca - v * sa, y = fy + u * sa + v * ca;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    const d = Math.hypot(x - fx, y - fy) / R; if (d >= 1) continue;
    const rr = rmax * Math.pow(1 - d, falloff); if (rr < 0.7) continue;
    s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(rr)}"/>`;
  }
  return s + "</g>";
}
function tape(cx, cy, w, h, rot, seed) {
  const r = rng(seed);
  const p = tornPath(rectPts(cx - w / 2, cy - h / 2, w, h), r, 2.2, 6);
  return `<path d="${p}" transform="rotate(${rot} ${cx} ${cy})" fill="#F3E7BF" opacity="0.8" filter="url(#shdT)"/>`;
}
function clipping(x, y, w, h, seed, rot, { head = "", cols = 2, fill = C.news, photo = false } = {}) {
  const r = rng(seed); const id = uid("cp");
  const p = tornPath(rectPts(x + 2, y + 2, w - 4, h - 4), r, 4, 9);
  const rim = tornPath(rectPts(x - 2, y - 2, w + 4, h + 4), r, 5, 7);
  let s = ""; const pad = 22; let y0 = y + pad;
  if (head) { s += `<text x="${x + pad}" y="${y0 + 30}" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="34" fill="${C.ink}">${head}</text>`; y0 += 44; s += `<rect x="${x + pad}" y="${y0}" width="${w - 2 * pad}" height="3" fill="${C.ink}"/>`; y0 += 14; }
  const colW = (w - pad * 2 - (cols - 1) * 16) / cols;
  if (photo) { const ph = Math.min(150, (h - (y0 - y)) * 0.45); s += `<rect x="${x + pad}" y="${y0}" width="${colW}" height="${ph}" fill="#8f8270"/>` + halftone({ x0: x + pad, y0, x1: x + pad + colW, y1: y0 + ph, fx: x + pad + colW * 0.4, fy: y0 + ph * 0.4, R: ph * 1.4, step: 8, rmax: 3.6, color: C.ink, opacity: 0.8 }); }
  for (let c = 0; c < cols; c++) {
    const start = photo && c === 0 ? y0 + Math.min(150, (h - (y0 - y)) * 0.45) + 12 : y0;
    for (let yy = start; yy < y + h - pad; yy += 13) {
      if (r() < 0.06) continue; const lw = colW * (0.78 + 0.22 * r());
      s += `<rect x="${f1(x + pad + c * (colW + 16))}" y="${f1(yy)}" width="${f1(r() < 0.12 ? lw * 0.5 : lw)}" height="5" fill="#4d443c" opacity="0.5"/>`;
    }
  }
  return `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"><g filter="url(#shd)"><path d="${rim}" fill="${C.paper}"/></g><path d="${p}" fill="${fill}"/><clipPath id="${id}"><path d="${p}"/></clipPath><g clip-path="url(#${id})">${s}</g></g>`;
}
function scrap(x, y, w, h, seed, rot, fill, extra = "") {
  const r = rng(seed); const id = uid("sc");
  const p = tornPath(rectPts(x + 2, y + 2, w - 4, h - 4), r, 5, 9);
  const rim = tornPath(rectPts(x - 3, y - 3, w + 6, h + 6), r, 6, 7);
  return `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"><g filter="url(#shd)"><path d="${rim}" fill="${C.paper}"/></g><path d="${p}" fill="${fill}"/><clipPath id="${id}"><path d="${p}"/></clipPath><g clip-path="url(#${id})">${extra}</g></g>`;
}
function confetti(seed, n, allow, colors) {
  const r = rng(seed); let s = "";
  for (let i = 0; i < n; i++) {
    let x, y, tries = 0; do { x = r() * 1080; y = r() * 1920; tries++; } while (!allow(x, y) && tries < 50);
    if (tries >= 50) continue;
    const col = colors[Math.floor(r() * colors.length)], rot = f1(r() * 360), t = r(), k = 0.8 + r() * 0.7;
    if (t < 0.4) s += `<path d="M0,${-18 * k} L${16 * k},${12 * k} L${-16 * k},${12 * k} Z" fill="${col}" transform="translate(${f1(x)} ${f1(y)}) rotate(${rot})"/>`;
    else if (t < 0.68) s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(11 * k)}" fill="${col}"/>`;
    else s += `<path d="M0,0 l12,-12 l12,12 l12,-12 l12,12 l12,-12" fill="none" stroke="${col}" stroke-width="7" stroke-linejoin="miter" transform="translate(${f1(x)} ${f1(y)}) rotate(${rot})"/>`;
  }
  return `<g filter="url(#shdS)">${s}</g>`;
}
function bean(cx, cy, s, rot) {
  return `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${s})"><ellipse cx="0" cy="0" rx="26" ry="36" fill="#4A2A1B" stroke="${C.ink}" stroke-width="2.5"/><path d="M0,-30 C-12,-10 12,10 0,30" fill="none" stroke="${C.coffeeDark}" stroke-width="6" stroke-linecap="round"/><ellipse cx="-11" cy="-12" rx="6" ry="10" fill="#fff" opacity="0.18"/></g>`;
}

const DEFS = `
<filter id="stk" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
 <feMorphology in="SourceAlpha" operator="dilate" radius="11" result="d"/>
 <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="4" result="n"/>
 <feDisplacementMap in="d" in2="n" scale="13" xChannelSelector="R" yChannelSelector="G" result="r"/>
 <feFlood flood-color="${C.paper}"/><feComposite in2="r" operator="in" result="b"/>
 <feGaussianBlur in="r" stdDeviation="7" result="sb"/><feOffset in="sb" dx="6" dy="11" result="so"/>
 <feFlood flood-color="#120a05" flood-opacity="0.42"/><feComposite in2="so" operator="in" result="sh"/>
 <feMerge><feMergeNode in="sh"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="stkS" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
 <feMorphology in="SourceAlpha" operator="dilate" radius="6" result="d"/>
 <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="9" result="n"/>
 <feDisplacementMap in="d" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" result="r"/>
 <feFlood flood-color="${C.paper}"/><feComposite in2="r" operator="in" result="b"/>
 <feGaussianBlur in="r" stdDeviation="4" result="sb"/><feOffset in="sb" dx="3" dy="6" result="so"/>
 <feFlood flood-color="#120a05" flood-opacity="0.38"/><feComposite in2="so" operator="in" result="sh"/>
 <feMerge><feMergeNode in="sh"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="shd" x="-10%" y="-10%" width="125%" height="125%"><feDropShadow dx="5" dy="9" stdDeviation="6" flood-color="#120a05" flood-opacity="0.38"/></filter>
<filter id="shdS" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="3" dy="5" stdDeviation="3" flood-color="#120a05" flood-opacity="0.35"/></filter>
<filter id="shdT" x="-10%" y="-20%" width="120%" height="140%"><feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-color="#120a05" flood-opacity="0.22"/></filter>
<filter id="shdUp" x="-5%" y="-8%" width="110%" height="116%"><feDropShadow dx="0" dy="-10" stdDeviation="10" flood-color="#120a05" flood-opacity="0.5"/></filter>
<filter id="grain" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
 <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="5" result="n"/>
 <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.10  0 0 0 0 0.07  0 0 0 0 0.04  0.6 0 0 0 -0.25" result="d"/>
 <feComposite in="d" in2="SourceAlpha" operator="in" result="d2"/>
 <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 0.98  0 0 0 0 0.92  0 -0.55 0 0 0.25" result="l"/>
 <feComposite in="l" in2="SourceAlpha" operator="in" result="l2"/>
 <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="2" seed="21" result="m"/>
 <feColorMatrix in="m" type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.03  0 0 0 0 0.02  0.35 0 0 0 -0.12" result="m2"/>
 <feComposite in="m2" in2="SourceAlpha" operator="in" result="m3"/>
 <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="m3"/><feMergeNode in="d2"/><feMergeNode in="l2"/></feMerge>
</filter>`;

const html = (w, h, inner) => `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}svg{display:block}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${DEFS}</defs>${inner}</svg></body></html>`;
const jobs = [];
const manifest = {};
function piece(name, w, h, inner, dpr = 1.25) {
  manifest[name] = { w, h, png: `art/${name}.png` };
  if (ONLY.length && !ONLY.includes(name)) return;
  const hp = path.join(ART, name + ".html"); fs.writeFileSync(hp, html(w, h, inner));
  jobs.push({ name, w, h, hp, pp: path.join(ART, name + ".png"), dpr });
}
async function runJobs(conc = 5) {
  let i = 0;
  const one = (j) => new Promise((res) => {
    const p = spawn(CH, ["--headless", "--disable-gpu", "--hide-scrollbars", `--force-device-scale-factor=${j.dpr}`, "--default-background-color=00000000", `--window-size=${j.w},${j.h}`, `--screenshot=${j.pp}`, "file:///" + j.hp.replace(/\\/g, "/")], { stdio: "ignore" });
    const t = setTimeout(() => p.kill(), 120000);
    p.on("exit", () => { clearTimeout(t); res(); });
  });
  await Promise.all(Array.from({ length: conc }, async () => { while (i < jobs.length) { const j = jobs[i++]; const t0 = Date.now(); await one(j); console.error(`${j.name} ${((Date.now() - t0) / 1000).toFixed(1)}s ${fs.existsSync(j.pp) ? "ok" : "MISSING"}`); } }));
}

// ---------- sheets (backgrounds) ----------
// Sheet = 1160x2140, paper with a torn top edge at y~60; the 1080x1920 frame sits at (40,110). Shown centered at (540,960).
const SW = 1160, SH = 2140, OX = 40, OY = 110;
function sheet(name, { bg, dot, focal = [540, 1000], R = 760, seed, decor = "", dotOpacity = 0.55 }) {
  const r = rng(seed);
  const rimP = tornPath([[-40, 50], [SW + 40, 50], [SW + 40, SH + 40], [-40, SH + 40]], r, 7, 10);
  const topP = tornPath([[-40, 62], [SW + 40, 62], [SW + 40, SH + 40], [-40, SH + 40]], r, 6, 11);
  const id = uid("sh");
  const content = `<rect x="0" y="0" width="${SW}" height="${SH}" fill="${bg}"/>`
    + halftone({ x0: 0, y0: 0, x1: SW, y1: SH, fx: focal[0] + OX, fy: focal[1] + OY, R, step: 18, rmax: 7.5, color: dot, opacity: dotOpacity, angle: 18 })
    + halftone({ x0: 0, y0: 0, x1: SW, y1: SH, fx: OX - 40, fy: OY + 120, R: 420, step: 14, rmax: 5, color: dot, opacity: dotOpacity * 0.8, angle: 18 })
    + `<g transform="translate(${OX} ${OY})">${decor}</g>`;
  piece(name, SW, SH, `<g filter="url(#shdUp)"><path d="${rimP}" fill="${C.paper}"/></g><clipPath id="${id}"><path d="${topP}"/></clipPath><g clip-path="url(#${id})"><g filter="url(#grain)">${content}</g></g>`, 1);
}
const edge = (x, y) => (x < 170 || x > 910 || y > 1560) && y > 360 && !(y > 1330 && y < 1520 && x > 120 && x < 960);
sheet("sheet1", { bg: C.coffee, dot: "#24130B", seed: 11, focal: [540, 1060], R: 820,
  decor: clipping(40, 1560, 380, 300, 101, -7, { head: "KAHVE", cols: 2, photo: true })
    + scrap(760, 1600, 300, 260, 102, 6, C.kraft, halftone({ x0: 740, y0: 1580, x1: 1080, y1: 1880, fx: 900, fy: 1720, R: 220, step: 12, rmax: 5, color: "#8a6a45", opacity: 0.8 }))
    + tape(140, 1575, 150, 40, -12, 103) + tape(930, 1610, 140, 38, 18, 104)
    + confetti(105, 16, edge, [C.red, C.cream, C.red, C.kraft]) });
sheet("sheet2", { bg: C.ochre, dot: "#A86E14", seed: 21, focal: [560, 1040], R: 820,
  decor: clipping(690, 1580, 360, 290, 201, 5, { head: "1450", cols: 2 })
    + scrap(30, 1620, 330, 250, 202, -5, "#E8D3A8", halftone({ x0: 20, y0: 1600, x1: 380, y1: 1890, fx: 160, fy: 1740, R: 230, step: 12, rmax: 5, color: "#9c7a4c", opacity: 0.7 }))
    + tape(860, 1588, 150, 40, 10, 203) + confetti(205, 14, edge, [C.red, C.cream, C.coffee]) });
const tile = (x, y, s, seed) => {
  let t = ""; const n = 3, c = s / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const cx = x + c * (i + 0.5), cy = y + c * (j + 0.5);
    t += `<rect x="${f1(cx - c / 2)}" y="${f1(cy - c / 2)}" width="${f1(c)}" height="${f1(c)}" fill="#F4EEDF" stroke="#1b5f73" stroke-width="3"/>`
      + `<path d="M${cx},${cy - c * 0.42} L${cx + c * 0.12},${cy - c * 0.12} L${cx + c * 0.42},${cy} L${cx + c * 0.12},${cy + c * 0.12} L${cx},${cy + c * 0.42} L${cx - c * 0.12},${cy + c * 0.12} L${cx - c * 0.42},${cy} L${cx - c * 0.12},${cy - c * 0.12} Z" fill="#1b5f73"/>`
      + `<circle cx="${cx}" cy="${cy}" r="${f1(c * 0.1)}" fill="${C.red}"/>`;
  }
  return scrap(x, y, s, s, seed, 0, "#F4EEDF", t);
};
sheet("sheet3", { bg: C.teal, dot: "#0B3F43", seed: 31, focal: [540, 1020], R: 820,
  decor: `<g transform="rotate(-8 190 1720)">${tile(40, 1580, 300, 301)}</g>` + `<g transform="rotate(9 900 1720)">${tile(760, 1600, 270, 302)}</g>`
    + tape(190, 1585, 140, 38, -16, 303) + tape(900, 1608, 130, 36, 14, 304) + confetti(305, 12, edge, [C.red, C.cream, "#E9B949"]) });
let newsCols = "";
{ const r = rng(401); for (let c = 0; c < 6; c++) for (let y = 40; y < 1900; y += 15) { if (r() < 0.07) continue; newsCols += `<rect x="${30 + c * 172}" y="${y}" width="${f1(150 * (0.75 + 0.25 * r()))}" height="5" fill="#6b604f" opacity="0.22"/>`; } }
sheet("sheet4", { bg: "#E9DEC5", dot: "#BBA982", seed: 41, focal: [520, 1000], R: 800, dotOpacity: 0.6,
  decor: newsCols + `<text x="540" y="1700" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="120" fill="#6b604f" opacity="0.13">GAZETTE</text>`
    + clipping(40, 1600, 360, 260, 402, -6, { head: "CAFFÈ", cols: 2, photo: true }) + clipping(700, 1580, 350, 290, 403, 7, { head: "COFFEE", cols: 2 })
    + tape(210, 1606, 150, 40, 9, 404) + confetti(405, 10, edge, [C.red, C.coffee]) });
sheet("sheet5", { bg: "#2E1A11", dot: "#170C06", seed: 51, focal: [540, 1060], R: 860,
  decor: scrap(40, 1600, 320, 270, 501, -6, C.kraft, halftone({ x0: 20, y0: 1580, x1: 380, y1: 1890, fx: 180, fy: 1730, R: 230, step: 12, rmax: 5, color: "#8a6a45", opacity: 0.8 }))
    + clipping(720, 1590, 330, 280, 502, 6, { head: "DÜNYA", cols: 2, photo: true }) + tape(190, 1606, 150, 40, -10, 503) + tape(900, 1600, 140, 38, 12, 504)
    + confetti(505, 22, edge, [C.red, C.cream, C.red, C.kraft]) });

// ---------- globe ----------
const D = Math.PI / 180;
function globe(name, lon0, lat0, lands, { dots = [], routes = [], seed = 1 } = {}) {
  const S = 720, cx = 360, cy = 360, R = 310, p0 = lat0 * D;
  const pr = (lon, lat) => {
    const l = (lon - lon0) * D, p = lat * D;
    const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
    let x = R * Math.cos(p) * Math.sin(l), y = R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l));
    if (cosc < 0) { const m = Math.hypot(x, y) || 1; x = (x / m) * R; y = (y / m) * R; }
    return [cx + x, cy - y, cosc >= 0];
  };
  const dens = (poly) => { const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 1.5)); for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); } return out; };
  const polyD = (poly) => { const pts = dens(poly).map((q) => pr(q[0], q[1])); if (!pts.some((p) => p[2])) return ""; return "M" + pts.map((p) => f1(p[0]) + "," + f1(p[1])).join("L") + "Z"; };
  const line = (pts) => { let d = "", seg = []; for (const p of pts) { if (p[2]) seg.push(p); else { if (seg.length > 1) d += "M" + seg.map((q) => f1(q[0]) + "," + f1(q[1])).join("L"); seg = []; } } if (seg.length > 1) d += "M" + seg.map((q) => f1(q[0]) + "," + f1(q[1])).join("L"); return d; };
  let grat = "";
  for (let lon = -180; lon < 180; lon += 30) { const pts = []; for (let lat = -90; lat <= 90; lat += 3) pts.push(pr(lon, lat)); grat += line(pts); }
  for (let lat = -60; lat <= 60; lat += 30) { const pts = []; for (let lon = -180; lon <= 180; lon += 3) pts.push(pr(lon, lat)); grat += line(pts); }
  const slerp = (a, b, n) => { const v = (q) => [Math.cos(q[1] * D) * Math.cos(q[0] * D), Math.cos(q[1] * D) * Math.sin(q[0] * D), Math.sin(q[1] * D)]; const A = v(a), B = v(b); const om = Math.acos(Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])); const out = []; for (let k = 0; k <= n; k++) { const t = k / n; const s1 = Math.sin((1 - t) * om) / Math.sin(om), s2 = Math.sin(t * om) / Math.sin(om); const x = s1 * A[0] + s2 * B[0], y = s1 * A[1] + s2 * B[1], z = s1 * A[2] + s2 * B[2]; const lift = 1 + 0.12 * Math.sin(Math.PI * t); const lat = Math.asin(z) / D, lon = Math.atan2(y, x) / D; const p = pr(lon, lat); p[0] = cx + (p[0] - cx) * lift; p[1] = cy + (p[1] - cy) * lift; out.push(p); } return out; };
  const routeD = routes.map(([a, b]) => line(slerp(a, b, 40))).join("");
  const id = uid("gl");
  const dotsS = dots.map(([lon, lat, big]) => { const p = pr(lon, lat); return p[2] ? `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${big ? 15 : 10}" fill="${C.red}" stroke="${C.paper}" stroke-width="5"/>` : ""; }).join("");
  piece(name, S, S, `<g filter="url(#stk)"><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="${C.ocean}"/>
  <g clip-path="url(#${id})"><g filter="url(#grain)"><rect x="0" y="0" width="${S}" height="${S}" fill="${C.ocean}"/>
    <path d="${grat}" fill="none" stroke="${C.ink}" stroke-opacity="0.25" stroke-width="2"/>
    <path d="${lands.map(polyD).join("")}" fill="${C.land}" stroke="${C.ink}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="${G.SEAS.map(polyD).join("")}" fill="${C.ocean}" stroke="${C.ink}" stroke-width="2"/>
    ${halftone({ x0: 0, y0: 0, x1: S, y1: S, fx: cx + R * 0.8, fy: cy + R * 0.75, R: R * 1.5, step: 13, rmax: 5.6, color: C.ink, opacity: 0.5, angle: 15 })}
    <ellipse cx="${cx - R * 0.42}" cy="${cy - R * 0.45}" rx="${R * 0.26}" ry="${R * 0.14}" transform="rotate(-38 ${cx - R * 0.42} ${cy - R * 0.45})" fill="#fff" opacity="0.3"/></g></g>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${C.ink}" stroke-width="5"/>
  <path d="${routeD}" fill="none" stroke="${C.red}" stroke-width="6" stroke-dasharray="14 10" stroke-linecap="round"/>${dotsS}</g>`);
}
globe("globe1", 30, 22, G.LANDS, { dots: [[36.2, 7.3, true]] });
const KAFFA = [36.2, 7.3], MOCHA = [43.25, 13.3], IST = [28.98, 41.01], VEN = [12.33, 45.44], LON = [-0.13, 51.5], PAR = [2.35, 48.86], VIE = [16.37, 48.21], BRA = [-46.6, -23.5], NYC = [-74, 40.7], COL = [-75, 4.6];
globe("globe5", -18, 20, G.LANDS_WORLD, { dots: [[...KAFFA, true], [...IST, true], [...LON], [...PAR], [...BRA], [...NYC], [...COL], [...MOCHA]], routes: [[KAFFA, MOCHA], [MOCHA, IST], [IST, PAR], [IST, LON], [LON, NYC], [PAR, BRA], [BRA, COL]] });

// ---------- porcelain cup ----------
piece("cup", 600, 600, `<g transform="translate(0 40)"><g filter="url(#stk)">
  <ellipse cx="300" cy="470" rx="250" ry="50" fill="${C.porcelain}" stroke="${C.ink}" stroke-width="5"/>
  <ellipse cx="300" cy="462" rx="160" ry="26" fill="none" stroke="${C.ink}" stroke-opacity="0.35" stroke-width="3"/>
  <path d="M455,300 C548,282 562,402 445,412" fill="none" stroke="${C.ink}" stroke-width="36" stroke-linecap="round"/>
  <path d="M455,300 C548,282 562,402 445,412" fill="none" stroke="${C.porcelain}" stroke-width="25" stroke-linecap="round"/>
  <path d="M120,250 C120,380 180,455 300,455 C420,455 480,380 480,250 Z" fill="${C.porcelain}" stroke="${C.ink}" stroke-width="5"/>
  <clipPath id="cupc"><path d="M120,250 C120,380 180,455 300,455 C420,455 480,380 480,250 Z"/></clipPath>
  <g clip-path="url(#cupc)"><rect x="100" y="298" width="400" height="44" fill="${C.red}"/><rect x="100" y="352" width="400" height="7" fill="${C.ink}"/>
  ${halftone({ x0: 100, y0: 240, x1: 500, y1: 460, fx: 470, fy: 440, R: 310, step: 11, rmax: 4.6, color: C.ink, opacity: 0.42 })}</g>
  <ellipse cx="300" cy="250" rx="180" ry="38" fill="${C.porcelain}" stroke="${C.ink}" stroke-width="5"/>
  <ellipse cx="300" cy="252" rx="160" ry="29" fill="${C.coffeeDark}"/>
  <ellipse cx="288" cy="248" rx="110" ry="17" fill="${C.crema}" opacity="0.55"/></g>
  <g filter="url(#stkS)"><path d="M250,200 C210,160 290,130 250,80 C222,46 262,22 252,6" fill="none" stroke="${C.cream}" stroke-width="20" stroke-linecap="round"/>
  <path d="M345,205 C305,165 385,140 345,95 C320,66 352,46 348,30" fill="none" stroke="${C.cream}" stroke-width="15" stroke-linecap="round"/></g></g>`);

// ---------- coffee branch ----------
{
  const P = [[70, 650], [260, 480], [420, 260], [650, 70]];
  const bz = (t) => { const u = 1 - t; return [0, 1].map((k) => u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]); };
  const tan = (t) => { const a = bz(Math.max(0, t - 0.01)), b = bz(Math.min(1, t + 0.01)); return Math.atan2(b[1] - a[1], b[0] - a[0]) / D; };
  let leaves = "", cherries = ""; const r = rng(77);
  const leaf = (x, y, ang, L) => `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)}) scale(${f1(L / 175)})"><path d="M0,0 C35,-46 122,-50 175,0 C122,48 35,44 0,0 Z" fill="${C.green}" stroke="${C.ink}" stroke-width="3"/><path d="M0,0 C35,-46 122,-50 175,0 Z" fill="${C.greenD}"/><path d="M4,0 L168,0" stroke="#E9F0D8" stroke-opacity="0.5" stroke-width="3"/>${[40, 80, 120].map((q) => `<path d="M${q},0 L${q + 22},-20 M${q},0 L${q + 22},20" stroke="#E9F0D8" stroke-opacity="0.3" stroke-width="2"/>`).join("")}</g>`;
  [0.12, 0.27, 0.43, 0.58, 0.73, 0.88].forEach((t, i) => { const [x, y] = bz(t), a = tan(t); leaves += leaf(x, y, a + (i % 2 ? 62 : -62), 150 + r() * 50); if (i < 5) leaves += leaf(x, y, a + (i % 2 ? -70 : 70), 120 + r() * 30); });
  [0.2, 0.36, 0.52, 0.67, 0.82].forEach((t) => { const [x, y] = bz(t); const n = 4 + Math.floor(r() * 3); for (let k = 0; k < n; k++) { const ang = r() * 360 * D, d = 18 + r() * 22, cr = 19 + r() * 8; const cxx = x + Math.cos(ang) * d, cyy = y + Math.sin(ang) * d; const col = r() < 0.2 ? C.redDark : r() < 0.1 ? "#7FA35A" : C.red; cherries += `<circle cx="${f1(cxx)}" cy="${f1(cyy)}" r="${f1(cr)}" fill="${col}" stroke="${C.ink}" stroke-width="2.5"/><ellipse cx="${f1(cxx - cr * 0.35)}" cy="${f1(cyy - cr * 0.38)}" rx="${f1(cr * 0.28)}" ry="${f1(cr * 0.18)}" fill="#fff" opacity="0.55"/><circle cx="${f1(cxx + cr * 0.3)}" cy="${f1(cyy + cr * 0.35)}" r="3" fill="${C.ink}"/>`; } });
  piece("branch", 720, 720, `<g filter="url(#stk)"><path d="M${P[0]} C${P[1]} ${P[2]} ${P[3]}" fill="none" stroke="#5A3A22" stroke-width="15" stroke-linecap="round"/>${leaves}${cherries}</g>`);
}

// ---------- dhow (Yemen) ----------
piece("dhow", 520, 500, `<g transform="translate(10 20)"><g filter="url(#stk)">
  <path d="M250,30 L250,392" stroke="${C.ink}" stroke-width="10"/>
  <path d="M60,160 L452,32" stroke="#5A3A22" stroke-width="9" stroke-linecap="round"/>
  <path d="M66,162 L446,38 L300,368 Z" fill="${C.cream}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>
  <clipPath id="sailc"><path d="M66,162 L446,38 L300,368 Z"/></clipPath>
  <g clip-path="url(#sailc)"><path d="M140,120 L330,368 M250,80 L360,368 M360,50 L400,368" stroke="${C.kraft}" stroke-width="7"/>${halftone({ x0: 60, y0: 30, x1: 450, y1: 370, fx: 330, fy: 330, R: 260, step: 10, rmax: 4, color: C.ink, opacity: 0.35 })}</g>
  <path d="M250,30 L306,44 L250,58 Z" fill="${C.red}"/>
  <path d="M30,372 L480,372 C462,424 414,450 350,452 L150,452 C86,450 46,420 30,372 Z" fill="#5A3A22" stroke="${C.ink}" stroke-width="4"/>
  <path d="M40,392 L470,392" stroke="${C.red}" stroke-width="11"/>
  <path d="M60,418 L440,418" stroke="${C.kraft}" stroke-width="4" stroke-dasharray="10 12"/></g></g>`);

// ---------- maps ----------
function mapPiece(name, { lon0, lon1, lat0, lat1, W, H, lands, seas = [], hi = [], labels = [], dots = [], routes = [], seed, overlay = false, wave = true }) {
  const pad = 34, kx = (W - 2 * pad) / (lon1 - lon0), ky = (H - 2 * pad) / (lat1 - lat0);
  const pr = (lon, lat) => [pad + (lon - lon0) * kx, pad + (lat1 - lat) * ky];
  const pd = (poly) => "M" + poly.map((q) => pr(q[0], q[1]).map(f1).join(",")).join("L") + "Z";
  const r = rng(seed);
  const paperP = tornPath(rectPts(8, 8, W - 16, H - 16), r, 6, 10);
  const rimP = tornPath(rectPts(2, 2, W - 4, H - 4), r, 7, 8);
  const id = uid("mp");
  const lab = labels.map(([lon, lat, t, sz = 30, rot = 0, col = C.ink, it = true]) => { const [x, y] = pr(lon, lat); return `<text x="${f1(x)}" y="${f1(y)}" transform="rotate(${rot} ${f1(x)} ${f1(y)})" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" ${it ? 'font-style="italic"' : ""} font-size="${sz}" letter-spacing="2" fill="${col}" stroke="${C.paper}" stroke-width="6" paint-order="stroke">${t}</text>`; }).join("");
  const rts = routes.map(([a, b, bend = 0.25]) => { const A = pr(...a), B = pr(...b); const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2; const nx = -(B[1] - A[1]), ny = B[0] - A[0]; return `M${f1(A[0])},${f1(A[1])} Q${f1(mx + nx * bend)},${f1(my + ny * bend)} ${f1(B[0])},${f1(B[1])}`; }).join("");
  const dts = dots.map(([lon, lat, big]) => { const [x, y] = pr(lon, lat); return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${big ? 16 : 11}" fill="${C.red}" stroke="${C.paper}" stroke-width="5"/>`; }).join("");
  if (overlay) {
    piece(name, W, H, `<g filter="url(#shdS)">${hi.map((p) => `<path d="${pd(p)}" fill="${C.red}" fill-opacity="0.6" stroke="${C.redDark}" stroke-width="3"/>`).join("")}<path d="${rts}" fill="none" stroke="${C.red}" stroke-width="7" stroke-dasharray="16 11" stroke-linecap="round"/>${dts}${lab}</g>`);
    return;
  }
  let waves = ""; if (wave) for (let y = 40; y < H; y += 26) { let d = `M0,${y}`; for (let x = 0; x <= W; x += 30) d += ` Q${x + 7.5},${y - 5} ${x + 15},${y} T${x + 30},${y}`; waves += `<path d="${d}" fill="none" stroke="#7FAAA0" stroke-width="2" opacity="0.45"/>`; }
  piece(name, W, H, `<g filter="url(#shd)"><path d="${rimP}" fill="${C.paper}"/></g><clipPath id="${id}"><path d="${paperP}"/></clipPath>
  <g clip-path="url(#${id})"><g filter="url(#grain)"><rect x="0" y="0" width="${W}" height="${H}" fill="${C.mapSea}"/>${waves}
  <path d="${lands.map(pd).join("")}" fill="${C.mapLand}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round"/>
  <path d="${seas.map(pd).join("")}" fill="${C.mapSea}" stroke="${C.ink}" stroke-width="2.5"/>
  ${halftone({ x0: 0, y0: 0, x1: W, y1: H, fx: W * 0.85, fy: H * 0.85, R: Math.max(W, H) * 0.9, step: 12, rmax: 4.2, color: "#8B6B45", opacity: 0.45 })}
  ${hi.map((p) => `<path d="${pd(p)}" fill="${C.red}" stroke="${C.ink}" stroke-width="3"/>` + `<clipPath id="${id}h"><path d="${pd(p)}"/></clipPath><g clip-path="url(#${id}h)">${halftone({ x0: 0, y0: 0, x1: W, y1: H, fx: W * 0.3, fy: H * 0.7, R: W, step: 10, rmax: 3.5, color: C.redDark, opacity: 0.8 })}</g>`).join("")}
  <rect x="26" y="26" width="${W - 52}" height="${H - 52}" fill="none" stroke="${C.ink}" stroke-width="3"/>${dts}${lab}</g></g>`);
}
const hornBox = { lon0: 29, lon1: 55, lat0: -2, lat1: 24, W: 820, H: 820 };
mapPiece("map2", { ...hornBox, lands: G.LANDS, hi: [G.ETHIOPIA], seed: 601, dots: [[...KAFFA, true]],
  labels: [[39.2, 10.3, "ETİYOPYA", 36], [39.6, 19.2, "Kızıldeniz", 24, -52, "#2E6B66"], [33.2, 21.5, "MISIR", 22, 0, "#6b5a45", false], [46, 22.4, "ARABİSTAN", 22, 0, "#6b5a45", false], [49.5, 6.2, "SOMALİ", 20, 0, "#6b5a45", false], [36.4, 5.1, "Kaffa", 24]] });
mapPiece("route2", { ...hornBox, lands: [], hi: [G.YEMEN], seed: 602, overlay: true, routes: [[KAFFA, MOCHA, 0.3]], dots: [[...MOCHA, true]], labels: [[47.6, 17.2, "YEMEN", 34], [41.6, 14.1, "Muha", 24]] });
const euBox = { lon0: -11, lon1: 42, lat0: 34, lat1: 61, W: 900, H: 700 };
mapPiece("map4", { ...euBox, lands: G.LANDS, seas: [G.BLACK_SEA], seed: 701, dots: [[...IST, true]], labels: [[29, 39.2, "İSTANBUL", 28]] });
mapPiece("route4", { ...euBox, lands: [], seed: 702, overlay: true, routes: [[IST, VEN, 0.18], [IST, VIE, 0.12], [IST, PAR, 0.16], [IST, LON, 0.2]], dots: [[...VEN], [...VIE], [...PAR], [...LON]],
  labels: [[12.4, 44.2, "Venedik", 24], [16.4, 49.6, "Viyana", 24], [2.4, 47.6, "Paris", 24], [-0.1, 52.8, "Londra", 24]] });

// ---------- Istanbul skyline ----------
{
  const r = rng(801); const id = uid("sk");
  const paperP = tornPath(rectPts(24, 34, 1012, 532), r, 6, 10), rimP = tornPath(rectPts(16, 26, 1028, 548), r, 7, 8);
  const ink = C.ink;
  let sil = `<rect x="0" y="468" width="1060" height="60" fill="${ink}"/>`;
  sil += `<rect x="225" y="398" width="490" height="80" fill="${ink}"/><rect x="335" y="318" width="270" height="90" fill="${ink}"/>`;
  sil += `<path d="M330,322 A140,140 0 0 1 610,322 Z" fill="${ink}"/><rect x="466" y="140" width="8" height="48" fill="${ink}"/><path d="M470,112 a16,16 0 1 0 12,26 a12,12 0 1 1 -12,-26 Z" fill="${ink}"/>`;
  sil += `<path d="M222,404 A80,80 0 0 1 382,404 Z" fill="${ink}"/><path d="M558,404 A80,80 0 0 1 718,404 Z" fill="${ink}"/>`;
  sil += `<path d="M145,450 A38,38 0 0 1 221,450 Z" fill="${ink}"/><path d="M752,450 A40,40 0 0 1 832,450 Z" fill="${ink}"/>`;
  for (const x of [190, 245, 695, 750]) sil += `<rect x="${x - 8}" y="178" width="16" height="300" fill="${ink}"/><path d="M${x - 11},182 L${x},104 L${x + 11},182 Z" fill="${ink}"/><rect x="${x - 15}" y="250" width="30" height="9" fill="${ink}"/><rect x="${x - 15}" y="322" width="30" height="9" fill="${ink}"/>`;
  sil += `<rect x="868" y="248" width="72" height="230" fill="${ink}"/><path d="M856,254 L904,160 L952,254 Z" fill="${ink}"/><rect x="854" y="240" width="100" height="14" fill="${ink}"/>`;
  for (const y of [290, 340, 390]) sil += `<rect x="886" y="${y}" width="10" height="22" fill="${C.cream}"/><rect x="912" y="${y}" width="10" height="22" fill="${C.cream}"/>`;
  for (const [x, w, h] of [[40, 60, 60], [96, 46, 84], [970, 56, 70], [1010, 40, 50]]) sil += `<rect x="${x}" y="${470 - h}" width="${w}" height="${h}" fill="${ink}"/><path d="M${x - 4},${472 - h} L${x + w / 2},${450 - h} L${x + w + 4},${472 - h} Z" fill="${ink}"/>`;
  let wv = ""; for (let y = 500; y < 560; y += 14) wv += `<path d="M0,${y} q15,-6 30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0" fill="none" stroke="${C.cream}" stroke-width="2.5" opacity="0.6"/>`;
  const birds = [[300, 120], [340, 95], [620, 140], [655, 118]].map(([x, y]) => `<path d="M${x - 14},${y - 6} q7,4 14,8 q7,-4 14,-8" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`).join("");
  piece("skyline", 1060, 600, `<g filter="url(#shd)"><path d="${rimP}" fill="${C.paper}"/></g><clipPath id="${id}"><path d="${paperP}"/></clipPath>
  <g clip-path="url(#${id})"><g filter="url(#grain)"><rect x="0" y="0" width="1060" height="600" fill="#EFE3C8"/>
  <circle cx="800" cy="215" r="120" fill="${C.red}"/>${halftone({ x0: 680, y0: 95, x1: 920, y1: 335, fx: 840, fy: 260, R: 170, step: 11, rmax: 4.6, color: C.redDark, opacity: 0.9 })}
  ${halftone({ x0: 0, y0: 0, x1: 1060, y1: 600, fx: 120, fy: 60, R: 380, step: 13, rmax: 4.5, color: "#B79E74", opacity: 0.6 })}
  ${sil}<rect x="0" y="496" width="1060" height="70" fill="#1B5C67"/>${wv}${birds}</g></g>`);
}

// ---------- cezve + fincan ----------
piece("cezve", 660, 560, `<g transform="translate(10 10)"><g filter="url(#stk)">
  <path d="M268,292 L560,150 L578,184 L282,326 Z" fill="#5A3A22" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M120,480 C88,480 76,446 94,404 C110,360 142,330 152,292 L150,262 L276,262 L274,292 C284,330 316,360 332,404 C350,446 338,480 306,480 Z" fill="${C.copper}" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M128,440 C122,400 150,360 170,330 L184,330 C168,370 150,405 158,445 Z" fill="#E7A56A" opacity="0.75"/>
  <clipPath id="czc"><path d="M120,480 C88,480 76,446 94,404 C110,360 142,330 152,292 L150,262 L276,262 L274,292 C284,330 316,360 332,404 C350,446 338,480 306,480 Z"/></clipPath>
  <g clip-path="url(#czc)">${halftone({ x0: 80, y0: 260, x1: 350, y1: 490, fx: 330, fy: 470, R: 260, step: 10, rmax: 4.2, color: "#4a2410", opacity: 0.55 })}<rect x="80" y="380" width="280" height="10" fill="${C.red}"/></g>
  <ellipse cx="213" cy="262" rx="66" ry="13" fill="#7a3d18" stroke="${C.ink}" stroke-width="4"/>
  <path d="M150,256 L118,240 L154,272 Z" fill="${C.copper}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round"/>
  <ellipse cx="500" cy="482" rx="118" ry="24" fill="${C.porcelain}" stroke="${C.ink}" stroke-width="4"/>
  <path d="M424,382 L576,382 C574,438 548,470 500,470 C452,470 426,438 424,382 Z" fill="${C.porcelain}" stroke="${C.ink}" stroke-width="5"/>
  <clipPath id="fnc"><path d="M424,382 L576,382 C574,438 548,470 500,470 C452,470 426,438 424,382 Z"/></clipPath>
  <g clip-path="url(#fnc)"><rect x="420" y="398" width="160" height="18" fill="${C.red}"/>${[440, 470, 500, 530, 560].map((x) => `<circle cx="${x}" cy="432" r="6" fill="${C.red}"/>`).join("")}${halftone({ x0: 420, y0: 380, x1: 580, y1: 472, fx: 570, fy: 465, R: 150, step: 9, rmax: 3.4, color: C.ink, opacity: 0.4 })}</g>
  <ellipse cx="500" cy="382" rx="76" ry="13" fill="${C.porcelain}" stroke="${C.ink}" stroke-width="4"/><ellipse cx="500" cy="383" rx="64" ry="9" fill="${C.coffeeDark}"/></g>
  <g filter="url(#stkS)"><path d="M480,350 C455,320 505,300 482,268 C466,246 490,230 486,214" fill="none" stroke="${C.cream}" stroke-width="13" stroke-linecap="round"/><path d="M215,236 C190,206 240,186 217,154 C201,132 225,116 221,100" fill="none" stroke="${C.cream}" stroke-width="15" stroke-linecap="round"/></g></g>`);

// ---------- takeaway cup ----------
piece("togo", 320, 440, `<g transform="translate(10 10)"><g filter="url(#stk)">
  <path d="M60,92 L240,92 L216,408 L84,408 Z" fill="${C.porcelain}" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M68,178 L232,178 L222,300 L78,300 Z" fill="${C.kraft}" stroke="${C.ink}" stroke-width="4"/>
  <circle cx="150" cy="239" r="38" fill="${C.red}" stroke="${C.ink}" stroke-width="3"/>${bean(150, 239, 0.62, 25)}
  <clipPath id="tgc"><path d="M60,92 L240,92 L216,408 L84,408 Z"/></clipPath><g clip-path="url(#tgc)">${halftone({ x0: 50, y0: 90, x1: 250, y1: 410, fx: 240, fy: 400, R: 260, step: 10, rmax: 4, color: C.ink, opacity: 0.4 })}</g>
  <path d="M40,96 L260,96 L252,66 L48,66 Z" fill="#2A1F19" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M70,66 C80,30 220,30 230,66 Z" fill="#2A1F19" stroke="${C.ink}" stroke-width="4"/><rect x="132" y="38" width="36" height="8" rx="4" fill="#5a4a40"/></g></g>`);

// ---------- orbit ring + beans ----------
piece("ring", 1000, 520, `<g filter="url(#shdS)" transform="rotate(-10 500 260)"><ellipse cx="500" cy="260" rx="455" ry="150" fill="none" stroke="${C.red}" stroke-width="8" stroke-dasharray="20 13" stroke-linecap="round"/><path d="M60,250 L44,290 L86,282 Z" fill="${C.red}"/></g>`);
{
  const r = rng(901); let s = "";
  const spots = [[90, 1430], [170, 1500], [60, 1560], [990, 1440], [920, 1510], [1015, 1575], [70, 820], [1010, 760], [130, 1640], [960, 1660]];
  for (const [x, y] of spots) s += bean(x, y, 0.9 + r() * 0.5, f1(r() * 360));
  piece("beans", 1080, 1920, `<g filter="url(#stkS)">${s}</g>`, 1);
}

await runJobs(6);
fs.writeFileSync(path.join(ROOT, "art", "manifest.json"), JSON.stringify(manifest, null, 1));
console.log(JSON.stringify({ ok: true, rendered: jobs.length }));
