"use client";

import { Thumbnail } from "@remotion/player";
import { type ComponentType, createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { caseFindings, contrastFindings, glyphFindings, type LayoutFound, tallyLayout } from "@/core/checks/layout";
import type { Pixels } from "@/core/checks/pixels";
import { projectLanguage } from "@/core/language";
import { getProjectDuration } from "@/core/project-utils";
import type { Project } from "@/core/schema";
import { ProjectComposition } from "@/remotion/ProjectComposition";
import { scanLayout } from "@/remotion/probe/layout-scan";

/**
 * Text layout, measured from the real DOM: the video is mounted at full size off screen, and at each
 * sampled frame every visible run of text is located. Flags text that runs off the frame, crowds the
 * edge, overlaps other text, is too small to read, is drawn in a fallback font, or (given the
 * rendered frames) is hard to read against what surrounds it — things a contact sheet at 480 px hides.
 */

/** RGBA pixels of a rendered frame, at the frame's own (reduced) size. */
export const bitmapPixels = (bitmap: ImageBitmap): Pixels | null => {
  const c = new OffscreenCanvas(bitmap.width, bitmap.height);
  const g = c.getContext("2d");
  if (!g) return null;
  g.drawImage(bitmap, 0, 0);
  return { px: g.getImageData(0, 0, bitmap.width, bitmap.height).data, w: bitmap.width, h: bitmap.height };
};

/** The composition as Thumbnail's loosely typed component (its props travel in inputProps). */
const Video = ProjectComposition as unknown as ComponentType<Record<string, unknown>>;

// Timers, not animation frames: layout is measured synchronously, and a hidden page gets no frames.
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Layout findings at the given frames; a problem counts once it holds for 2 samples in a row. With
 * rendered frames and text probes of them (`frames[i]` and `probes[i]` for `frameNumbers[i]`, the same
 * size), text contrast is checked too.
 */
export const measureLayout = async (
  project: Project,
  frameNumbers: number[],
  frames: (Pixels | null | undefined)[] = [],
  probes: (Pixels | null | undefined)[] = [],
  budgetMs = 45_000,
): Promise<string[]> => {
  const started = Date.now();
  const { width: W, height: H, fps } = project.settings;
  const language = projectLanguage(project);
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
  const rows: { frame: number; layout: LayoutFound[]; contrast?: LayoutFound[] }[] = [];
  try {
    for (const [i, frame] of frameNumbers.entries()) {
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
      const { found, blocks } = scanLayout(host, W, H);
      const a = frames[i];
      const b = probes[i];
      rows.push({
        frame,
        layout: [...found, ...glyphFindings(blocks), ...caseFindings(blocks, language)],
        ...(a && b ? { contrast: contrastFindings(blocks, a, b, W, H) } : {}),
      });
    }
  } finally {
    root.unmount();
    host.remove();
  }
  return tallyLayout(rows, fps)
    .slice(0, 8)
    .map((issue) => issue.message);
};
