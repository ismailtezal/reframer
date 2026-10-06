import type { CaptionWord } from "./schema";

export type CaptionPage = {
  startMs: number;
  /** When the page stops showing (next page start, or last word end + hold) */
  endMs: number;
  words: CaptionWord[];
};

const SENTENCE_END = /[.!?…]["')\]]?$/;

/**
 * Groups words into pages ("1-3 words on screen"). A new page starts when the
 * gap since the page start exceeds `combineMs`, the page is full, or the
 * previous word ended a sentence.
 */
export const paginateCaptions = (
  words: readonly CaptionWord[],
  opts: { combineMs: number; maxWordsPerPage: number; holdMs?: number },
): CaptionPage[] => {
  const hold = opts.holdMs ?? 600;
  const pages: CaptionPage[] = [];
  let current: CaptionWord[] = [];
  const flush = () => {
    if (current.length === 0) return;
    pages.push({
      startMs: current[0].startMs,
      endMs: current[current.length - 1].endMs,
      words: current,
    });
    current = [];
  };
  for (const word of words) {
    if (word.text.trim() === "") continue;
    const first = current[0];
    const prev = current[current.length - 1];
    if (
      first &&
      (word.startMs - first.startMs > opts.combineMs ||
        current.length >= opts.maxWordsPerPage ||
        (prev && SENTENCE_END.test(prev.text.trim())))
    ) {
      flush();
    }
    current.push(word);
  }
  flush();
  // Each page lasts until the next one starts (capped by a short hold).
  for (let i = 0; i < pages.length; i++) {
    const next = pages[i + 1];
    const naturalEnd = pages[i].endMs + hold;
    pages[i].endMs = next ? Math.min(next.startMs, naturalEnd) : naturalEnd;
  }
  return pages;
};

export const findPageAt = (pages: readonly CaptionPage[], timeMs: number): CaptionPage | null => {
  let lo = 0;
  let hi = pages.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const page = pages[mid];
    if (timeMs < page.startMs) hi = mid - 1;
    else if (timeMs >= page.endMs) lo = mid + 1;
    else return page;
  }
  return null;
};

const FILLERS = new Set(["um", "uh", "erm", "er", "ah", "uhm", "hmm", "mm", "like", "basically", "literally", "actually", "so", "right"]);
const STRONG_FILLERS = new Set(["um", "uh", "erm", "er", "ah", "uhm", "hmm", "mm"]);
const FILLER_PHRASES = [
  ["you", "know"],
  ["i", "mean"],
  ["kind", "of"],
  ["sort", "of"],
];

const normalize = (t: string) => t.toLowerCase().replace(/[^a-z']/g, "");

/**
 * Returns word ranges that are filler. `aggressive` also flags soft fillers
 * ("like", "basically", "you know") — only use it after confirming with the user.
 */
export const findFillerWords = (words: readonly CaptionWord[], aggressive = false): { startMs: number; endMs: number; text: string }[] => {
  const out: { startMs: number; endMs: number; text: string }[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = normalize(words[i].text);
    if (STRONG_FILLERS.has(w) || (aggressive && FILLERS.has(w))) {
      out.push({ startMs: words[i].startMs, endMs: words[i].endMs, text: words[i].text.trim() });
      continue;
    }
    if (aggressive) {
      for (const phrase of FILLER_PHRASES) {
        const match = phrase.every((p, j) => normalize(words[i + j]?.text ?? "") === p);
        if (match) {
          out.push({
            startMs: words[i].startMs,
            endMs: words[i + phrase.length - 1].endMs,
            text: phrase.join(" "),
          });
          i += phrase.length - 1;
          break;
        }
      }
    }
  }
  return out;
};

/** Gaps between words longer than `minGapMs`, padded so speech isn't clipped. */
export const findSpeechGaps = (words: readonly CaptionWord[], minGapMs: number, paddingMs = 120): { startMs: number; endMs: number }[] => {
  const gaps: { startMs: number; endMs: number }[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const gapStart = words[i].endMs + paddingMs;
    const gapEnd = words[i + 1].startMs - paddingMs;
    if (gapEnd - gapStart >= minGapMs) gaps.push({ startMs: gapStart, endMs: gapEnd });
  }
  return gaps;
};

export const transcriptText = (words: readonly CaptionWord[]): string =>
  words
    .map((w) => w.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
