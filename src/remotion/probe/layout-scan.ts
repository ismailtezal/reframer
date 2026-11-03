import type { Box, LayoutFound, LayoutScan, TextBlock } from "../../core/checks/layout";

/**
 * Locates every visible run of text in a mounted frame of the video (DOM only): flags text that runs
 * off the frame, is cut off by its container, crowds the edge, overlaps other text or is too small to
 * read, and records each block's box, color, font coverage and case handling for the checks that
 * need pixels or the project's language. Runs in the editor's off-screen mount and, through the
 * composition's layout probe, in the render browser.
 */

const area = (b: Box) => b.w * b.h;
const intersection = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const union = (rects: Box[]): Box => {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y };
};
const quote = (text: string) => `"${text.length > 40 ? `${text.slice(0, 38)}…` : text}"`;

const parseRgb = (css: string): [number, number, number] | null => {
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/.exec(css.trim());
  if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

/** How opaque an element is on screen (its own opacity times its ancestors', up to the video root). */
const opacityOf = (el: Element, root: Element) => {
  let o = 1;
  for (let e: Element | null = el; e && e !== root; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none") return 0;
    o *= Number(cs.opacity);
    if (o < 0.05) return 0;
  }
  return o;
};

/** The element that lays out a run of text as one line or paragraph (word spans join their line). */
const lineContainer = (el: Element, root: Element) => {
  for (let e: Element | null = el; e && e !== root; e = e.parentElement) {
    const d = getComputedStyle(e).display;
    if (d !== "inline" && d !== "inline-block" && d !== "contents") return e;
  }
  return el;
};

/**
 * The part of the frame where an element can still be seen: its ancestors that clip their content
 * (overflow other than visible, which includes every inline <svg>) cut the frame down.
 */
const visibleArea = (el: Element, root: Element, base: DOMRect, W: number, H: number): Box => {
  let clip: Box = { x: 0, y: 0, w: W, h: H };
  for (let e: Element | null = el; e && e !== root; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
    const r = e.getBoundingClientRect();
    const box = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    const x = Math.max(clip.x, box.x);
    const y = Math.max(clip.y, box.y);
    clip = {
      x,
      y,
      w: Math.max(0, Math.min(clip.x + clip.w, box.x + box.w) - x),
      h: Math.max(0, Math.min(clip.y + clip.h, box.y + box.h) - y),
    };
  }
  return clip;
};

/** Code point ranges the loaded faces of a family cover; null when none is loaded (a system font). */
const coverageOf = (family: string, cache: Map<string, [number, number][] | null>) => {
  const known = cache.get(family);
  if (known !== undefined) return known;
  let ranges: [number, number][] | null = null;
  document.fonts.forEach((face) => {
    if (face.status !== "loaded" || face.family.replace(/^["']|["']$/g, "") !== family) return;
    ranges ??= [];
    for (const part of face.unicodeRange.split(",")) {
      const m = /U\+([0-9a-f?]+)(?:-([0-9a-f]+))?/i.exec(part.trim());
      if (!m) continue;
      const lo = Number.parseInt(m[1].replace(/\?/g, "0"), 16);
      const hi = m[2] ? Number.parseInt(m[2], 16) : Number.parseInt(m[1].replace(/\?/g, "f"), 16);
      ranges.push([lo, hi]);
    }
  });
  cache.set(family, ranges);
  return ranges;
};

/** Letters and digits of `text` that the family's loaded faces don't cover (emoji fall back by design). */
const missingGlyphs = (text: string, family: string, cache: Map<string, [number, number][] | null>) => {
  const ranges = coverageOf(family, cache);
  if (!ranges) return "";
  const missing = new Set<string>();
  for (const ch of text) {
    if (!/[\p{L}\p{N}]/u.test(ch)) continue;
    const cp = ch.codePointAt(0) ?? 0;
    if (!ranges.some(([lo, hi]) => cp >= lo && cp <= hi)) missing.add(ch);
  }
  return [...missing].join("");
};

type Run = {
  el: Element;
  text: string;
  rects: Box[];
  rgb: TextBlock["rgb"];
  clipped: boolean;
  clipId?: string;
  font?: string;
  missing: string;
  caseTransform?: string;
  lang?: string;
};

export const scanLayout = (root: HTMLElement, W: number, H: number): LayoutScan => {
  const base = root.getBoundingClientRect();
  const byLine = new Map<Element, Run>();
  const frame = { x: 0, y: 0, w: W, h: H };
  const coverage = new Map<string, [number, number][] | null>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.textContent ?? "").replace(/\s+/g, " ").trim();
    const el = n.parentElement;
    if (!text || !el || opacityOf(el, root) < 0.6) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()]
      .map((r) => ({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }))
      .filter((r) => r.w > 2 && r.h > 2);
    if (!rects.length) continue;
    const cs = getComputedStyle(el);
    // SVG text is painted with `fill`; gradient-filled HTML text (transparent fill over a clipped
    // background) has no single color to judge.
    const fill = cs.getPropertyValue("-webkit-text-fill-color");
    const rgb =
      el instanceof SVGElement ? parseRgb(cs.fill) : fill && parseRgb(fill) === null && fill !== cs.color ? null : parseRgb(cs.color);
    // Cut off by a box or chart that clips it (not by the frame edge, which is its own finding).
    // Judged on the ink (the middle of the line's box): display type with a tight line height sits in a
    // reveal mask that clips only the font's empty ascent and descent.
    const vis = visibleArea(el, root, base, W, H);
    const ink = rects.map((r) => ({ x: r.x, y: r.y + r.h * 0.15, w: r.w, h: r.h * 0.7 }));
    const inFrameArea = ink.reduce((s, r) => s + intersection(r, frame), 0);
    const clipped = inFrameArea > 0 && inFrameArea - ink.reduce((s, r) => s + intersection(r, vis), 0) > inFrameArea * 0.03;
    const font =
      cs.fontFamily
        .split(",")[0]
        ?.trim()
        .replace(/^["']|["']$/g, "") || undefined;
    const missing = font ? missingGlyphs(text, font, coverage) : "";
    const caseTransform = cs.textTransform !== "none" ? cs.textTransform : undefined;
    const lang = el.closest("[lang]")?.getAttribute("lang") ?? undefined;
    const clipId = el.closest("[data-clip-id]")?.getAttribute("data-clip-id") ?? undefined;
    const line = lineContainer(el, root);
    const prev = byLine.get(line);
    if (prev) {
      prev.text += ` ${text}`;
      prev.rects.push(...rects);
      prev.clipped ||= clipped;
      // A line in two colors (an accent word) is judged by its main color.
      if (!prev.rgb) prev.rgb = rgb;
      for (const ch of missing) if (!prev.missing.includes(ch)) prev.missing += ch;
      prev.caseTransform ??= caseTransform;
    } else byLine.set(line, { el: line, text, rects, rgb, clipped, clipId, font, missing, caseTransform, lang });
  }
  const runs = [...byLine.values()];
  const found: LayoutFound[] = [];
  const blocks: TextBlock[] = [];
  const unit = Math.min(W, H) / 1080;
  const margin = 0.025;
  for (const b of runs) {
    const u = union(b.rects);
    const inFrame = intersection(u, { x: 0, y: 0, w: W, h: H });
    if (inFrame <= 0) continue;
    const at = { text: b.text, ...(b.clipId ? { clipId: b.clipId } : {}) };
    if (inFrame < area(u) * 0.97) found.push({ kind: "edge", key: `edge:${b.text}`, ...at });
    else if (b.clipped) found.push({ kind: "clipped", key: `clipped:${b.text}`, ...at });
    else if (u.x < W * margin || u.x + u.w > W * (1 - margin) || u.y < H * margin || u.y + u.h > H * (1 - margin))
      found.push({ kind: "margin", key: `margin:${b.text}`, ...at });
    // A line box is about 1.2× the font size.
    const lineH = Math.max(...b.rects.map((r) => r.h));
    const small = lineH / 1.2 / unit < 24;
    if (small) found.push({ kind: "small", key: `small:${b.text}`, ...at });
    blocks.push({
      text: b.text,
      box: u,
      lineH,
      rgb: b.rgb,
      ...(b.clipId ? { clipId: b.clipId } : {}),
      ...(small ? { small } : {}),
      ...(b.font ? { font: b.font } : {}),
      ...(b.missing ? { missing: b.missing } : {}),
      ...(b.caseTransform ? { caseTransform: b.caseTransform } : {}),
      ...(b.lang ? { lang: b.lang } : {}),
    });
  }
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i];
      const b = runs[j];
      // The same words drawn twice (an outline or shadow layer) aren't a collision.
      if (a.text === b.text || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const hit = a.rects.some((ra) => b.rects.some((rb) => intersection(ra, rb) > 0.3 * Math.min(area(ra), area(rb))));
      if (hit) {
        const [p, q] = [a.text, b.text].sort();
        found.push({ kind: "overlap", key: `overlap:${p}|${q}`, text: `${quote(p)} and ${quote(q)}` });
      }
    }
  }
  return { found, blocks };
};
