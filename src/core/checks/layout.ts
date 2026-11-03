import { contrastOf, luminance, type Pixels } from "./pixels";

/**
 * Text layout findings, measured from the real DOM of a frame (the scan runs where the video is drawn:
 * the editor's off-screen mount, or the render browser through the composition's layout probe), and
 * tallied across sampled frames into messages.
 */

export type Box = { x: number; y: number; w: number; h: number };

export type LayoutKind = "edge" | "clipped" | "margin" | "overlap" | "small" | "contrast" | "glyphs" | "case" | "safe-area";

export type LayoutFound = { kind: LayoutKind; key: string; text: string; clipId?: string; ratio?: number; detail?: string };

/** A visible run of text: where it is, its line height and its color (null when it's a gradient fill). */
export type TextBlock = {
  text: string;
  box: Box;
  lineH: number;
  rgb: [number, number, number] | null;
  /** The clip that draws it. */
  clipId?: string;
  /** Under the readable size (its contrast isn't judged). */
  small?: boolean;
  /** First family of its font stack, and letters that family's loaded faces don't cover. */
  font?: string;
  missing?: string;
  /** CSS text-transform when it changes case, and the language the text is marked as. */
  caseTransform?: string;
  lang?: string;
};

export type LayoutScan = { found: LayoutFound[]; blocks: TextBlock[] };

/** Name of the render artifact that carries a frame's layout scan out of the render browser. */
export const LAYOUT_ARTIFACT = "reframer-layout";

const quote = (text: string) => `"${text.length > 40 ? `${text.slice(0, 38)}…` : text}"`;
const clock = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, "0")}`;
const intersection = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * Text against what's behind it. `probe` is the same frame with every letter painted one flat color
 * (shadows, outlines, cards and the picture unchanged): pixels that differ between the two are the
 * letters, the rest is what the letters sit on. The weaker third of that background decides, since
 * text gets lost wherever the picture matches it.
 */
export const contrastFindings = (blocks: TextBlock[], frame: Pixels, probe: Pixels, W: number, H: number): LayoutFound[] => {
  const unit = Math.min(W, H) / 1080;
  if (frame.w !== probe.w || frame.h !== probe.h) return [];
  const k = frame.w / W;
  const out: LayoutFound[] = [];
  for (const t of blocks) {
    if (!t.rgb || t.small) continue;
    const lt = luminance(...t.rgb);
    const x0 = Math.max(0, Math.round(t.box.x * k));
    const y0 = Math.max(0, Math.round(t.box.y * k));
    const x1 = Math.min(frame.w - 1, Math.round((t.box.x + t.box.w) * k));
    const y1 = Math.min(frame.h - 1, Math.round((t.box.y + t.box.h) * k));
    const ratios: number[] = [];
    let letters = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * frame.w + x) * 4;
        const a = frame.px;
        const b = probe.px;
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 36) {
          letters++;
          continue;
        }
        ratios.push(contrastOf(lt, luminance(a[i], a[i + 1], a[i + 2])));
      }
    }
    // Nothing changed (text already in the probe color) or too few pixels to judge.
    if (!letters || ratios.length < 16) continue;
    ratios.sort((p, q) => p - q);
    const weak = ratios[Math.floor(ratios.length / 3)];
    // WCAG's floor for large text is 3:1; smaller text needs more (4.5:1 in WCAG; 4:1 here, as the
    // measure at this resolution reads small letters a little low).
    const large = t.lineH / 1.2 / unit >= 36;
    if (weak < (large ? 3 : 4)) out.push({ kind: "contrast", key: `contrast:${t.text}`, text: t.text, clipId: t.clipId, ratio: weak });
  }
  return out;
};

/** Letters the text's own font can't draw: the browser fills them in from another font. */
export const glyphFindings = (blocks: TextBlock[]): LayoutFound[] =>
  blocks
    .filter((b) => b.missing && b.font)
    .map((b) => ({
      kind: "glyphs",
      key: `glyphs:${b.font}:${b.missing}`,
      text: b.text,
      clipId: b.clipId,
      detail: `${b.font}|${b.missing}`,
    }));

const CASE_SENSITIVE_LANGS = ["tr", "az"];

/**
 * Case changed by CSS in Turkish (or Azerbaijani) text that isn't marked as such: "i" becomes "I"
 * instead of "İ" (and "I" becomes "i" instead of "ı").
 */
export const caseFindings = (blocks: TextBlock[], language: string | undefined): LayoutFound[] => {
  const base = language?.toLowerCase().split("-")[0];
  if (!base || !CASE_SENSITIVE_LANGS.includes(base)) return [];
  return blocks
    .filter(
      (b) =>
        b.caseTransform &&
        b.caseTransform !== "none" &&
        /[iIıİ]/.test(b.text) &&
        !CASE_SENSITIVE_LANGS.includes(b.lang?.toLowerCase().split("-")[0] ?? ""),
    )
    .map((b) => ({ kind: "case", key: `case:${b.text}`, text: b.text, clipId: b.clipId, detail: b.caseTransform }));
};

/**
 * Text under the apps' own interface on vertical video (TikTok, Reels, Shorts): the top bar, the
 * caption and account block at the bottom, the button column on the right. Same zones as the linter.
 */
export const SAFE_ZONES = { top: 0.115, bottom: 0.22, right: 0.13 };

export const safeAreaFindings = (blocks: TextBlock[], W: number, H: number): LayoutFound[] => {
  if (H / W < 1.5) return [];
  const zones: { name: string; box: Box }[] = [
    { name: "top bar", box: { x: 0, y: 0, w: W, h: H * SAFE_ZONES.top } },
    { name: "caption area", box: { x: 0, y: H * (1 - SAFE_ZONES.bottom), w: W, h: H * SAFE_ZONES.bottom } },
    { name: "button column", box: { x: W * (1 - SAFE_ZONES.right), y: 0, w: W * SAFE_ZONES.right, h: H } },
  ];
  const out: LayoutFound[] = [];
  for (const b of blocks) {
    const area = b.box.w * b.box.h;
    const hit = zones.find((z) => intersection(b.box, z.box) > area * 0.1);
    if (hit) out.push({ kind: "safe-area", key: `safe-area:${b.text}`, text: b.text, clipId: b.clipId, detail: hit.name });
  }
  return out;
};

/** A layout problem that held across samples, with the frames it was first and last seen at. */
export type LayoutIssue = { kind: LayoutKind; text: string; clipId?: string; firstFrame: number; lastFrame: number; message: string };

/** How many samples in a row a problem must hold before it counts (animations pass through odd states). */
const MIN_RUN: Partial<Record<LayoutKind, number>> = { glyphs: 1, case: 1 };

export const LAYOUT_ORDER: LayoutKind[] = ["edge", "clipped", "glyphs", "overlap", "contrast", "case", "small", "safe-area", "margin"];

/**
 * Findings per sampled frame, tallied: a problem counts once it holds for 2 samples in a row (contrast
 * only exists on probed frames, so its runs count probes in a row).
 */
export const tallyLayout = (rows: { frame: number; layout: LayoutFound[]; contrast?: LayoutFound[] }[], fps: number): LayoutIssue[] => {
  const seen = new Map<string, { found: LayoutFound; first: number; last: number; run: number; best: number; prev: number }>();
  let probed = -1;
  for (const [i, row] of rows.entries()) {
    if (row.contrast) probed++;
    for (const found of [...row.layout, ...(row.contrast ?? [])]) {
      const at = found.kind === "contrast" ? probed : i;
      const s = seen.get(found.key);
      if (!s) seen.set(found.key, { found, first: row.frame, last: row.frame, run: 1, best: 1, prev: at });
      else {
        s.run = s.prev === at - 1 ? s.run + 1 : 1;
        s.best = Math.max(s.best, s.run);
        s.prev = at;
        s.last = row.frame;
      }
    }
  }
  const when = (s: { first: number; last: number }) =>
    s.first === s.last ? `at ${clock(s.first / fps)}` : `${clock(s.first / fps)}–${clock(s.last / fps)}`;
  const messages: Record<LayoutKind, (s: { found: LayoutFound; first: number; last: number }) => string> = {
    edge: (s) => `Text runs off the frame ${when(s)}: ${quote(s.found.text)}. Keep every word inside the frame.`,
    clipped: (s) =>
      `Text is cut off by the box or chart it sits in ${when(s)}: ${quote(s.found.text)}. Give it room inside its container (or move it inside the chart's area) so every letter shows.`,
    margin: (s) => `Text hugs the frame edge ${when(s)}: ${quote(s.found.text)}. Keep text 5% in from every edge (title safe).`,
    overlap: (s) => `Text overlaps other text ${when(s)}: ${s.found.text}. Move one, or show them at different times.`,
    small: (s) => `Text too small to read on a phone ${when(s)}: ${quote(s.found.text)}. Make it at least 28 px (at 1080p) or cut it.`,
    contrast: (s) =>
      `Text is hard to read against the picture ${when(s)}: ${quote(s.found.text)} (about ${(s.found.ratio ?? 1).toFixed(1)}:1 against the parts of the picture behind it that match it most). Put a scrim, card or shadow behind it, or move it to a calmer, darker or lighter part of the frame.`,
    glyphs: (s) => {
      const [font, missing] = (s.found.detail ?? "|").split("|");
      return `The font ${font} has no ${[...missing].join(" ")} ${when(s)}: in ${quote(s.found.text)} those letters fall back to another font and look pasted in. Use a font that covers the language (Inter, Montserrat, Poppins, Roboto and most Google Fonts with Latin Extended do).`;
    },
    case: (s) =>
      `Uppercase Turkish text turns "i" into "I" instead of "İ" ${when(s)}: ${quote(s.found.text)}. Mark the text as Turkish or type the capitals yourself (İ, I).`,
    "safe-area": (s) =>
      `Text sits under the app's ${s.found.detail ?? "interface"} on TikTok, Reels and Shorts ${when(s)}: ${quote(s.found.text)}. Keep text out of the top ${SAFE_ZONES.top * 100}%, the bottom ${SAFE_ZONES.bottom * 100}% and the right ${SAFE_ZONES.right * 100}%.`,
  };
  return [...seen.values()]
    .filter((s) => s.best >= (MIN_RUN[s.found.kind] ?? 2))
    .sort((a, b) => LAYOUT_ORDER.indexOf(a.found.kind) - LAYOUT_ORDER.indexOf(b.found.kind) || a.first - b.first)
    .map((s) => ({
      kind: s.found.kind,
      text: s.found.text,
      ...(s.found.clipId ? { clipId: s.found.clipId } : {}),
      firstFrame: s.first,
      lastFrame: s.last,
      message: messages[s.found.kind](s),
    }));
};
