// KAHVE.SYS — style preview, ASCII / CRT terminal (green P1 phosphor), 1080x1920.
// Engine adapted from lemo-opuscar styles/ascii-crt/demo (MIT, LemoLab). window.render(t) draws second t; window.EV exports foley cues.
import { W, H, initTerm, glyph, text, inverse, cursor, makeRamp, pick, ATLAS } from './term.js';
import { makeCRT } from './crt.js';

const out = document.getElementById('c');
const crt = makeCRT(out);
const scene = document.createElement('canvas'); scene.width = W; scene.height = H;
const g = scene.getContext('2d');
await initTerm();
const Q = new URLSearchParams(location.search);

// ---- template inputs (window.PACK_INPUTS via the pack bridge)
const P = (k, d) => (typeof window.packInput === 'function' ? window.packInput(k, d) : d);
// upper case by the episode's language: Turkish turns i into İ, English must not
const LOCALE = (typeof window.packInput === 'function' ? window.packInput('lang', 'tr') : 'tr') === 'en' ? 'en-US' : 'tr-TR';
const UP = (s) => String(s).trim().toLocaleUpperCase(LOCALE);
const IN = {
  alert: UP(P('alert', 'SİSTEM UYARISI')).slice(0, 15),
  gauge: UP(P('gauge', 'KAHVE SEVİYESİ')),
  critical: UP(P('critical', 'KRİTİK')),
  fillWord: UP(P('fillWord', 'KAHVE')).replace(/\s+/g, '') || 'KAHVE',
  diag: [P('diag1', 'KAFEİN: %2'), P('diag2', 'VERİMLİLİK: DÜŞÜYOR'), P('diag3', 'GÖZ KAPAKLARI: %70 KAPALI'), P('diag4', 'SABIR: BULUNAMADI')]
    .map((s) => { const [l, ...v] = UP(s).split(':'); return [l.trim().slice(0, 18), v.join(':').trim()]; }),
  after1: UP(P('after1', '%100')),
  after4: UP(P('after4', 'BULUNDU')),
  command: UP(P('command', 'OTOMATİK KAHVE SİPARİŞİ')).slice(0, 30),
  command2: UP(P('command2', 'BAŞLATILIYOR...')).slice(0, 28),
  network: UP(P('network', 'KAFE-NET')).slice(0, 12),
  confirm: UP(P('confirm', 'SİPARİŞ ONAYLANDI')).slice(0, 20),
  icon: String(P('icon', 'c[_]')).slice(0, 6),
  filling: UP(P('filling', 'DOLUYOR')),
  normal: UP(P('normal', 'NORMAL')),
};
// "LABEL ....... VALUE" with the value always at column 20, the way the log pane lines up.
const dots = (label, value) => `${label} ${'.'.repeat(Math.max(1, 18 - label.length))} ${value}`;
let VOW = [];
VOW = Array.isArray(window.PACK_INPUTS?.words) ? window.PACK_INPUTS.words : [];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpLog = (a, b, t) => Math.exp(lerp(Math.log(a), Math.log(b), t));
const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const hsh = (a, b = 0) => { let h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };
const TAU = .1;                                   // P1 afterglow
const decay = (t, tOff) => t < tOff ? 1 : Math.exp(-(t - tOff) / TAU);
const blink = (t, t0, period = .5) => { if (t < t0) return 0; const r = (t - t0) % period; return r < period / 2 ? 1 : decay(r, period / 2); };

// word timing from the voice (absolute film seconds); fallbacks = the take this film was cut to
const word = (re, i = 0, fb = [0, 0]) => { const m = VOW.filter(w => re.test(w.w)); return m[i] ? [m[i].start, m[i].end] : fb; };
const wIki = word(/^iki/i, 0, [4.31, 4.71]);
const wOto = word(/^Otomatik/i, 0, [7.75, 8.23]), wKah = word(/^kahve/i, 1, [8.29, 8.63]), wSip = word(/^sipari/i, 0, [8.67, 9.11]), wBas = word(/^ba.lat/i, 0, [9.17, 9.91]);
const wVer = word(/^Verim/i, 0, [5.75, 6.23]);

// ======================= Timeline =======================
const T = {
  relay: .08, on0: .16, on1: .72,
  alarm: .80, alarmOff: .97, alarmOn2: 1.07,
  sub0: 1.62, pull0: 2.2, pull1: 2.62,
  cupIn0: 2.48, cupIn1: 2.86,
  drain0: 2.92, drain1: wIki[0],
  diag0: 4.98, sabirHit: 7.12,
  cmd: wOto[0] - .14,
  net0: 10.38, net1: 11.16,
  ok: 11.3, fill1: 12.35,
  fin1: 12.6, fin2: 13.2, fin2b: 13.5, finPrompt: 13.95, cursorStop: 14.62,
  dur: 15.0,
};
const EV = [];
const ev = (t, type, o = {}) => EV.push({ t: +t.toFixed(4), type, ...o });

// ======================= Layout (1080x1920, text kept inside x 86–950) =======================
const LM = 86;
const HEAD = { ox: LM, oy: 372, cw: 30 };         // status header row
const SUB = { ox: LM, oy: 446, cw: 24 };          // sub line
const PANE = { oy: 1092, cw: 24, rows: 5 };       // log pane (diagnosis)
const STRIP_Y = 1356;                             // LOG strip (captions are laid in by the editor below it)
const CUP = { cols: 56, rows: 26, sx: 3, sy: 6 };
const BIG = { cw: 58, y: 742 };                   // opening alarm size

// ======================= 1. Power on, alarm, pull out =======================
ev(T.relay, 'relay'); ev(T.on0, 'degauss');
ev(T.alarm, 'beep', { f: 1250 }); ev(T.alarmOn2, 'beep', { f: 1250 });
const ALARM = IN.alert, SUBL = `${IN.gauge}: `, CRIT = IN.critical;
const SUB_DT = .028;
for (let k = 0; k < (SUBL + CRIT).length; k++) ev(T.sub0 + k * SUB_DT, 'tick');
function alarmA(t) { if (t < T.alarm) return 0; if (t < T.alarmOff) return 1; if (t < T.alarmOn2) return decay(t, T.alarmOff); return 1; }
function headerView(t) {
  const z = eio(seg(t, T.pull0, T.pull1));
  const cw = lerpLog(BIG.cw, HEAD.cw, z);
  return { ox: lerp((W - ALARM.length * BIG.cw) / 2, HEAD.ox, z), oy: lerp(BIG.y, HEAD.oy, z), cw };
}
function subView(t) {
  const z = eio(seg(t, T.pull0, T.pull1));
  const cw0 = 30, w0 = (SUBL + CRIT).length * cw0;
  return { ox: lerp((W - w0) / 2, SUB.ox, z), oy: lerp(BIG.y + BIG.cw * 2 + 44, SUB.oy, z), cw: lerpLog(cw0, SUB.cw, z) };
}
function sHeader(t) {
  if (t < T.ok) {
    const a = alarmA(t) * (t < T.ok ? 1 : decay(t, T.ok));
    if (a > 0) inverse(g, ' ' + ALARM + ' ', -1, 0, headerView(t), a);
    const wa = a * (t < T.pull0 ? 1 : decay(t, T.pull0));
    if (wa > .004) { const bw = 104; text(g, '/!\\', 0, 0, { ox: (W - 3 * bw) / 2, oy: BIG.y - bw * 2 - 60, cw: bw }, wa * 1.05); }
    // the sub line: typed, KRİTİK in inverse; it blinks while the level is critical
    const n = t < T.sub0 ? 0 : Math.min(SUBL.length + CRIT.length, Math.floor((t - T.sub0) / SUB_DT) + 1);
    const v = subView(t);
    text(g, SUBL.slice(0, n), 0, 0, v, .95);
    const nc = Math.max(0, n - SUBL.length);
    if (nc > 0) {
      const bl = t > T.drain1 && t < T.drain1 + 1.6 ? blink(t, T.drain1, .4) : 1;
      inverse(g, CRIT.slice(0, nc), SUBL.length, 0, v, .95 * Math.max(.18, bl));
    }
    if (n > 0 && n < SUBL.length + CRIT.length) cursor(g, n, 0, v, 1);
  }
  if (t >= T.ok - .02) {                         // hard redraw of the header on the confirmation downbeat
    const v = { ox: HEAD.ox, oy: HEAD.oy - 6, cw: 34 };
    const fl = 1 + .5 * Math.exp(-(t - T.ok) / .2);
    inverse(g, ` ${IN.confirm} `, -1, 0, v, Math.min(1, fl));
    text(g, IN.icon, IN.confirm.length + 2, 0, v, fl);
    const s = `${IN.gauge}: ${t < T.fill1 ? IN.filling : IN.normal}`;
    text(g, s, 0, 0, SUB, .95);
    if (t < T.fill1) cursor(g, s.length + 1, 0, SUB, blink(t, T.ok, .3) * .9);
  }
}
ev(T.ok, 'ok');

// ======================= 2. The cup: an ASCII gauge (glass mug, coffee made of the letters of KAHVE) =======================
const neg = document.createElement('canvas'); neg.width = CUP.cols * CUP.sx; neg.height = CUP.rows * CUP.sy;
const ng = neg.getContext('2d', { willReadFrequently: true });
const GEO = { cx: 74, top: 40, bot: 128, hw: 40 };
const RAMP_GLS = makeRamp('.:-=+*#%@');
const RAMP_COF = makeRamp(IN.fillWord);
function level(t) {
  if (t < T.drain0) return .38;
  if (t < T.drain1) return lerp(.38, .02, 1 - Math.pow(1 - seg(t, T.drain0, T.drain1), 2.4));
  if (t < T.ok) return .02;
  return lerp(.02, 1, eo(seg(t, T.ok + .05, T.fill1)));
}
function paintCup(L) {
  const { cx, top, bot, hw } = GEO;
  const R = (v, b = 0, gg = 0) => `rgb(${Math.round(clamp(v) * 255)},${gg},${b})`;
  ng.globalCompositeOperation = 'source-over'; ng.globalAlpha = 1;
  ng.fillStyle = '#000'; ng.fillRect(0, 0, neg.width, neg.height);
  // saucer (behind the cup)
  ng.fillStyle = R(.2); ng.beginPath(); ng.ellipse(cx + 2, bot + 3, 66, 10, 0, 0, Math.PI * 2); ng.fill();
  ng.fillStyle = R(.07); ng.beginPath(); ng.ellipse(cx + 8, bot + 1, 46, 6, 0, 0, Math.PI * 2); ng.fill();
  ng.lineWidth = 2.4; ng.strokeStyle = R(.9); ng.beginPath(); ng.ellipse(cx + 2, bot + 3, 66, 10, 0, .05, Math.PI - .05); ng.stroke();
  ng.lineWidth = 1.6; ng.strokeStyle = R(.42); ng.beginPath(); ng.ellipse(cx + 2, bot + 3, 66, 10, 0, Math.PI + .15, Math.PI * 2 - .15); ng.stroke();
  ng.fillStyle = R(.5); ng.beginPath(); ng.ellipse(cx + 2, bot + 12.5, 40, 2.2, 0, 0, Math.PI * 2); ng.fill();
  // handle
  ng.lineWidth = 8.5; ng.strokeStyle = R(.62); ng.beginPath(); ng.ellipse(cx + hw, (top + bot) / 2 - 4, 21, 25, 0, -Math.PI / 2 + .1, Math.PI / 2 - .1); ng.stroke();
  ng.lineWidth = 1.8; ng.strokeStyle = R(.95); ng.beginPath(); ng.ellipse(cx + hw + 1, (top + bot) / 2 - 4, 15, 19, 0, -Math.PI / 2 + .25, Math.PI / 2 - .25); ng.stroke();
  // coffee, clipped to the inside of the glass
  const iT = top + 6, iB = bot - 4, ys = iB - L * (iB - iT), rxS = hw - 3.5, ryS = 5.5;
  ng.save(); ng.beginPath(); ng.roundRect(cx - hw + 3, top, hw * 2 - 6, bot - top - 3, [0, 0, 13, 13]); ng.clip();
  if (L > .004) {
    const gr = ng.createLinearGradient(cx - hw, 0, cx + hw, 0);
    gr.addColorStop(0, R(.74, 255)); gr.addColorStop(.35, R(.62, 255)); gr.addColorStop(1, R(.44, 255));
    ng.fillStyle = gr; ng.fillRect(cx - hw, ys, hw * 2, bot - ys);
    ng.fillStyle = R(.86, 255); ng.beginPath(); ng.ellipse(cx, ys, rxS, ryS, 0, 0, Math.PI * 2); ng.fill();      // crema: the top face
    ng.lineWidth = 2; ng.strokeStyle = R(1, 255, 255); ng.beginPath(); ng.ellipse(cx, ys, rxS, ryS, 0, .12, Math.PI - .12); ng.stroke();  // front edge = the '~' line
  }
  ng.restore();
  // glass: walls, bottom, rim
  const wall = ng.createLinearGradient(cx - hw, 0, cx + hw, 0); wall.addColorStop(0, R(1)); wall.addColorStop(.5, R(.8)); wall.addColorStop(1, R(.66));
  ng.lineWidth = 4.6; ng.strokeStyle = wall;
  ng.beginPath(); ng.moveTo(cx - hw, top); ng.lineTo(cx - hw, bot - 14); ng.quadraticCurveTo(cx - hw, bot, cx - hw + 14, bot); ng.lineTo(cx + hw - 14, bot); ng.quadraticCurveTo(cx + hw, bot, cx + hw, bot - 14); ng.lineTo(cx + hw, top); ng.stroke();
  ng.lineWidth = 2.2; ng.strokeStyle = R(.55); ng.beginPath(); ng.ellipse(cx, top, hw, 7, 0, Math.PI + .02, Math.PI * 2 - .02); ng.stroke();
  ng.lineWidth = 3.8; ng.strokeStyle = R(1); ng.beginPath(); ng.ellipse(cx, top, hw, 7, 0, .02, Math.PI - .02); ng.stroke();
  ng.globalCompositeOperation = 'lighter';
  ng.fillStyle = R(.3); ng.fillRect(cx - hw + 7, top + 14, 3.2, bot - top - 34);                                   // glass reflection
  ng.globalCompositeOperation = 'source-over';
  const d = ng.getImageData(0, 0, neg.width, neg.height).data;
  const cells = [];
  const n = CUP.sx * CUP.sy * 255;
  for (let j = 0; j < CUP.rows; j++) for (let i = 0; i < CUP.cols; i++) {
    let r = 0, gg = 0, b = 0;
    for (let v = 0; v < CUP.sy; v++) { let o = ((j * CUP.sy + v) * neg.width + i * CUP.sx) * 4; for (let u = 0; u < CUP.sx; u++, o += 4) { r += d[o]; gg += d[o + 1]; b += d[o + 2]; } }
    r /= n; gg /= n; b /= n;
    if (r < .06) continue;
    if (gg > .16) { cells.push([i, j, '~', 1, 1]); continue; }
    if (b > .45) { const lv = pick(RAMP_COF, Math.pow(clamp(r * 1.05), 1.1), i, j, .55); if (lv.ch !== ' ') cells.push([i, j, lv.ch, lv.a, 1]); continue; }
    const lv = pick(RAMP_GLS, Math.pow(clamp(r * 1.1), 1.2), i, j, .45);
    if (lv.ch !== ' ') cells.push([i, j, lv.ch, lv.a, 0]);
  }
  return { cells, ys };
}
const cupCache = new Map();
function cupCells(L) { const k = Math.round(L * 400); if (!cupCache.has(k)) { if (cupCache.size > 300) cupCache.clear(); cupCache.set(k, paintCup(k / 400)); } return cupCache.get(k); }
function cupView(t) {
  const z = eio(seg(t, T.ok, T.ok + 1.1));
  const cw = lerp(13, 14.6, z), cx = lerp(566, 560, z), cy = lerp(796, 834, z);
  return { ox: cx - CUP.cols / 2 * cw, oy: cy - CUP.rows * cw, cw, cx, cy };
}
// print-in rows; level ticks; counter
for (let j = 0; j < CUP.rows; j++) ev(T.cupIn0 + j / CUP.rows * (T.cupIn1 - T.cupIn0), 'print');
{ let last = 38; for (let t = T.drain0; t <= T.drain1 + .001; t += 1 / 120) { const v = Math.round(level(t) * 100); if (v !== last) { ev(t, 'ratchet'); last = v; } } }
ev(T.drain1 + .02, 'err'); ev(T.drain1 + .42, 'err');
function sCup(t) {
  if (t < T.cupIn0) return;
  const L = level(t), { cells } = cupCells(L), v = cupView(t);
  const rowsShown = t < T.cupIn1 ? Math.floor(seg(t, T.cupIn0, T.cupIn1) * (CUP.rows + 1)) : CUP.rows;
  const warm = t >= T.ok;
  const fl = warm ? 1 + .7 * Math.exp(-(t - T.ok) / .28) : 1;
  for (const [i, j, ch, a, cof] of cells) {
    if (j >= rowsShown) continue;
    const chan = cof && warm ? 1 : 0;
    glyph(g, ch, v.ox + i * v.cw, v.oy + j * v.cw * 2, v.cw, a * (cof && warm ? fl * 1.05 : 1), chan);
  }
  // measuring ticks inside the glass, left (25/50/75/100 %)
  if (rowsShown >= CUP.rows) {
    const { top, bot, hw, cx } = GEO, iT = top + 6, iB = bot - 4;
    for (const p of [.25, .5, .75, 1]) {
      const y = iB - p * (iB - iT), j = Math.floor(y / CUP.sy), i = Math.floor((cx - hw + 5) / CUP.sx) + 1;
      glyph(g, '-', v.ox + i * v.cw, v.oy + j * v.cw * 2, v.cw, .55);
      glyph(g, '-', v.ox + (i + 1) * v.cw, v.oy + j * v.cw * 2, v.cw, .55);
    }
  }
  // steam: three wisps that rise cell by cell once the cup is full
  if (t > T.fill1 - .25) {
    const amp = ss(seg(t, T.fill1 - .25, T.fill1 + .6));
    const rim = Math.floor(GEO.top / CUP.sy) - 1;
    [[-6, 0], [0, 1.9], [6, 3.7]].forEach(([dx, ph], w) => {
      for (let r = 0; r < 4; r++) {
        const row = rim - 1 - r;
        const rise = (t * 2.2 + ph) % 4.5;                      // a puff climbing the column
        const near = Math.max(0, 1 - Math.abs(r - rise) / 1.6) + Math.max(0, 1 - Math.abs(r - rise + 4.5) / 1.6);
        const xo = Math.round(1.6 * Math.sin(r * .95 - t * 3.1 + ph * 2));
        const xo2 = Math.round(1.6 * Math.sin((r + 1) * .95 - t * 3.1 + ph * 2));
        const ch = xo2 > xo ? '(' : xo2 < xo ? ')' : (r % 2 ? '~' : '\'');
        const a = amp * (.25 + .75 * near) * (1 - r / 5) * .9;
        const col = Math.floor(GEO.cx / CUP.sx) + dx + xo;
        glyph(g, ch, v.ox + col * v.cw, v.oy + row * v.cw * 2, v.cw, a, 1);
      }
    });
  }
}
// level readout, left of the cup
function sReadout(t) {
  if (t < T.cupIn1 - .1) return;
  const L = level(t), val = Math.round(L * 100), v = cupView(t);
  const lab = { ox: LM, oy: v.cy - 108, cw: 18 }, big = { ox: LM, oy: v.cy - 64, cw: 40 };
  text(g, 'SEVİYE', 0, 0, lab, .55);
  const s = '%' + val;
  if (t > T.drain1 && t < T.ok) {
    const bl = blink(t, T.drain1, .4);
    if (t < T.drain1 + 1.6 && bl > .5) inverse(g, s, 0, 0, big, 1); else text(g, s, 0, 0, big, Math.max(.35, bl));
  } else text(g, s, 0, 0, big, t >= T.ok ? 1 + .5 * Math.exp(-(t - T.ok) / .3) : 1);
}

// ======================= 3. Log pane: diagnosis, the order, the modem =======================
const LOG = [];
function mline(t0, s, dt = .014, extra = {}) { const L = { t0, s, times: [...s].map((_, k) => t0 + k * dt), ...extra }; LOG.push(L); return L; }
function syncWord(times, w, t0, t1) { for (let k = 0; k < w.length; k++) times.push(t0 + (k / w.length) * (t1 - t0)); }
mline(T.diag0, '> TANI ÇALIŞTIRILIYOR...', .026);
mline(5.58, dots(...IN.diag[0]));
mline(wVer[0] + .02, dots(...IN.diag[1]));
mline(6.34, dots(...IN.diag[2]));
{ const L = mline(6.82, dots(...IN.diag[3])); for (let k = 20; k < L.s.length; k++) L.times[k] = T.sabirHit; L.inv = [20, L.s.length]; }
{ // the order: typed in sync with the voice
  const times = [T.cmd, T.cmd + .06];
  if (IN.command === 'OTOMATİK KAHVE SİPARİŞİ') {   // typed word by word with the original take
    syncWord(times, 'OTOMATİK', wOto[0], wOto[1]); times.push(wOto[1] + .02);
    syncWord(times, 'KAHVE', wKah[0], wKah[1]); times.push(wKah[1] + .02);
    syncWord(times, 'SİPARİŞİ', wSip[0], wSip[1]);
  } else syncWord(times, IN.command, wOto[0], wSip[1]);
  LOG.push({ t0: T.cmd, s: `> ${IN.command}`, times, human: 1 });
  const t2 = [wBas[0] - .03, wBas[0] - .02]; syncWord(t2, IN.command2, wBas[0], wBas[1] + .12);
  LOG.push({ t0: wBas[0] - .03, s: `  ${IN.command2}`, times: t2, human: 1, cursorTo: T.net0 });
}
LOG.push({ t0: T.net0, s: IN.network, times: [...IN.network].map(() => T.net0), net: 1 });
const FIN = [];
{ const s = dots(IN.diag[0][0], IN.after1); FIN.push({ row0: 2, t0: T.fin1, s, times: [...s].map((_, k) => T.fin1 + k * .014) }); }
{ const s = dots(IN.diag[3][0], IN.after4); FIN.push({ row0: 2, t0: T.fin2, s, times: [...s].map((_, k) => k < 20 ? T.fin2 + k * .014 : T.fin2b) }); }
for (const L of [...LOG, ...FIN]) L.times.forEach((x, k) => { if (L.s[k] !== ' ' && !L.net) ev(x, L.human ? 'key' : 'tick'); });
ev(T.sabirHit, 'err2'); ev(T.fin2b, 'beep', { f: 880, soft: 1 });
ev(wBas[1] + .2, 'enter'); ev(T.net0, 'modem', { d: T.net1 - T.net0 + .06 });
function netText(t) {
  const p = t < T.net1 ? 1 - Math.pow(1 - seg(t, T.net0 + .05, T.net1), 1.7) : 1, k = Math.floor(p * 10 + 1e-6);
  return IN.network + ' [' + '#'.repeat(k) + '.'.repeat(10 - k) + '] ' + (t >= T.net1 ? 'TAMAM' : '%' + Math.floor(p * 100));
}
function drawLines(t, lines, amp) {
  const shown = lines.filter(L => t >= L.t0);
  const first = Math.max(0, shown.length - PANE.rows);
  shown.slice(first).forEach((L, r0) => { const r = r0 + (L.row0 || 0);
    const view = { ox: LM, oy: PANE.oy, cw: PANE.cw };
    if (L.net) { text(g, netText(t), 0, r, view, amp); return; }
    const n = L.times.filter(x => t >= x).length, s = L.s.slice(0, n);
    if (L.inv && n > L.inv[0]) { text(g, s.slice(0, L.inv[0]), 0, r, view, .95 * amp); inverse(g, s.slice(L.inv[0]), L.inv[0], r, view, amp * (1 + .6 * Math.exp(-(t - T.sabirHit) / .2))); }
    else text(g, s, 0, r, view, (L.s.startsWith('>') || L.human ? 1 : .88) * amp);
    const typing = n < L.s.length && n > 0;
    if (typing && (L.human || L.s.startsWith('>'))) cursor(g, n, r, view, amp);
    if (L.cursorTo && n === L.s.length && t < L.cursorTo) cursor(g, n, r, view, blink(t, L.times[L.times.length - 1] + .05, .42) * amp);
  });
}
function sLog(t) {
  if (t < T.ok + .6) drawLines(t, LOG, t < T.ok ? 1 : decay(t, T.ok));
  if (t >= T.fin1) drawLines(t, FIN, 1);
  if (t >= T.finPrompt) {
    const view = { ox: LM, oy: PANE.oy, cw: PANE.cw };
    text(g, '>', 0, 4, view, .95);
    cursor(g, 2, 4, view, t < T.cursorStop ? blink(t, T.finPrompt, .5) : 1);
  }
}

// ======================= 4. Fixed chrome: LOG strip, function keys =======================
function sChrome(t) {
  if (t < T.on1) return;
  const a = ss(seg(t, T.on1, T.on1 + .3));
  const v = { ox: LM, oy: STRIP_Y, cw: 18 };
  inverse(g, ' LOG ', 0, 0, v, .7 * a);
  text(g, '-'.repeat(42), 6, 0, v, .26 * a);
  text(g, `F1 YARDIM   F2 ${IN.fillWord}   F10 PANİK`, 0, 0, { ox: LM, oy: 1548, cw: 18 }, .3 * a);
}

// ======================= Main =======================
function film(t) {
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  sChrome(t);
  sHeader(t);
  sCup(t);
  sReadout(t);
  sLog(t);
  const P = { power: seg(t, T.on0, T.on1) };
  if (t < T.on0) P.expo = 0;
  P.jolt = (t > T.alarm && t < T.alarm + .07 ? .004 : 0) + (t > T.ok && t < T.ok + .07 ? -.003 : 0);
  return P;
}
EV.sort((a, b) => a.t - b.t);
window.DUR = T.dur; window.EV = EV; window.T = T;
if (Q.has('sheet')) {                            // review aid: ?sheet=t1,t2,... tiles up to 16 frames 4x4 over the page
  const sc = document.createElement('canvas'); sc.width = W; sc.height = H; sc.style.cssText = 'position:absolute;left:0;top:0';
  document.body.appendChild(sc); const sg = sc.getContext('2d');
  window.render = () => {
    sg.fillStyle = '#222'; sg.fillRect(0, 0, W, H); sg.font = '22px sans-serif';
    Q.get('sheet').split(',').map(Number).slice(0, 16).forEach((t, k) => {
      crt.render(scene, Math.round(t * 30), film(t));
      const x = (k % 4) * W / 4, y = Math.floor(k / 4) * H / 4;
      sg.drawImage(out, x + 2, y + 2, W / 4 - 4, H / 4 - 4);
      sg.fillStyle = '#ff0'; sg.fillText(t.toFixed(2), x + 10, y + 28);
    });
  };
} else window.render = t => {
  let P = {};
  if (Q.get('frame') === 'glyphs') {
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
    text(g, 'ŞİĞÜÖÇ şığüöç', 0, 0, { ox: 80, oy: 300, cw: 60 }, 1);
    text(g, 'KAHVE SEVİYESİ: KRİTİK', 0, 0, { ox: 80, oy: 500, cw: 40 }, 1);
    inverse(g, ' SİPARİŞ ONAYLANDI ', 0, 0, { ox: 80, oy: 650, cw: 40 }, 1);
    text(g, 'c[_] %2 ... ~ ( ) #', 0, 0, { ox: 80, oy: 800, cw: 40 }, 1);
  } else P = film(t);
  crt.render(scene, Math.round(t * 30), P);
};
window.READY = true;
