import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { progress, random01 } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";
import { brushPath, type Pt, sliceStroke, smoothstep, wobble } from "./brush";

type Props = {
  color: string;
  /** px at 1080p */
  strokeWidth: number;
  /** How far the loop goes around; >1 overshoots past the start like a real hand. */
  turns: number;
  roughness: number;
  /** Where the pen lands, degrees (0 = right, -90 = top). */
  startAngle: number;
  delay: number;
  drawDuration: number;
  opacity: number;
  seed: number;
  exit: boolean;
};

const CircleHighlight: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  // Timeline in 30 fps frames so the draw speed is the same at any frame rate.
  const t = (frame * 30) / fps;
  const last = ((p.durationInFrames - 1) * 30) / fps;
  const w = p.width;
  const h = p.height;
  const sw = Math.max(1, p.strokeWidth * unit);
  const rough = p.roughness;
  const turns = Math.max(0.3, p.turns);

  // A loop with a wobbling radius that drifts outward, so the overshoot doesn't retrace the start.
  const n = Math.round(150 * turns);
  const tilt = ((-4 + 8 * (random01(p.seed + 3) - 0.5)) * rough * Math.PI) / 180;
  const a0 = (p.startAngle * Math.PI) / 180;
  const raw: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const phi = (i / n) * turns;
    const th = a0 - phi * Math.PI * 2;
    const r = 1 + rough * 0.035 * wobble(th, p.seed);
    let x = Math.cos(th) * r * (w / 2);
    let y = Math.sin(th) * r * (h / 2);
    // The pen drifts outward as it comes round (in stroke widths, so it shows at any size).
    const d = Math.hypot(x, y) || 1;
    const push = sw * rough * (2.6 * smoothstep(0.65, Math.max(0.7, turns), phi) - 0.5);
    x += (x / d) * push;
    y += (y / d) * push;
    raw.push({ x: x * Math.cos(tilt) - y * Math.sin(tilt), y: x * Math.sin(tilt) + y * Math.cos(tilt) });
  }
  // Fit the drawing inside the box (stroke included): the box is the area being circled.
  const margin = sw / 2 + 2;
  const maxX = Math.max(...raw.map((q) => Math.abs(q.x))) || 1;
  const maxY = Math.max(...raw.map((q) => Math.abs(q.y))) || 1;
  const kx = Math.max(0, w / 2 - margin) / maxX;
  const ky = Math.max(0, h / 2 - margin) / maxY;
  const pts = raw.map((q) => ({ x: w / 2 + q.x * kx, y: h / 2 + q.y * ky }));

  // Pen pressure: light landing, full body, lifted tail.
  const width = (u: number) =>
    sw * (0.42 + 0.58 * smoothstep(0, 0.07, u)) * (1 - 0.5 * smoothstep(0.8, 1, u)) * (1 + 0.12 * rough * wobble(u * 11, p.seed + 7));
  const drawn = progress(t, p.delay, p.drawDuration, "ease-in-out");
  // Exit: the stroke retracts along its own path.
  const e = p.exit ? progress(t, last - 12, 12, "ease-in") : 0;
  const d = brushPath(sliceStroke(pts, e, drawn), width);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <path d={d} fill={p.color} opacity={p.opacity} />
    </svg>
  );
};

export const circleHighlight = defineMotionComponent<Props>({
  id: "circle-highlight",
  name: "Circle highlight",
  category: "annotation",
  description:
    "Rough marker loop that draws itself around a region, with pen-pressure taper and a slight overshoot. The box is the area that gets circled: place and size it over the word, face or UI element to call out.",
  schema: {
    color: { type: "color", label: "Color", default: "#FF453A" },
    strokeWidth: { type: "number", label: "Stroke", default: 10, min: 2, max: 40, step: 0.5, description: "px at 1080p" },
    turns: { type: "number", label: "Turns", default: 1.15, min: 0.6, max: 2.5, step: 0.05 },
    roughness: { type: "number", label: "Hand-drawn", default: 0.65, min: 0, max: 1, step: 0.05 },
    startAngle: { type: "number", label: "Start angle", default: -50, min: -180, max: 180, step: 1 },
    delay: { type: "number", label: "Delay (frames)", default: 4, min: 0, max: 120, step: 1 },
    drawDuration: { type: "number", label: "Draw time (frames)", default: 22, min: 4, max: 90, step: 1 },
    opacity: { type: "number", label: "Opacity", default: 0.95, min: 0.1, max: 1, step: 0.01 },
    seed: { type: "number", label: "Seed", default: 7, min: 0, max: 100, step: 1 },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    color: "#FF453A",
    strokeWidth: 10,
    turns: 1.15,
    roughness: 0.65,
    startAngle: -50,
    delay: 4,
    drawDuration: 22,
    opacity: 0.95,
    seed: 7,
    exit: true,
  },
  defaultDuration: 3,
  defaultBox: { x: 0.5, y: 0.5, width: 0.3, height: 0.22 },
  Component: CircleHighlight,
  tags: ["circle", "annotation", "highlight", "marker", "hand-drawn"],
});
