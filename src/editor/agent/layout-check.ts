"use client";

import { Thumbnail } from "@remotion/player";
import { type ComponentType, createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { getProjectDuration } from "@/core/project-utils";
import type { Project } from "@/core/schema";
import { ProjectComposition } from "@/remotion/ProjectComposition";

/**
 * Text layout, measured from the real DOM: the video is mounted at full size off screen, and at each
 * sampled frame every visible run of text is located. Flags text that runs off the frame, crowds the
 * edge, overlaps other text, is too small to read, or (given the rendered frames) is hard to read
 * against what surrounds it — things a contact sheet at 480 px hides.
 */

type Box = { x: number; y: number; w: number; h: number };
type Found = { kind: "edge" | "clipped" | "margin" | "overlap" | "small" | "contrast"; key: string; text: string; ratio?: number };
/** A visible run of text: where it is, its line height and its color (null when it's a gradient fill). */
type TextBox = { text: string; box: Box; lineH: number; rgb: [number, number, number] | null };

/** WCAG relative luminance of an sRGB color (0–255 channels). */
const luminance = (r: number, g: number, b: number) => {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const parseRgb = (css: string): [number, number, number] | null => {
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/.exec(css.trim());
  if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

const area = (b: Box) => b.w * b.h;
const intersection = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const union = (rects: Box[]): Box => {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y };
};
const clock = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, "0")}`;
const quote = (text: string) => `"${text.length > 40 ? `${text.slice(0, 38)}…` : text}"`;

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

const scan = (root: HTMLElement, W: number, H: number): { found: Found[]; boxes: TextBox[] } => {
  const base = root.getBoundingClientRect();
  const byLine = new Map<Element, { el: Element; text: string; rects: Box[]; rgb: TextBox["rgb"]; clipped: boolean }>();
  const frame = { x: 0, y: 0, w: W, h: H };
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
    const inFrameArea = ink.reduce((n, r) => n + intersection(r, frame), 0);
    const clipped = inFrameArea > 0 && inFrameArea - ink.reduce((n, r) => n + intersection(r, vis), 0) > inFrameArea * 0.03;
    const line = lineContainer(el, root);
    const prev = byLine.get(line);
    if (prev) {
      prev.text += ` ${text}`;
      prev.rects.push(...rects);
      prev.clipped ||= clipped;
      // A line in two colors (an accent word) is judged by its main color.
      if (!prev.rgb) prev.rgb = rgb;
    } else byLine.set(line, { el: line, text, rects, rgb, clipped });
  }
  const blocks = [...byLine.values()];
  const out: Found[] = [];
  const boxes: TextBox[] = [];
  const unit = Math.min(W, H) / 1080;
  const margin = 0.025;
  for (const b of blocks) {
    const u = union(b.rects);
    const inFrame = intersection(u, { x: 0, y: 0, w: W, h: H });
    if (inFrame <= 0) continue;
    if (inFrame < area(u) * 0.97) out.push({ kind: "edge", key: `edge:${b.text}`, text: b.text });
    else if (b.clipped) out.push({ kind: "clipped", key: `clipped:${b.text}`, text: b.text });
    else if (u.x < W * margin || u.x + u.w > W * (1 - margin) || u.y < H * margin || u.y + u.h > H * (1 - margin))
      out.push({ kind: "margin", key: `margin:${b.text}`, text: b.text });
    // A line box is about 1.2× the font size.
    const lineH = Math.max(...b.rects.map((r) => r.h));
    if (lineH / 1.2 / unit < 24) out.push({ kind: "small", key: `small:${b.text}`, text: b.text });
    else boxes.push({ text: b.text, box: u, lineH, rgb: b.rgb });
  }
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      // The same words drawn twice (an outline or shadow layer) aren't a collision.
      if (a.text === b.text || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const hit = a.rects.some((ra) => b.rects.some((rb) => intersection(ra, rb) > 0.3 * Math.min(area(ra), area(rb))));
      if (hit) {
        const [p, q] = [a.text, b.text].sort();
        out.push({ kind: "overlap", key: `overlap:${p}|${q}`, text: `${quote(p)} and ${quote(q)}` });
      }
    }
  }
  return { found: out, boxes };
};

/** RGBA pixels of a rendered frame, at the frame's own (reduced) size. */
const pixelsOf = (bitmap: ImageBitmap) => {
  const c = new OffscreenCanvas(bitmap.width, bitmap.height);
  const g = c.getContext("2d");
  if (!g) return null;
  g.drawImage(bitmap, 0, 0);
  return { px: g.getImageData(0, 0, bitmap.width, bitmap.height).data, w: bitmap.width, h: bitmap.height };
};
type Pixels = NonNullable<ReturnType<typeof pixelsOf>>;

/**
 * Text against what's behind it. `probe` is the same frame with every letter painted one flat color
 * (shadows, outlines, cards and the picture unchanged): pixels that differ between the two are the
 * letters, the rest is what the letters sit on. The weaker third of that background decides, since
 * text gets lost wherever the picture matches it.
 */
const contrastFindings = (boxes: TextBox[], frame: Pixels, probe: Pixels, W: number, H: number): Found[] => {
  const unit = Math.min(W, H) / 1080;
  if (frame.w !== probe.w || frame.h !== probe.h) return [];
  const k = frame.w / W;
  const out: Found[] = [];
  for (const t of boxes) {
    if (!t.rgb) continue;
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
        ratios.push(contrast(lt, luminance(a[i], a[i + 1], a[i + 2])));
      }
    }
    // Nothing changed (text already in the probe color) or too few pixels to judge.
    if (!letters || ratios.length < 16) continue;
    ratios.sort((p, q) => p - q);
    const weak = ratios[Math.floor(ratios.length / 3)];
    // WCAG's floor for large text is 3:1; smaller text needs more (4.5:1 in WCAG; 4:1 here, as the
    // measure at this resolution reads small letters a little low).
    const large = t.lineH / 1.2 / unit >= 36;
    if (weak < (large ? 3 : 4)) out.push({ kind: "contrast", key: `contrast:${t.text}`, text: t.text, ratio: weak });
  }
  return out;
};

/** The composition as Thumbnail's loosely typed component (its props travel in inputProps). */
const Video = ProjectComposition as unknown as ComponentType<Record<string, unknown>>;

// Timers, not animation frames: layout is measured synchronously, and a hidden page gets no frames.
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Layout findings at the given frames; a problem counts once it holds for 2 samples in a row. With
 * rendered frames and text probes of them (`bitmaps[i]` and `probes[i]` for `frames[i]`, the same
 * size), text contrast is checked too.
 */
export const measureLayout = async (
  project: Project,
  frames: number[],
  bitmaps: (ImageBitmap | undefined)[] = [],
  probes: (ImageBitmap | undefined)[] = [],
  budgetMs = 45_000,
): Promise<string[]> => {
  const started = Date.now();
  const { width: W, height: H, fps } = project.settings;
  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    left: "-40000px",
    top: "0px",
    width: `${W}px`,
    height: `${H}px`,
    overflow: "hidden",
    pointerEvents: "none",
  });
  document.body.appendChild(host);
  const root = createRoot(host);
  const seen = new Map<string, { found: Found; first: number; last: number; run: number; best: number; prev: number }>();
  // Contrast is only measured on probed frames, so its runs count probes in a row.
  let probed = -1;
  try {
    for (const [i, frame] of frames.entries()) {
      if (Date.now() - started > budgetMs) break;
      flushSync(() =>
        root.render(
          createElement(Thumbnail, {
            component: Video,
            inputProps: { project, editor: false },
            frameToDisplay: frame,
            durationInFrames: getProjectDuration(project),
            compositionWidth: W,
            compositionHeight: H,
            fps,
            style: { width: W, height: H },
          }),
        ),
      );
      // Effects (sizes, fonts asked for by components) settle, then the fonts arrive.
      await wait(0);
      await wait(0);
      await document.fonts.ready;
      await wait(30);
      const { found: layout, boxes } = scan(host, W, H);
      const bitmap = bitmaps[i];
      const probe = probes[i];
      const a = bitmap && probe ? pixelsOf(bitmap) : null;
      const b = bitmap && probe ? pixelsOf(probe) : null;
      if (a && b) probed++;
      for (const found of [...layout, ...(a && b ? contrastFindings(boxes, a, b, W, H) : [])]) {
        const at = found.kind === "contrast" ? probed : i;
        const s = seen.get(found.key);
        if (!s) seen.set(found.key, { found, first: frame, last: frame, run: 1, best: 1, prev: at });
        else {
          s.run = s.prev === at - 1 ? s.run + 1 : 1;
          s.best = Math.max(s.best, s.run);
          s.prev = at;
          s.last = frame;
        }
      }
    }
  } finally {
    root.unmount();
    host.remove();
  }
  const when = (s: { first: number; last: number }) =>
    s.first === s.last ? `at ${clock(s.first / fps)}` : `${clock(s.first / fps)}–${clock(s.last / fps)}`;
  const messages: Record<Found["kind"], (s: { found: Found; first: number; last: number }) => string> = {
    edge: (s) => `Text runs off the frame ${when(s)}: ${quote(s.found.text)}. Keep every word inside the frame.`,
    clipped: (s) =>
      `Text is cut off by the box or chart it sits in ${when(s)}: ${quote(s.found.text)}. Give it room inside its container (or move it inside the chart's area) so every letter shows.`,
    margin: (s) => `Text hugs the frame edge ${when(s)}: ${quote(s.found.text)}. Keep text 5% in from every edge (title safe).`,
    overlap: (s) => `Text overlaps other text ${when(s)}: ${s.found.text}. Move one, or show them at different times.`,
    small: (s) => `Text too small to read on a phone ${when(s)}: ${quote(s.found.text)}. Make it at least 28 px (at 1080p) or cut it.`,
    contrast: (s) =>
      `Text is hard to read against the picture ${when(s)}: ${quote(s.found.text)} (about ${(s.found.ratio ?? 1).toFixed(1)}:1 against the parts of the picture behind it that match it most). Put a scrim, card or shadow behind it, or move it to a calmer, darker or lighter part of the frame.`,
  };
  const order: Found["kind"][] = ["edge", "clipped", "overlap", "contrast", "small", "margin"];
  return [...seen.values()]
    .filter((s) => s.best >= 2)
    .sort((a, b) => order.indexOf(a.found.kind) - order.indexOf(b.found.kind) || a.first - b.first)
    .slice(0, 8)
    .map((s) => messages[s.found.kind](s));
};
