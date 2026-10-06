import type React from "react";
import { useId } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { resolveEasing } from "../../../core/easing";
import { lerp, progress } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  /** Start and end points, 0..1 of the box. */
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Sideways bow of the path, -1..1. */
  arc: number;
  /** Seconds */
  moveStart: number;
  moveDuration: number;
  /** Cursor height in px at 1080p. */
  size: number;
  pressScale: boolean;
  ripple: boolean;
  rippleColor: string;
  cursorColor: string;
  outlineColor: string;
  exit: boolean;
};

/** macOS-style arrow, tip at (0, 0) in a 20-unit-tall drawing. */
const ARROW = "M0 0L0 15.5L3.6 12.1L6.2 18.2L8.7 17.1L6.15 11L11.1 11Z";
/** viewBox padding around the arrow (outline + shadow). */
const PAD = 3;

/**
 * Pointer graphic whose hotspot (the arrow tip) sits at `x`, `y`. `height` is in px;
 * `press` (0..1) squashes it slightly toward the tip.
 */
export const CursorArrow: React.FC<{
  x: number;
  y: number;
  height: number;
  fill: string;
  outline: string;
  press?: number;
  opacity?: number;
}> = ({ x, y, height, fill, outline, press = 0, opacity = 1 }) => {
  const id = useId().replace(/:/g, "");
  const k = height / 20;
  return (
    <svg
      width={18 * k}
      height={25 * k}
      viewBox={`${-PAD} ${-PAD} 18 25`}
      style={{
        position: "absolute",
        left: x - PAD * k,
        top: y - PAD * k,
        display: "block",
        opacity,
        transformOrigin: `${PAD * k}px ${PAD * k}px`,
        transform: `scale(${1 - 0.14 * press})`,
      }}
    >
      <defs>
        <filter id={`c${id}`} x="-40%" y="-30%" width="180%" height="160%">
          <feDropShadow dx="0" dy="0.9" stdDeviation="0.9" floodColor="#000000" floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter={`url(#c${id})`}>
        <path d={ARROW} fill={outline} stroke={outline} strokeWidth={2.6} strokeLinejoin="round" />
        <path d={ARROW} fill={fill} />
      </g>
    </svg>
  );
};

const glide = resolveEasing({ type: "bezier", x1: 0.55, y1: 0, x2: 0.15, y2: 1 });

const CursorClick: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  // Timeline in 30 fps frames.
  const t = (frame * 30) / fps;
  const last = ((p.durationInFrames - 1) * 30) / fps;
  const a = { x: p.fromX * p.width, y: p.fromY * p.height };
  const b = { x: p.toX * p.width, y: p.toY * p.height };
  const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const bow = p.arc * dist * 0.35;
  const c = { x: (a.x + b.x) / 2 - ((b.y - a.y) / dist) * bow, y: (a.y + b.y) / 2 + ((b.x - a.x) / dist) * bow };

  const start = p.moveStart * 30;
  const dur = Math.max(1, p.moveDuration * 30);
  // Quick start, long settle into the target, like a real hand on a trackpad.
  const m = glide(Math.min(1, Math.max(0, (t - start) / dur)));
  const pos = {
    x: (1 - m) ** 2 * a.x + 2 * (1 - m) * m * c.x + m * m * b.x,
    y: (1 - m) ** 2 * a.y + 2 * (1 - m) * m * c.y + m * m * b.y,
  };
  const click = start + dur + 2;
  const press = p.pressScale ? progress(t, click, 3, "ease-out") * (1 - progress(t, click + 3, 8, "smooth")) : 0;
  const appear = progress(t, 0, 8, "smooth");
  const e = p.exit ? progress(t, last - 10, 10, "ease-in") : 0;

  const size = p.size * unit;
  const rippleMax = size * 1.15;
  const ring = (delay: number, strength: number) => {
    const q = progress(t, click + delay, 20, "smooth");
    if (t < click + delay || q >= 1) return null;
    return (
      <circle
        cx={rippleMax + 4}
        cy={rippleMax + 4}
        r={lerp(size * 0.12, rippleMax, q)}
        fill="none"
        stroke={p.rippleColor}
        strokeWidth={lerp(size * 0.07, size * 0.015, q)}
        opacity={(1 - q) * strength}
      />
    );
  };
  const disc = progress(t, click, 14, "smooth");

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {p.ripple && t >= click ? (
        <svg
          width={(rippleMax + 4) * 2}
          height={(rippleMax + 4) * 2}
          style={{ position: "absolute", left: b.x - rippleMax - 4, top: b.y - rippleMax - 4, display: "block", opacity: 1 - e }}
        >
          {disc < 1 ? (
            <circle
              cx={rippleMax + 4}
              cy={rippleMax + 4}
              r={lerp(size * 0.1, size * 0.62, disc)}
              fill={p.rippleColor}
              opacity={0.3 * (1 - disc)}
            />
          ) : null}
          {ring(1, 0.9)}
          {ring(6, 0.45)}
        </svg>
      ) : null}
      <CursorArrow
        x={pos.x}
        y={pos.y}
        height={size * lerp(0.9, 1, appear)}
        fill={p.cursorColor}
        outline={p.outlineColor}
        press={press}
        opacity={appear * (1 - e)}
      />
    </div>
  );
};

export const cursorClick = defineMotionComponent<Props>({
  id: "cursor-click",
  name: "Cursor click",
  category: "annotation",
  description:
    "macOS-style pointer that glides along a gentle curve from A to B, presses and clicks with a ripple. Coordinates are 0..1 of the box (full frame by default). Use over screen recordings and product UI to show where to click.",
  schema: {
    fromX: { type: "number", label: "From X", default: 0.3, min: 0, max: 1, step: 0.01 },
    fromY: { type: "number", label: "From Y", default: 0.72, min: 0, max: 1, step: 0.01 },
    toX: { type: "number", label: "To X", default: 0.62, min: 0, max: 1, step: 0.01 },
    toY: { type: "number", label: "To Y", default: 0.44, min: 0, max: 1, step: 0.01 },
    arc: { type: "number", label: "Arc", default: 0.25, min: -1, max: 1, step: 0.01 },
    moveStart: { type: "number", label: "Move at (s)", default: 0.35, min: 0, max: 20, step: 0.05 },
    moveDuration: { type: "number", label: "Move time (s)", default: 0.9, min: 0.1, max: 10, step: 0.05 },
    size: { type: "number", label: "Size", default: 56, min: 16, max: 200, step: 1, description: "Cursor height in px at 1080p" },
    pressScale: { type: "boolean", label: "Press", default: true },
    ripple: { type: "boolean", label: "Ripple", default: true },
    rippleColor: { type: "color", label: "Ripple color", default: "#0A84FF" },
    cursorColor: { type: "color", label: "Cursor", default: "#0A0A0A" },
    outlineColor: { type: "color", label: "Outline", default: "#FFFFFF" },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    fromX: 0.3,
    fromY: 0.72,
    toX: 0.62,
    toY: 0.44,
    arc: 0.25,
    moveStart: 0.35,
    moveDuration: 0.9,
    size: 56,
    pressScale: true,
    ripple: true,
    rippleColor: "#0A84FF",
    cursorColor: "#0A0A0A",
    outlineColor: "#FFFFFF",
    exit: true,
  },
  defaultDuration: 3,
  Component: CursorClick,
  tags: ["cursor", "click", "mouse", "pointer", "demo", "saas", "tutorial"],
});
