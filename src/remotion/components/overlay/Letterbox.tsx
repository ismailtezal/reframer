import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { fontStack, useFonts } from "../../fonts";
import { progress } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  ratio: "2.39" | "2.0" | "1.85";
  color: string;
  animateIn: boolean;
  /** seconds */
  inDuration: number;
  exit: boolean;
  /** Optional caption set in the lower bar (location, date, chapter). */
  label: string;
  labelAlign: "left" | "center" | "right";
  labelColor: string;
  fontFamily: string;
};

const Letterbox: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([{ family: p.fontFamily, weight: 500 }]);
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const ratio = Number.parseFloat(p.ratio) || 2.39;
  // Whole pixels so the bars never leave a hairline seam.
  const bar = Math.max(0, Math.round((h - w / ratio) / 2));
  const inFrames = Math.max(1, Math.round(p.inDuration * fps));
  const enter = p.animateIn ? progress(frame, 0, inFrames, "smooth") : 1;
  const exitFrames = 14;
  const leave = p.exit ? progress(frame, p.durationInFrames - 1 - exitFrames, exitFrames, "ease-in-out") : 0;
  const shown = enter * (1 - leave);
  const offset = (1 - shown) * (bar + 2);

  const labelSize = Math.max(24 * unit, Math.min(30 * unit, bar * 0.3));
  const showLabel = p.label.trim() !== "" && bar >= labelSize * 1.9;
  const labelIn = progress(frame, p.animateIn ? Math.round(inFrames * 0.55) : 0, 20, "smooth");
  const labelOpacity = showLabel ? labelIn * (1 - Math.min(1, leave * 2)) : 0;
  const margin = Math.max(48 * unit, w * 0.05);

  const barStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    width: "100%",
    height: bar,
    backgroundColor: p.color,
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", pointerEvents: "none" }}>
      {bar > 0 ? (
        <>
          <div style={{ ...barStyle, top: 0, transform: `translateY(${-offset}px)` }} />
          <div style={{ ...barStyle, bottom: 0, transform: `translateY(${offset}px)` }}>
            {showLabel ? (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: margin,
                  right: margin,
                  transform: `translateY(calc(-50% + ${(1 - labelIn) * 8 * unit}px))`,
                  textAlign: p.labelAlign,
                  fontFamily: fontStack(p.fontFamily),
                  fontWeight: 500,
                  fontSize: labelSize,
                  lineHeight: 1,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: p.labelColor,
                  opacity: labelOpacity,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.label}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
};

export const letterbox = defineMotionComponent<Props>({
  id: "letterbox",
  name: "Letterbox",
  category: "overlay",
  description:
    "Cinematic letterbox bars (2.39, 2.0 or 1.85:1) that glide in from the frame edges, with an optional small-caps caption in the lower bar (location, date, chapter). Put it on the top track over footage for a film look; enable `exit` to slide the bars away at the end of the clip.",
  schema: {
    ratio: { type: "enum", label: "Aspect ratio", default: "2.39", options: ["2.39", "2.0", "1.85"] },
    color: { type: "color", label: "Bar color", default: "#000000" },
    animateIn: { type: "boolean", label: "Slide in", default: true },
    inDuration: { type: "number", label: "Slide time (s)", default: 0.8, min: 0.1, max: 4, step: 0.05 },
    exit: { type: "boolean", label: "Slide out at end", default: false },
    label: { type: "string", label: "Caption", default: "" },
    labelAlign: { type: "enum", label: "Caption align", default: "left", options: ["left", "center", "right"] },
    labelColor: { type: "color", label: "Caption color", default: "#D4D4D8" },
    fontFamily: { type: "font", label: "Caption font", default: "Inter" },
  },
  defaults: {
    ratio: "2.39",
    color: "#000000",
    animateIn: true,
    inDuration: 0.8,
    exit: false,
    label: "",
    labelAlign: "left",
    labelColor: "#D4D4D8",
    fontFamily: "Inter",
  },
  defaultDuration: 6,
  Component: Letterbox,
  tags: ["overlay", "cinematic", "film", "bars", "widescreen"],
});
