// Camcorder OSD (recorded into the tape: drawn on a canvas the VHS pass mixes into the signal) and the VCR's own
// playback OSD (clean, drawn after the tape). Font: VT323 (OFL) under the alias "VCR", with Turkish letters.
const SH = [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
export function outlined(x, str, px, py, size, { col = '#f4f4ee', align = 'left', o = null, shadow = 'rgba(0,0,0,.88)' } = {}) {
  x.font = `${size}px VCR`; x.textAlign = align; x.textBaseline = 'alphabetic';
  const k = o ?? Math.max(2, Math.round(size / 24));
  x.fillStyle = shadow; for (const [dx, dy] of SH) x.fillText(str, px + dx * k, py + dy * k);
  x.fillStyle = col; x.fillText(str, px, py);
  return x.measureText(str).width;
}
// o = {hide, t, rec, clock, date, title, titleN}
export function drawOSD(cv, o) {
  const x = cv.getContext('2d'), W = cv.width;
  x.clearRect(0, 0, cv.width, cv.height);
  if (o.hide) return;
  if (o.rec) {
    if ((o.t % 1) < .62) { x.fillStyle = 'rgba(0,0,0,.85)'; x.beginPath(); x.arc(100, 417, 19, 0, 7); x.fill(); x.fillStyle = '#e8261c'; x.beginPath(); x.arc(100, 417, 15.5, 0, 7); x.fill(); }
    outlined(x, 'REC', 130, 444, 84);
  }
  if (o.clock) {
    outlined(x, o.clock, W - 78, 1530, 96, { align: 'right' });
    outlined(x, o.date, W - 80, 1594, 64, { align: 'right' });
  }
  if (o.title) {
    const vis = o.title.slice(0, Math.max(0, Math.min(o.title.length, o.titleN)));
    // typed left to right from a fixed start, like a title generator
    x.font = '150px VCR'; const full = x.measureText(o.title).width;
    outlined(x, vis, (W - full) / 2, 905, 150, { col: '#fbfbf2', o: 5 });
  }
}
// VCR playback OSD: blue screen before the picture, then "PLAY ▶" (drawn shapes, no font dependency for the arrow)
export function drawVCR(x, o) {
  const W = x.canvas.width, Hh = x.canvas.height;
  x.clearRect(0, 0, W, Hh);
  if (o.blue) { x.fillStyle = '#1d3cc4'; x.fillRect(0, 0, W, Hh); }
  if (o.play) {
    const tw = (() => { x.font = '88px VCR'; return x.measureText('PLAY').width; })();
    const ax = W - 84 - 46, px = ax - 22 - tw;
    outlined(x, 'PLAY', px, 446, 88, { col: '#ffffff', o: 4 });
    const tri = (dx, dy, c) => { x.fillStyle = c; x.beginPath(); x.moveTo(ax + dx, 384 + dy); x.lineTo(ax + 46 + dx, 414 + dy); x.lineTo(ax + dx, 444 + dy); x.closePath(); x.fill(); };
    for (const [dx, dy] of SH) tri(dx * 4, dy * 4, 'rgba(0,0,0,.88)');
    tri(0, 0, '#ffffff');
  }
}
