// Template inputs: window.PACK_INPUTS (set by ../../_core/bridge.js), with the preview's words as defaults.
const P = (k, d) => (typeof window.packInput === 'function' ? window.packInput(k, d) : d);
// upper case by the episode's language: Turkish turns i into İ, English must not
const LOCALE = (typeof window.packInput === 'function' ? window.packInput('lang', 'tr') : 'tr') === 'en' ? 'en-US' : 'tr-TR';
const UP = (s) => String(s).trim().toLocaleUpperCase(LOCALE);
export const IN = {
  locale: LOCALE,
  title1: String(P('title1', 'Pazartesi')).trim().slice(0, 12),
  title2: String(P('title2', 'Sabahı')).trim().slice(0, 12),
  tagline: UP(P('tagline', 'SESLİ  ·  SÖZLÜ  ·  ŞARKILI')).slice(0, 34),
  end: String(P('end', 'Son')).trim().slice(0, 8),
  calendar: UP(P('calendar', 'PAZARTESİ')).slice(0, 10),
};
