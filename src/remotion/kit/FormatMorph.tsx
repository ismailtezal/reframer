import { Video } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { fontStack, useFonts } from "../fonts";
import { ramp } from "./shared";

export type FormatMorphProps = {
  /** Aspect ratios in order: "16:9", "1:1", "9:16", "4:5"… (or width / height numbers). */
  formats: (string | number)[];
  /** Frames into the clip when each change starts (formats[i] → formats[i + 1]). */
  at: number[];
  /** Frames each change takes (default 16). */
  duration?: number;
  /** Size of the frame as the side of a square of the same area, in px (default 600): the shape
   * changes but the frame keeps its visual weight. */
  size?: number;
  radius?: number;
  /** Image or video inside, cropped to fill and kept centered on `focus` (0–1). */
  src?: string;
  focus?: { x: number; y: number };
  /** A chip with the current format: true shows the ratio, or pass one label per format. */
  label?: boolean | string[];
  accent?: string;
  /** Content laid out in percentages or flex reflows with the frame (captions stay at the bottom, etc.). */
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

const toRatio = (f: string | number) => {
  if (typeof f === "number") return f;
  const m = /^\s*(\d+(?:\.\d+)?)\s*[:/x×]\s*(\d+(?:\.\d+)?)\s*$/.exec(f);
  return m ? Number(m[1]) / Number(m[2]) : 16 / 9;
};

/**
 * One frame that changes shape on screen (16:9 → 9:16 → 1:1…) instead of cutting between versions:
 * the shape eases through each change, the picture stays centered on its subject, and each arrival
 * lands with a small settle and a flash of the edge.
 */
export const FormatMorph: React.FC<FormatMorphProps> = ({
  formats,
  at,
  duration = 16,
  size = 600,
  radius = 26,
  src,
  focus = { x: 0.5, y: 0.5 },
  label = true,
  accent = "#ffffff",
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  useFonts([{ family: "Inter", weight: 700 }]);
  const ratios = formats.map(toRatio);
  // Which change we're in, and how far through it.
  let index = 0;
  let p = 0;
  for (let i = 0; i < ratios.length - 1; i++) {
    const t = at[i] ?? Number.POSITIVE_INFINITY;
    if (frame >= t) {
      index = i;
      p = ramp(frame, t, duration, "ease-in-out");
    }
  }
  const from = ratios[index];
  const to = ratios[Math.min(index + 1, ratios.length - 1)];
  const started = frame >= (at[0] ?? Number.POSITIVE_INFINITY);
  // Ease in log space so 16:9 → 9:16 passes through the square at the midpoint.
  const aspect = started ? from * (to / from) ** p : ratios[0];
  const w = size * Math.sqrt(aspect);
  const h = size / Math.sqrt(aspect);
  // Arrival: a small settle and a flash of the edge just after each change completes.
  const arrivals = at.slice(0, ratios.length - 1).map((t) => t + duration);
  const since = Math.min(...arrivals.map((t) => (frame >= t ? frame - t : Number.POSITIVE_INFINITY)));
  const settle = since < 14 ? Math.sin((since / 14) * Math.PI) * Math.exp(-since / 10) : 0;
  const current = started ? (p < 0.5 ? index : Math.min(index + 1, ratios.length - 1)) : 0;
  const chip = label === true ? String(formats[current]) : Array.isArray(label) ? label[current] : null;
  const isVideo = src ? /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src) : false;
  const media = src ? (
    isVideo ? (
      <Video
        src={src}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${focus.x * 100}% ${focus.y * 100}%` }}
      />
    ) : (
      <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${focus.x * 100}% ${focus.y * 100}%` }} />
    )
  ) : null;
  return (
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        borderRadius: radius,
        overflow: "hidden",
        transform: `scale(${1 + 0.018 * settle})`,
        boxShadow: `0 40px 90px rgba(0,0,0,0.45), inset 0 0 0 ${1 + 2 * settle}px rgba(255,255,255,${0.14 + 0.5 * settle})`,
        background: "#000",
        ...style,
      }}
    >
      {media}
      {children ? <AbsoluteFill>{children}</AbsoluteFill> : null}
      {chip ? (
        <div
          style={{
            position: "absolute",
            top: 18,
            left: 18,
            padding: "6px 16px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.5)",
            color: accent,
            fontFamily: fontStack("Inter"),
            fontWeight: 700,
            fontSize: Math.max(22, size * 0.05),
            letterSpacing: "-0.01em",
          }}
        >
          {chip}
        </div>
      ) : null}
    </div>
  );
};
