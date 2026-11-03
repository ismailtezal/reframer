import { describe, expect, it } from "vitest";
import { findFillerWords, findSpeechGaps, paginateCaptions } from "./captions";
import { resolveEasing } from "./easing";
import { evaluateKeyframes } from "./keyframes";
import { getLutCube, LUT_IDS } from "./luts";
import type { CaptionWord } from "./schema";
import { formatSMPTE, formatTimecode, parseTimecode } from "./time";

const word = (text: string, startMs: number, endMs: number): CaptionWord => ({
  text,
  startMs,
  endMs,
  timestampMs: Math.round((startMs + endMs) / 2),
  confidence: null,
});

describe("time", () => {
  it("formats broadcast timecode", () => {
    expect(formatSMPTE(0, 30)).toBe("00:00:00:00");
    expect(formatSMPTE(30 * 75 + 12, 30)).toBe("00:01:15:12");
    expect(formatSMPTE(30 * 3600, 30)).toBe("01:00:00:00");
  });

  it("parses what it formats", () => {
    for (const frame of [0, 1, 29, 30, 451, 30 * 125 + 7]) {
      expect(parseTimecode(formatSMPTE(frame, 30), 30)).toBe(frame);
      expect(parseTimecode(formatTimecode(frame, 30), 30)).toBe(frame);
    }
    expect(parseTimecode("1.5", 30)).toBe(45);
    expect(parseTimecode("1:02", 30)).toBe(62 * 30);
    expect(parseTimecode("abc", 30)).toBeNull();
  });
});

describe("easing", () => {
  it("every preset starts at 0 and lands on 1", () => {
    for (const preset of ["linear", "ease", "ease-out", "smooth", "snappy", "apple", "overshoot", "bouncy"] as const) {
      const fn = resolveEasing(preset);
      expect(fn(0)).toBeCloseTo(0, 3);
      expect(fn(1)).toBeCloseTo(1, 2);
    }
  });
});

describe("keyframes", () => {
  const track = [
    { frame: 0, value: 0, easing: "linear" as const },
    { frame: 10, value: 100 },
  ];
  it("interpolates between keys and holds outside them", () => {
    expect(evaluateKeyframes(track, -5)).toBe(0);
    expect(evaluateKeyframes(track, 5)).toBeCloseTo(50);
    expect(evaluateKeyframes(track, 20)).toBe(100);
  });
});

describe("captions", () => {
  const words = [word("So", 0, 200), word(" um", 250, 400), word(" this", 900, 1100), word(" is", 1100, 1200), word(" it", 1200, 1400)];

  it("finds filler words and silences", () => {
    expect(findFillerWords(words).map((f) => f.text.trim())).toContain("um");
    const gaps = findSpeechGaps(words, 400, 50);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].startMs).toBeGreaterThanOrEqual(400);
    expect(gaps[0].endMs).toBeLessThanOrEqual(900);
  });

  it("pages never exceed the word limit", () => {
    const pages = paginateCaptions(words, { maxWordsPerPage: 2, combineMs: 2000 });
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) expect(page.words.length).toBeLessThanOrEqual(2);
  });
});

describe("luts", () => {
  it("every built-in look is a valid cube at any strength", () => {
    for (const id of LUT_IDS) {
      for (const intensity of [0.3, 1]) {
        const cube = getLutCube(id, intensity) ?? "";
        expect(
          cube.split("\n").filter((l) => /NaN|Infinity/.test(l)),
          `${id} at ${intensity}`,
        ).toEqual([]);
      }
    }
  });
});

describe("caption pages", () => {
  it("keeps a short last word of a sentence with the words before it", () => {
    const words = [word("Is", 0, 200), word(" it", 220, 400), word(" really", 420, 700), word(" fair?", 720, 900)];
    const pages = paginateCaptions(words, { combineMs: 1200, maxWordsPerPage: 3 });
    expect(pages.map((p) => p.words.map((w) => w.text).join(""))).toEqual(["Is it really fair?"]);
  });

  it("breaks a full page where the phrase breaks, not before a dangling short word", () => {
    const words = [
      word("Your", 0, 200),
      word(" body", 220, 400),
      word(" runs", 420, 600),
      word(" a", 620, 680),
      word(" clock,", 700, 1000),
      word(" so", 1050, 1150),
      word(" morning", 1170, 1500),
      word(" light", 1520, 1800),
      word(" matters.", 1820, 2200),
    ];
    const text = (max: number) =>
      paginateCaptions(words, { combineMs: 5000, maxWordsPerPage: max }).map((p) =>
        p.words
          .map((w) => w.text)
          .join("")
          .trim(),
      );
    expect(text(2)).toEqual(["Your body", "runs", "a clock,", "so morning", "light matters."]);
    expect(text(3)).toEqual(["Your body runs", "a clock,", "so morning light", "matters."]);
  });

  it("never ends a page on a word that leads into the next one", () => {
    const words = [
      word("A", 0, 100),
      word(" black", 120, 300),
      word(" hole", 320, 500),
      word(" begins", 520, 800),
      word(" with", 820, 950),
      word(" a", 970, 1000),
      word(" dying", 1020, 1300),
      word(" star.", 1320, 1700),
    ];
    const pages = paginateCaptions(words, { combineMs: 5000, maxWordsPerPage: 5 });
    expect(
      pages.map((p) =>
        p.words
          .map((w) => w.text)
          .join("")
          .trim(),
      ),
    ).toEqual(["A black hole begins", "with a dying star."]);
  });
});
