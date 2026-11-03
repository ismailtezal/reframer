import type { Project } from "./schema";

/**
 * The language a project's words are in. The composition marks its root with it, so the browser
 * applies the language's own rules: Turkish uppercase turns "i" into "İ" (not "I"), fonts use their
 * localized letterforms (no "fi" ligature that swallows the dot of the i).
 */

/** Every word a viewer reads in the project: text clips, captions and the text props of components. */
export const projectText = (project: Project): string[] => {
  const out: string[] = [];
  const strings = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(strings);
    else if (v && typeof v === "object") Object.values(v).forEach(strings);
  };
  for (const c of Object.values(project.clips)) {
    if (c.type === "text") out.push(c.text);
    else if (c.type === "captions") out.push(c.words.map((w) => w.text).join(""));
    else if (c.type === "component") strings(c.props);
  }
  return out;
};

const NAMES: Record<string, string> = {
  turkish: "tr",
  tur: "tr",
  english: "en",
  eng: "en",
  german: "de",
  deu: "de",
  ger: "de",
  french: "fr",
  fra: "fr",
  fre: "fr",
  spanish: "es",
  spa: "es",
  azerbaijani: "az",
  aze: "az",
  italian: "it",
  ita: "it",
  portuguese: "pt",
  por: "pt",
  dutch: "nl",
  nld: "nl",
  russian: "ru",
  rus: "ru",
  arabic: "ar",
  ara: "ar",
};

/** A BCP 47 tag from what transcription services report ("tr", "tur", "turkish", "en-US"). */
export const normalizeLanguage = (raw: string | undefined): string | undefined => {
  const v = raw?.trim().toLowerCase();
  if (!v) return undefined;
  if (NAMES[v]) return NAMES[v];
  return /^[a-z]{2}(-[a-z0-9]+)*$/.test(v) ? v : undefined;
};

// Letters only Turkish (and Azerbaijani) use among Latin scripts.
const TURKISH = /[ğĞşŞıİ]/;

export const projectLanguage = (project: Project): string | undefined => {
  // What was said, by the amount of speech.
  const spoken = new Map<string, number>();
  for (const a of Object.values(project.assets)) {
    const lang = normalizeLanguage(a.transcript?.language);
    if (lang) spoken.set(lang, (spoken.get(lang) ?? 0) + Math.max(1, a.transcript?.words.length ?? 0));
  }
  const said = [...spoken.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (said) return said;
  // Otherwise the letters on screen.
  return projectText(project).some((t) => TURKISH.test(t)) ? "tr" : undefined;
};
