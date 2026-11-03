import { type Pixels, resample } from "./pixels";

/**
 * What a viewer notices across a video, from frames sampled once a second: holds, empty frames,
 * repeated shots, length against the brief, and pace against the brief's energy.
 */

/** 32×18 grayscale fingerprint of a frame. */
export const fingerprint = (frame: Pixels) => {
  const { px } = resample(frame, 32, 18);
  const out: number[] = [];
  for (let i = 0; i < px.length; i += 4) out.push(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
  return out;
};
export const diff = (a: number[], b: number[]) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0) / Math.max(1, a.length);
export const spread = (a: number[]) => {
  const m = a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length));
};
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** What a viewer would notice, measured from frames sampled once a second. */
export const measureFrames = (prints: number[][], durationSec: number, targetSec?: number) => {
  const findings: string[] = [];
  // Holding still: under 1.5 grey levels of change per second for 3 s or more.
  let runStart = -1;
  for (let i = 1; i <= prints.length; i++) {
    const still = i < prints.length && diff(prints[i - 1], prints[i]) < 1.5;
    if (still && runStart < 0) runStart = i - 1;
    if (!still && runStart >= 0) {
      if (i - 1 - runStart >= 3)
        findings.push(
          `Holds almost perfectly still from ${clock(runStart)} to ${clock(i - 1)} (${i - 1 - runStart} s): add camera movement or secondary animation, or cut it shorter.`,
        );
      runStart = -1;
    }
  }
  // Near-empty: a flat frame (one color) for 2 s or more.
  let flatStart = -1;
  for (let i = 0; i <= prints.length; i++) {
    const flat = i < prints.length && spread(prints[i]) < 8;
    if (flat && flatStart < 0) flatStart = i;
    if (!flat && flatStart >= 0) {
      if (i - flatStart >= 2) findings.push(`Nearly empty (one flat color) from ${clock(flatStart)} to ${clock(i)}.`);
      flatStart = -1;
    }
  }
  // Repeats: detailed frames 8 s or more apart that look nearly identical.
  const pairs: string[] = [];
  for (let i = 0; i < prints.length; i++) {
    if (spread(prints[i]) < 15) continue;
    for (let j = i + 8; j < prints.length; j++) {
      if (spread(prints[j]) >= 15 && diff(prints[i], prints[j]) < 9) {
        pairs.push(`${clock(i)} ≈ ${clock(j)}`);
        i = j;
        break;
      }
    }
  }
  if (pairs.length) findings.push(`Shots repeat almost identically: ${pairs.slice(0, 6).join(", ")} — vary framing, scale or scene.`);
  if (targetSec && Math.abs(durationSec - targetSec) / targetSec > 0.08) {
    findings.push(`Runs ${durationSec.toFixed(1)} s but the brief asks for ${targetSec.toFixed(0)} s.`);
  }
  return findings;
};

// Whole words in any script (\b only knows ASCII letters, so "hızlı" would never match).
const words = (list: string) => new RegExp(`(?<![\\p{L}\\p{N}])(${list})(?![\\p{L}\\p{N}])`, "iu");
export const FAST = words(
  "energetic|high[- ]energy|fast|hype|punchy|bold|upbeat|dynamic|action|sport|explosive|enerjik|hızlı|dinamik|coşkulu|hareketli",
);
export const SLOW = words("calm|cozy|cosy|relaxing|chill|gentle|slow|peaceful|soothing|meditative|sakin|huzurlu|rahatlatıcı|yavaş|dingin");
export const SPOT = words("promo|ad|advert|commercial|spot|reel|teaser|trailer|intro|launch|tanıtım|reklam|fragman");
/** A new shot: the mean grey level moves this much from one second to the next (camera moves and text
 * animation stay well under it; a cut to another picture lands around 40–90). */
const CHANGE = 40;

/**
 * Pace against the brief's energy. Picture changes are counted from the per-second fingerprints
 * (scene changes inside one component count too); an energetic brief wants a new picture about every
 * second, a calm one lets shots breathe.
 */
export const measurePace = (prints: number[][], durationSec: number, brief: string) => {
  if (prints.length < 6) return [];
  let changes = 0;
  for (let i = 1; i < prints.length; i++) if (diff(prints[i - 1], prints[i]) > CHANGE) changes++;
  const shot = durationSec / (changes + 1);
  if (FAST.test(brief) && !SLOW.test(brief) && shot > 2.2)
    return [
      `The picture changes about every ${shot.toFixed(1)} s, slow for a brief that asks for energy: cut every 0.8–1.6 s on the beat (whips, punch-ins, match cuts), keeping one or two longer holds for the key lines.`,
    ];
  if (SLOW.test(brief) && !FAST.test(brief) && shot < 1.2)
    return [
      `The picture changes about every ${shot.toFixed(1)} s, frantic for a calm brief: let shots breathe for 2–4 s with slow camera moves.`,
    ];
  // Short spots (promos, ads, reels, teasers, intros) move even when the tone is calm: every second counts.
  const limit = SLOW.test(brief) ? 3.2 : 2.6;
  if (SPOT.test(brief) && durationSec <= 35 && shot > limit)
    return [
      `The picture changes about every ${shot.toFixed(1)} s, slow for a ${durationSec.toFixed(0)}-second spot: keep shots to about ${(limit - 0.6).toFixed(1)} s on average (a calm tone can still cut on the beat), drop shots that carry no message, and let only the key moment hold longer.`,
    ];
  return [];
};

/** A brief that asks for energy (and not for calm). */
export const isEnergetic = (brief: string) => FAST.test(brief) && !SLOW.test(brief);
