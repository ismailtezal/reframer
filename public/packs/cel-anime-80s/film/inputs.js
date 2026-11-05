// Template inputs: window.PACK_INPUTS (set by ../../_core/bridge.js), with the preview's words as defaults.
const P = (k, d) => (typeof window.packInput === 'function' ? window.packInput(k, d) : d);
// upper case by the episode's language: Turkish turns i into İ, English must not
const LOCALE = (typeof window.packInput === 'function' ? window.packInput('lang', 'tr') : 'tr') === 'en' ? 'en-US' : 'tr-TR';
const UP = (s) => String(s).trim().toLocaleUpperCase(LOCALE);
const deadline = /^(\d{1,2}):(\d{2})$/.exec(String(P('deadline', '23:59')).trim()) ?? [null, '23', '59'];
const DEAD = Number(deadline[1]) * 60 + Number(deadline[2]);
export const IN = {
  title1: UP(P('title1', 'SON')).slice(0, 8),
  title2: UP(P('title2', 'TESLİM')).slice(0, 10),
  kicker: String(P('kicker', 'デッドライン')).slice(0, 10),
  tagline: UP(P('tagline', 'BİR GECE YARISI DESTANI')).slice(0, 26),
  key: UP(P('key', 'GÖNDER')).slice(0, 8),
  /** The clock `minutes` before (negative) or at (0) the deadline, as HH:MM. */
  clock: (minutes = 0) => {
    const m = (((DEAD + minutes) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  },
};
