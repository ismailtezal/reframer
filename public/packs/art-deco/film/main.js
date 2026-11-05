// HypeStudio Gala Gecesi · 1930 — Art Deco style preview (9:16). Engine: lemo-opuscar art-deco (MIT, LemoLab).
const cv = document.getElementById('c'), g = cv.getContext('2d');
// Load every face WITH Turkish sample text: without it only the latin subset loads and Ş İ Ğ ş ğ fall back to a system serif.
const TR = 'AaZz09 ŞİĞÜÖÇ şığüöç ·';
await Promise.all(['80px Limelight', '80px Poiret', '600 40px Josefin', '400 40px Josefin', '700 40px Josefin', '80px Italiana']
  .map(f => document.fonts.load(f, TR)));
await window.packFonts?.();
const film = await import('./film.js');
window.DUR = film.DUR;
window.render = t => {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.shadowBlur = 0;
  film.renderFilm(g, t);
};
window.READY = true;
