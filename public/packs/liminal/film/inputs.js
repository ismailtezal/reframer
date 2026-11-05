// Template inputs: window.PACK_INPUTS (set by ../../_core/bridge.js), with the preview's words as defaults.
const P = (k, d) => (typeof window.packInput === 'function' ? window.packInput(k, d) : d);
// upper case by the episode's language: Turkish turns i into İ, English must not
const LOCALE = (typeof window.packInput === 'function' ? window.packInput('lang', 'tr') : 'tr') === 'en' ? 'en-US' : 'tr-TR';
const UP = (s) => String(s).trim().toLocaleUpperCase(LOCALE);
export const IN = {
  title: UP(P('title', 'OFİS · 03:14')).slice(0, 16),
  clock: String(P('clock', '03:14')).replace(/[^0-9:]/g, '').slice(0, 5) || '03:14',
  date: UP(P('date', '5 KAS 1996')).slice(0, 14),
  note1: String(P('note1', 'Toplantı')).slice(0, 14),
  note2: String(P('note2', 'yarın 09:00')).slice(0, 20),
};
