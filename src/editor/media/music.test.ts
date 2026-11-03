import { describe, expect, it } from "vitest";
import { analyzeMusic } from "./beats";
import { mapAnalysis, planFit } from "./fit-music";

const RATE = 22_050;

/**
 * A synthetic band: kick on beats 1 and 3, snare on 2 and 4, hi-hats on the off-beats, at a tempo that
 * isn't a whole number of analysis hops, over a two-chord pad that changes every bar.
 */
const track = (bpm: number, seconds: number) => {
  const x = new Float32Array(Math.round(seconds * RATE));
  const beat = 60 / bpm;
  const clicks: number[] = [];
  let seed = 1;
  const noise = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647) * 2 - 1;
  };
  for (let k = 0, t = 0.25; t < seconds - 0.5; k++, t = 0.25 + k * beat) {
    clicks.push(t);
    const start = Math.round(t * RATE);
    const snare = k % 2 === 1;
    for (let i = 0; i < RATE * 0.15 && start + i < x.length; i++) {
      const env = Math.exp(-i / (RATE * (snare ? 0.04 : 0.05)));
      x[start + i] += snare ? 0.5 * noise() * env : 0.9 * Math.sin((2 * Math.PI * 55 * i) / RATE) * env;
    }
    const off = Math.round((t + beat / 2) * RATE);
    for (let i = 0; i < RATE * 0.03 && off + i < x.length; i++) x[off + i] += 0.12 * noise() * Math.exp(-i / (RATE * 0.008));
  }
  for (let i = 0; i < x.length; i++) {
    const bar = Math.floor((i / RATE - 0.25) / (4 * beat));
    const f = bar % 2 === 0 ? 220 : 196;
    x[i] += 0.05 * Math.sin((2 * Math.PI * f * i) / RATE);
  }
  return { x, clicks };
};

describe("beat tracking", () => {
  it("stays on the beats for the whole track when the tempo falls between analysis steps", () => {
    const { x, clicks } = track(128.7, 150);
    const a = analyzeMusic(x, RATE);
    expect(a.bpm).toBeGreaterThan(127.5);
    expect(a.bpm).toBeLessThan(130);
    // Every true beat in the last 30 s has a detected beat within 30 ms (a fixed grid drifts past that).
    const late = clicks.filter((c) => c > 120);
    const misses = late.filter((c) => !a.beats.some((b) => Math.abs(b - c) <= 0.03));
    expect(misses.length).toBeLessThanOrEqual(1);
  });
});

describe("fitting music", () => {
  const { x } = track(120, 120);
  const a = analyzeMusic(x, RATE);

  it("lands the track's ending on the cut, removing whole bars", () => {
    const plan = planFit(x, a, { lengthSec: 40, startAt: 0 });
    expect(plan.lengthSec).toBe(40);
    // The last hit lands before the cut, with some ring-out or a short hold after it.
    expect(plan.finalHitSec).toBeLessThanOrEqual(40);
    expect(plan.finalHitSec).toBeGreaterThan(40 - 3);
    if (plan.ending === "natural" && plan.edits.length) {
      const e = plan.edits[0];
      const bar = (4 * 60) / a.bpm;
      // Whole bars, so the beat continues across the edit.
      const bars = (e.toSec - e.fromSec) / bar;
      expect(Math.abs(bars - Math.round(bars))).toBeLessThan(0.05);
    }
  });

  it("can fade out from a bar line instead", () => {
    const plan = planFit(x, a, { lengthSec: 30, startAt: 0, ending: "fade" });
    expect(plan.ending).toBe("fade");
    expect(plan.edits).toHaveLength(0);
    expect(plan.fadeOutSec).toBeGreaterThanOrEqual(1.5);
    expect(plan.fadeOutSec).toBeLessThanOrEqual(4.5);
  });

  it("moves the beat map onto the fitted music", () => {
    const plan = planFit(x, a, { lengthSec: 40, startAt: 0 });
    const m = mapAnalysis(plan, a);
    expect(m.downbeats.every((t) => t >= 0 && t <= 40)).toBe(true);
    expect(m.downbeats.length).toBeGreaterThan(10);
    // Sections never overlap.
    for (let i = 1; i < m.sections.length; i++) expect(m.sections[i].start).toBeGreaterThanOrEqual(m.sections[i - 1].end - 0.01);
  });
});
