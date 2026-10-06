import { describe, expect, it } from "vitest";
import { findFillerWords, findSpeechGaps, paginateCaptions } from "./captions";
import { resolveEasing } from "./easing";
import { evaluateKeyframes } from "./keyframes";
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
