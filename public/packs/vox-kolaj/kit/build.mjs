// Timeline builder for "Stil Vox Kolaj".
//   node build.mjs add            -> ops1.json (all clips, stacking order)
//   node build.mjs kf show.json   -> ops2.json (keyframes + captions), ids looked up by clip name
import fs from "node:fs";

const A = { sheet1: "asset_q2dec5", sheet2: "asset_f48mux", sheet3: "asset_hbg84x", sheet4: "asset_15a1f4", sheet5: "asset_ib5jj6", globe1: "asset_vidys0", globe5: "asset_cvb0ff", cup: "asset_l4rctq", branch: "asset_91qifz", dhow: "asset_s986dt", map2: "asset_xdsr0i", route2: "asset_ko487c", map4: "asset_gffk5x", route4: "asset_8np1wa", skyline: "asset_0al3gr", cezve: "asset_yke63h", togo: "asset_bdgj6y", ring: "asset_9wqzuu", beans: "asset_e3y91q", vo: "asset_h3g1zm", music: "asset_ldhwy0", paper: "asset_25qtxj", stamp: "asset_u3mz90" };
const COL = { ink: "#1F1712", paper: "#FBF6EA", cream: "#F3EAD7", red: "#E2412B", kraft: "#C9A57A" };
const END = 15.2, VO_AT = 0.3, HOLD = 0.45, SLIDE = 0.42;
const T = { b1: 0, b2: 2.52, b3: 6.92, b4: 10.98, b5: 12.5 };
const endOf = { b1: T.b2 + HOLD, b2: T.b3 + HOLD, b3: T.b4 + HOLD, b4: T.b5 + HOLD, b5: END };

// ---- visual clips in stacking order (bottom -> top) ----
const V = [];
const img = (name, asset, beat, start, box, motion, anim) => V.push({ kind: "image", name, asset, beat, start, end: endOf[beat], ...box, motion, anim });
const strip = (name, beat, start, text, { size, fg, bg, x, y, rot, font = "Playfair Display", weight = 900, italic = false, padX = 30 }) =>
  V.push({ kind: "text", name, beat, start, end: endOf[beat], text, size, fg, bg, x, y, rot, font, weight, italic, padX });

// B1 hook: "Kahve dünyayı nasıl ele geçirdi?"
img("b1 sheet", A.sheet1, "b1", 0, { x: 540, y: 960, w: 1160, h: 2140, rot: 0 }, { type: "sheet", first: true });
img("b1 globe", A.globe1, "b1", 0, { x: 540, y: 1165, w: 540, h: 540, rot: 0 }, { type: "enter", te: 0.6, ease: "smooth", from: { scale: 0.9, rot: -8 }, drift: { rot: 6, scale: 0.03 } });
img("b1 cup", A.cup, "b1", 0.3, { x: 545, y: 790, w: 370, h: 370, rot: -3 }, { type: "enter", te: 0.5, from: { dy: -780, rot: -18 }, drift: { dy: -8, rot: 2 } });
img("b1 beans", A.beans, "b1", 0, { x: 540, y: 960, w: 1080, h: 1920, rot: 0 }, { type: "enter", te: 0.45, ease: "smooth", from: { scale: 1.06 }, drift: { dy: -24 } });
strip("b1 KAHVE", "b1", 0.05, "KAHVE", { size: 156, fg: COL.paper, bg: COL.red, x: 540, y: 446, rot: -3 });
strip("b1 DUNYAYI", "b1", 0.62, "DÜNYAYI NASIL", { size: 68, fg: COL.ink, bg: COL.cream, x: 520, y: 622, rot: 2 });
strip("b1 ELE", "b1", 1.52, "ELE GEÇİRDİ?", { size: 68, fg: COL.cream, bg: COL.ink, x: 578, y: 716, rot: -2 });

// B2 origins: Etiyopya -> Yemen
img("b2 sheet", A.sheet2, "b2", T.b2, { x: 540, y: 960, w: 1160, h: 2140, rot: 0 }, { type: "sheet" });
img("b2 map", A.map2, "b2", 2.72, { x: 540, y: 1065, w: 760, h: 760, rot: -2 }, { type: "enter", te: 0.55, from: { dx: -900, rot: -14 }, drift: { dx: -8, dy: -10, rot: 1, scale: 0.035 } });
img("b2 route", A.route2, "b2", 5.38, { x: 540, y: 1065, w: 760, h: 760, rot: -2 }, { type: "follow", base: "b2 map" }, { in: { type: "wipe", durationSec: 0.7, direction: "right", easing: "ease-out" }, out: null });
img("b2 branch", A.branch, "b2", 3.25, { x: 250, y: 1300, w: 440, h: 440, rot: 8 }, { type: "enter", te: 0.5, from: { scale: 0.2, rot: 40 }, drift: { dy: -12, rot: -3, scale: 0.03 } });
img("b2 dhow", A.dhow, "b2", 5.45, { x: 800, y: 1090, w: 300, h: 288, rot: 3 }, { type: "enter", te: 0.6, from: { dx: 600, rot: 10 }, drift: { dx: -30, rot: -2 } });
strip("b2 ETIYOPYA", "b2", 3.28, "ETİYOPYA", { size: 110, fg: COL.ink, bg: COL.cream, x: 540, y: 480, rot: -2.5 });
strip("b2 YEMEN", "b2", 5.38, "YEMEN", { size: 96, fg: COL.paper, bg: COL.red, x: 650, y: 612, rot: 3 });

// B3 Istanbul 1554
img("b3 sheet", A.sheet3, "b3", T.b3, { x: 540, y: 960, w: 1160, h: 2140, rot: 0 }, { type: "sheet" });
img("b3 skyline", A.skyline, "b3", 7.12, { x: 540, y: 1050, w: 1000, h: 566, rot: 1 }, { type: "enter", te: 0.55, from: { dy: 900, rot: 6 }, drift: { dy: -10, rot: -1, scale: 0.03 } });
const digits = [["1", COL.ink, COL.cream, "Playfair Display", 900, -7], ["5", COL.paper, COL.red, "Abril Fatface", 400, 5], ["5", COL.cream, COL.ink, "Archivo Black", 400, -3], ["4", COL.ink, COL.kraft, "Playfair Display", 900, 8]];
digits.forEach(([d, fg, bg, font, weight, rot], i) => strip(`b3 digit${i}`, "b3", 7.3 + i * 0.08, d, { size: 150, fg, bg, x: 330 + i * 140, y: 505, rot, font, weight, padX: 22 }));
strip("b3 ISTANBUL", "b3", 8.46, "İSTANBUL", { size: 100, fg: COL.ink, bg: COL.cream, x: 540, y: 668, rot: -2 });
img("b3 cezve", A.cezve, "b3", 9.62, { x: 800, y: 1236, w: 380, h: 322, rot: -4 }, { type: "enter", te: 0.5, from: { dx: 600, rot: 18 }, drift: { dx: -10, rot: 2 } });

// B4 Europe
img("b4 sheet", A.sheet4, "b4", T.b4, { x: 540, y: 960, w: 1160, h: 2140, rot: 0 }, { type: "sheet" });
img("b4 map", A.map4, "b4", 11.12, { x: 540, y: 1075, w: 940, h: 731, rot: 1.5 }, { type: "enter", te: 0.45, from: { scale: 0.75, rot: -10, dy: 150 }, drift: { rot: -0.5, scale: 0.03 } });
img("b4 route", A.route4, "b4", 11.45, { x: 540, y: 1075, w: 940, h: 731, rot: 1.5 }, { type: "follow", base: "b4 map" }, { in: { type: "wipe", durationSec: 0.7, direction: "left", easing: "ease-out" }, out: null });
strip("b4 AVRUPA", "b4", 11.45, "AVRUPA", { size: 120, fg: COL.paper, bg: COL.red, x: 540, y: 500, rot: -2.5 });

// B5 the world
img("b5 sheet", A.sheet5, "b5", T.b5, { x: 540, y: 960, w: 1160, h: 2140, rot: 0 }, { type: "sheet" });
img("b5 globe", A.globe5, "b5", 12.66, { x: 540, y: 1090, w: 620, h: 620, rot: 0 }, { type: "enter", te: 0.55, from: { scale: 0.5, rot: -30 }, drift: { rot: 10, scale: 0.04 } });
img("b5 ring", A.ring, "b5", 13.0, { x: 540, y: 1100, w: 1000, h: 520, rot: 0 }, { type: "enter", te: 0.3, ease: "linear", from: {}, drift: { rot: 2 } }, { in: { type: "wipe", durationSec: 0.6, direction: "right", easing: "ease-out" }, out: null });
[[175, 840, -14, 12.94], [905, 870, 12, 13.1], [880, 1360, 9, 13.26], [195, 1350, -10, 13.42]].forEach(([x, y, rot, t], i) =>
  img(`b5 togo${i}`, A.togo, "b5", t, { x, y, w: 150, h: 206, rot }, { type: "enter", te: 0.4, from: { scale: 0.2, rot: rot > 0 ? 30 : -30 }, drift: { dy: -15, rot: rot > 0 ? -4 : 4 } }));
img("b5 beans", A.beans, "b5", 12.7, { x: 540, y: 960, w: 1080, h: 1920, rot: 0 }, { type: "enter", te: 0.45, ease: "smooth", from: { scale: 1.08 }, drift: { dy: -24 } });
strip("b5 TUM DUNYA", "b5", 12.94, "TÜM DÜNYA", { size: 116, fg: COL.ink, bg: COL.cream, x: 540, y: 500, rot: 2 });

function clipOp(c) {
  const base = { name: c.name, startSec: +c.start.toFixed(3), durationSec: +(c.end - c.start).toFixed(3), trackId: "new" };
  if (c.kind === "image") return { type: "image", assetId: c.asset, fit: "fill", ...base, transform: { x: c.x, y: c.y, width: c.w, height: c.h, rotation: c.rot }, animations: c.anim || { in: null, out: null } };
  return { type: "text", text: c.text, ...base, transform: { x: c.x, y: c.y, rotation: c.rot },
    style: { fontFamily: c.font, fontWeight: c.weight, fontSize: c.size, color: c.fg, align: "center", lineHeight: 1.05, letterSpacing: 0.01, background: { color: c.bg, paddingX: c.padX, paddingY: 8, radius: 3 } },
    animations: { in: { type: "pop", durationSec: 0.32, easing: "overshoot" }, out: null },
    effects: [{ type: "drop-shadow", radius: 7, offsetX: 5, offsetY: 9, opacity: 0.45, color: "#120a05" }] };
}

if (process.argv[2] === "add") {
  const clips = V.map(clipOp);
  clips.push(
    { type: "text", name: "label VOX KOLAJ", text: "VOX KOLAJ", startSec: 0.2, durationSec: END - 0.2, trackId: "new", transform: { x: 540, y: 210 },
      style: { fontFamily: "Montserrat", fontWeight: 900, fontSize: 64, color: "#FFFFFF", align: "center", stroke: { color: "#000000", width: 8 }, shadow: { color: "rgba(0,0,0,0.75)", blur: 16, x: 0, y: 4 } }, animations: { in: { type: "fade", durationSec: 0.25 }, out: null } },
    { type: "text", name: "label stil", text: "stil önizlemesi", startSec: 0.2, durationSec: END - 0.2, trackId: "new", transform: { x: 540, y: 282 },
      style: { fontFamily: "Montserrat", fontWeight: 700, fontSize: 32, color: "#FFFFFF", align: "center", stroke: { color: "#000000", width: 5 }, shadow: { color: "rgba(0,0,0,0.8)", blur: 12, x: 0, y: 3 } }, animations: { in: { type: "fade", durationSec: 0.25 }, out: null } },
    { type: "audio", name: "VO", assetId: A.vo, startSec: VO_AT, durationSec: 13.64, role: "voice", volume: 1 },
    { type: "audio", name: "Music", assetId: A.music, startSec: 0, durationSec: END, role: "music", duck: true, duckDb: 7, volume: 0.72, fadeOutSec: 0.3 },
    ...[T.b2, T.b3, T.b4, T.b5].map((t, i) => ({ type: "audio", name: `sfx paper ${i + 2}`, assetId: A.paper, startSec: +(t - 0.04).toFixed(2), durationSec: 0.73, role: "sfx", volume: 0.42 })),
    { type: "audio", name: "sfx stamp 1554", assetId: A.stamp, startSec: 7.3, durationSec: 0.52, role: "sfx", volume: 0.5 },
  );
  const ops = [];
  for (let i = 0; i < clips.length; i += 50) ops.push({ op: "add_clips", clips: clips.slice(i, i + 50) });
  fs.writeFileSync("ops1.json", JSON.stringify(ops, null, 1), "utf8");
  console.log(JSON.stringify({ ok: true, clips: clips.length }));
}

// ---- keyframes ----
function enterTracks(c) {
  const d = +(c.end - c.start).toFixed(3), m = c.motion, te = m.te ?? 0.5, ease = m.ease || "overshoot";
  const f = m.from || {}, dr = m.drift || {};
  const tr = (base, from, drift) => [[0, base + (from || 0), ease], [te, base, "linear"], [d, base + (drift || 0), "linear"]];
  return { x: tr(c.x, f.dx, dr.dx), y: tr(c.y, f.dy, dr.dy), rotation: tr(c.rot, f.rot, dr.rot), scale: [[0, f.scale ?? 1, ease], [te, 1, "linear"], [d, 1 + (dr.scale || 0), "linear"]] };
}
function sheetTracks(c) {
  const d = +(c.end - c.start).toFixed(3);
  if (c.motion.first) return { scale: [[0, 1, "linear"], [d, 1.04, "linear"]], rotation: [[0, 0, "linear"], [d, -0.4, "linear"]] };
  return { y: [[0, 960 + 2160, "smooth"], [SLIDE, 960, "linear"], [d, 950, "linear"]], rotation: [[0, 6, "smooth"], [SLIDE, 0.4, "linear"], [d, -0.3, "linear"]], scale: [[0, 1, "linear"], [SLIDE, 1, "linear"], [d, 1.035, "linear"]] };
}
const at = (track, t) => { for (let i = 0; i < track.length - 1; i++) { const [t0, v0] = track[i], [t1, v1] = track[i + 1]; if (t >= t0 && t <= t1) return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0 || 1); } return track[track.length - 1][1]; };

if (process.argv[2] === "kf") {
  const show = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
  const ids = {};
  for (const tr of show.project.tracks) for (const cl of tr.clips) if (cl.name) ids[cl.name] = cl.id;
  const ops = [];
  const tracksOf = {};
  for (const c of V) {
    if (c.kind !== "image") continue;
    let tracks;
    if (c.motion.type === "sheet") tracks = sheetTracks(c);
    else if (c.motion.type === "enter") tracks = enterTracks(c);
    else if (c.motion.type === "follow") {
      const b = V.find((v) => v.name === c.motion.base), bt = tracksOf[b.name], off = c.start - b.start, d = +(c.end - c.start).toFixed(3);
      tracks = Object.fromEntries(Object.entries(bt).map(([p, tk]) => [p, [[0, +at(tk, off).toFixed(3), "linear"], [d, +at(tk, off + d).toFixed(3), "linear"]]]));
    }
    tracksOf[c.name] = tracks;
    if (!ids[c.name]) throw new Error("no id for " + c.name);
    for (const [prop, tk] of Object.entries(tracks)) ops.push({ op: "set_keyframes", id: ids[c.name], property: prop, keyframes: tk.map(([t, v, e]) => ({ timeSec: +t.toFixed(3), value: +(+v).toFixed(3), easing: e })) });
  }
  ops.push({ op: "add_captions", clipId: ids["VO"], style: { fontFamily: "Archivo", fontWeight: 800, fontSize: 52, color: COL.ink, activeColor: COL.paper, activeBackground: COL.red, textTransform: "none", animation: "highlight-box", maxWordsPerPage: 3, yPct: 0.752, background: { color: COL.cream, padding: 16, radius: 4 } } });
  fs.writeFileSync("ops2.json", JSON.stringify(ops, null, 1), "utf8");
  console.log(JSON.stringify({ ok: true, ops: ops.length }));
}
