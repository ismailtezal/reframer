// Template inputs: window.PACK_INPUTS (set by ../../_core/bridge.js), with the preview's words as defaults.
const P = (k, d) => (typeof window.packInput === 'function' ? window.packInput(k, d) : d);
// upper case by the episode's language: Turkish turns i into İ, English must not
const LOCALE = (typeof window.packInput === 'function' ? window.packInput('lang', 'tr') : 'tr') === 'en' ? 'en-US' : 'tr-TR';
const UP = (s) => String(s).trim().toLocaleUpperCase(LOCALE);
export const IN = {
  title: UP(P('title', 'ROBOT')).slice(0, 10),
  subtitle: UP(P('subtitle', 'EV ARKADAŞI')).slice(0, 16),
  dial: [P('dial1', 'AZ'), P('dial2', 'ORTA'), P('dial3', 'ÇITIR'), P('dial4', 'YÖRÜNGE')].map((s) => UP(s).slice(0, 9)),
};
