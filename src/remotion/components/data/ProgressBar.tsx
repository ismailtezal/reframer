import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { withAlpha } from "../../../core/color";
import { fontStack, useFonts } from "../../fonts";
import { lerp, progress } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  position: "top" | "bottom";
  /** px at 1080p */
  thickness: number;
  /** Distance from the box edges, px at 1080p (0 = edge to edge). */
  inset: number;
  rounded: boolean;
  fillColor: string;
  trackColor: string;
  trackOpacity: number;
  /** Fill range in percent over the clip. */
  from: number;
  to: number;
  easing: "linear" | "smooth" | "ease-in-out";
  chapters: string;
  showLabels: boolean;
  showPercent: boolean;
  knob: boolean;
  labelColor: string;
  fontFamily: string;
  exit: boolean;
};

type Chapter = { label: string; start: number; end: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** "Intro" lines split the bar evenly; "0:12 Demo" lines start at that time (seconds into the clip). */
const parseChapters = (raw: string, clipSeconds: number): Chapter[] => {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const timed = lines.map((l) => {
    const m = l.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)\s+(.*)$/);
    return m ? { at: Number(m[1] ?? 0) * 60 + Number(m[2]), label: m[3] } : null;
  });
  const starts = timed.every((x) => x !== null)
    ? timed.map((x) => clamp01((x?.at ?? 0) / Math.max(0.001, clipSeconds)))
    : lines.map((_, i) => i / lines.length);
  const labels = timed.every((x) => x !== null) ? timed.map((x) => x?.label ?? "") : lines;
  const order = starts.map((start, i) => ({ start, label: labels[i] })).sort((a, b) => a.start - b.start);
  order[0].start = 0;
  return order.map((c, i) => ({ label: c.label, start: c.start, end: order[i + 1]?.start ?? 1 }));
};

const ProgressBar: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([{ family: p.fontFamily, weight: 600 }]);
  // Timeline in 30 fps frames for the entrance; the fill itself spans the whole clip.
  const t = (frame * 30) / fps;
  const last = ((p.durationInFrames - 1) * 30) / fps;
  const fillT = progress(frame, 0, Math.max(1, p.durationInFrames - 1), p.easing);
  const value = clamp01(lerp(p.from, p.to, fillT) / 100);

  const inset = p.inset * unit;
  const barW = Math.max(1, p.width - inset * 2);
  const th = Math.max(1, p.thickness * unit);
  const radius = p.rounded ? th / 2 : 0;
  const gap = Math.max(2, th * 0.75);
  const chapters = parseChapters(p.chapters, p.durationInFrames / fps);
  const segments = chapters.length > 0 ? chapters : [{ label: "", start: 0, end: 1 }];
  const top = p.position === "top";

  const enter = progress(t, 0, 20, "smooth");
  const e = p.exit ? progress(t, last - 10, 10, "ease-in") : 0;
  // How much progress ~8 frames of fill covers, for label crossfades.
  const fadeSpan = Math.max(0.004, (8 * Math.abs(p.to - p.from)) / 100 / Math.max(1, p.durationInFrames - 1));
  const labelSize = Math.max(28 * unit, th * 3.2);
  const labelGap = Math.max(10 * unit, th * 1.4);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", opacity: 1 - e, fontFamily: fontStack(p.fontFamily) }}>
      <div
        style={{
          position: "absolute",
          left: inset,
          width: barW,
          height: th,
          [top ? "top" : "bottom"]: inset,
          opacity: Math.min(1, enter * 1.5),
          // Wipes on from the left; the slack around the edges keeps the knob unclipped.
          clipPath: `inset(-${th * 2}px ${((1 - enter) * barW - th * 2 * enter).toFixed(2)}px -${th * 2}px -${th * 2}px)`,
        }}
      >
        {segments.map((c, i) => {
          const x0 = c.start * barW + (i > 0 ? gap / 2 : 0);
          const x1 = c.end * barW - (i < segments.length - 1 ? gap / 2 : 0);
          const w = Math.max(0, x1 - x0);
          const f = clamp01((value - c.start) / Math.max(1e-6, c.end - c.start));
          return (
            <div
              key={`${i}-${c.label}`}
              style={{
                position: "absolute",
                left: x0,
                width: w,
                top: 0,
                height: th,
                borderRadius: radius,
                overflow: "hidden",
                backgroundColor: withAlpha(p.trackColor, p.trackOpacity),
              }}
            >
              <div style={{ width: w * f, height: "100%", borderRadius: radius, backgroundColor: p.fillColor }} />
            </div>
          );
        })}
        {p.knob ? (
          <div
            style={{
              position: "absolute",
              left: value * barW - th * 1.2,
              top: -th * 0.7,
              width: th * 2.4,
              height: th * 2.4,
              borderRadius: "50%",
              backgroundColor: p.fillColor,
              boxShadow: `0 ${th * 0.3}px ${th}px rgba(0,0,0,0.35)`,
            }}
          />
        ) : null}
      </div>
      {p.showLabels
        ? chapters.map((c, i) => {
            const fadeIn = clamp01((value - c.start) / fadeSpan);
            const fadeOut = i === chapters.length - 1 ? 1 : clamp01((c.end - value) / fadeSpan);
            const o = Math.min(fadeIn, fadeOut) * enter;
            if (o <= 0 || !c.label) return null;
            const x0 = c.start * barW + (i > 0 ? gap / 2 : 0);
            // Padding gives the text shadow room inside the ellipsis clip.
            const pad = 10 * unit;
            return (
              <div
                key={`label-${i}-${c.label}`}
                style={{
                  position: "absolute",
                  left: inset + x0 - pad,
                  [top ? "top" : "bottom"]: inset + th + labelGap - pad,
                  padding: pad,
                  width: "max-content",
                  maxWidth: Math.max(0, barW - x0 + pad * 2),
                  boxSizing: "border-box",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontSize: labelSize,
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                  color: p.labelColor,
                  textShadow: `0 ${unit}px ${8 * unit}px rgba(0,0,0,0.45)`,
                  opacity: o,
                  transform: `translateY(${((1 - o) * (top ? -8 : 8) * unit).toFixed(2)}px)`,
                }}
              >
                {c.label}
              </div>
            );
          })
        : null}
      {p.showPercent ? (
        <div
          style={{
            position: "absolute",
            left: inset + value * barW,
            [top ? "top" : "bottom"]: inset + th + labelGap,
            width: "max-content",
            fontSize: labelSize,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            color: p.labelColor,
            textShadow: `0 ${unit}px ${8 * unit}px rgba(0,0,0,0.45)`,
            opacity: enter,
            transform: `translateX(${(-value * 100).toFixed(2)}%)`,
          }}
        >
          {`${Math.round(value * 100)}%`}
        </div>
      ) : null}
    </div>
  );
};

export const progressBar = defineMotionComponent<Props>({
  id: "progress-bar",
  name: "Progress bar",
  category: "data",
  description:
    "Video progress / loading bar along the top or bottom edge that fills over the clip, with optional chapter segments and labels (one per line, optionally prefixed with a time like '0:12 Demo'), percentage and knob. Stretch the clip over the part of the video it tracks.",
  schema: {
    position: { type: "enum", label: "Position", default: "bottom", options: ["bottom", "top"] },
    thickness: { type: "number", label: "Thickness", default: 8, min: 1, max: 60, step: 1, description: "px at 1080p" },
    inset: { type: "number", label: "Inset", default: 48, min: 0, max: 300, step: 1, description: "Distance from the edges, px at 1080p" },
    rounded: { type: "boolean", label: "Rounded", default: true },
    fillColor: { type: "color", label: "Fill", default: "#FFFFFF" },
    trackColor: { type: "color", label: "Track", default: "#FFFFFF" },
    trackOpacity: { type: "number", label: "Track opacity", default: 0.24, min: 0, max: 1, step: 0.01 },
    from: { type: "number", label: "From %", default: 0, min: 0, max: 100, step: 1 },
    to: { type: "number", label: "To %", default: 100, min: 0, max: 100, step: 1 },
    easing: { type: "enum", label: "Easing", default: "linear", options: ["linear", "smooth", "ease-in-out"] },
    chapters: { type: "text", label: "Chapters", default: "", description: "One per line, e.g. 'Intro' or '0:12 Demo'" },
    showLabels: { type: "boolean", label: "Chapter labels", default: true },
    showPercent: { type: "boolean", label: "Percent", default: false },
    knob: { type: "boolean", label: "Knob", default: false },
    labelColor: { type: "color", label: "Label color", default: "#FFFFFF" },
    fontFamily: { type: "font", label: "Font", default: "Inter" },
    exit: { type: "boolean", label: "Animate out", default: false },
  },
  defaults: {
    position: "bottom",
    thickness: 8,
    inset: 48,
    rounded: true,
    fillColor: "#FFFFFF",
    trackColor: "#FFFFFF",
    trackOpacity: 0.24,
    from: 0,
    to: 100,
    easing: "linear",
    chapters: "",
    showLabels: true,
    showPercent: false,
    knob: false,
    labelColor: "#FFFFFF",
    fontFamily: "Inter",
    exit: false,
  },
  defaultDuration: 10,
  Component: ProgressBar,
  tags: ["progress", "loading", "chapters", "timeline", "shorts", "bar"],
});
