import { getLength, getPointAtLength } from "@remotion/paths";
import type React from "react";
import { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { random01 } from "../../components/helpers";
import { useClipBox } from "../../context";

export type FlowProps = {
  /** SVG path the particles travel along, in px of the clip box (e.g. "M 200 900 C 600 700 900 500 1400 300"). */
  d: string;
  /** Particles on the path at once. */
  count?: number;
  /** Travel speed in px per second. */
  speed?: number;
  /** Particle radius in px (≥ 6 so it reads at 1080p). */
  size?: number;
  color?: string;
  /** A soft tail behind each particle. Default true. */
  trail?: boolean;
  /** Draw the path itself faintly (a channel, a vein, a wire). */
  guide?: string | null;
  /** Frames into the clip when the flow starts entering from the path's start. */
  start?: number;
  /** 0–1 random spread of spacing and size, so the stream isn't a conveyor belt. */
  jitter?: number;
  seed?: number;
};

/**
 * Things moving along a path — water up a trunk, CO₂ into a leaf, money between accounts, data down a
 * wire — so a mechanism is shown as cause and effect instead of told. Particles enter from the start of
 * the path, never all at once, with uneven spacing.
 */
export const Flow: React.FC<FlowProps> = ({
  d,
  count = 14,
  speed = 220,
  size = 9,
  color = "#7fe3ff",
  trail = true,
  guide = null,
  start = 0,
  jitter = 0.5,
  seed = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const box = useClipBox();
  const length = useMemo(() => getLength(d), [d]);
  const t = Math.max(0, frame - start) / fps;
  const travelled = t * speed;
  const particles: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const spacing = length / count;
    // Particle i starts at the path's start after an uneven delay, then loops.
    const offset = i * spacing + (random01(seed * 97 + i) - 0.5) * spacing * jitter;
    const pos = travelled - offset;
    if (pos < 0) continue;
    const along = pos % length;
    const r = size * (1 - jitter * 0.4 + random01(seed * 31 + i) * jitter * 0.8);
    const fadeIn = Math.min(1, along / (length * 0.06));
    const fadeOut = Math.min(1, (length - along) / (length * 0.06));
    const a = Math.min(fadeIn, fadeOut);
    const p = getPointAtLength(d, along);
    if (trail) {
      for (let k = 1; k <= 3; k++) {
        const back = along - k * r * 1.4;
        if (back <= 0) break;
        const q = getPointAtLength(d, back);
        if (!q) break;
        particles.push(<circle key={`${i}-t${k}`} cx={q.x} cy={q.y} r={r * (1 - k * 0.22)} fill={color} opacity={a * (0.35 - k * 0.09)} />);
      }
    }
    if (p) particles.push(<circle key={i} cx={p.x} cy={p.y} r={r} fill={color} opacity={a} />);
  }
  return (
    <svg
      width={box.width}
      height={box.height}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
    >
      {guide ? <path d={d} fill="none" stroke={guide} strokeWidth={size * 2.6} strokeLinecap="round" opacity={0.35} /> : null}
      {particles}
    </svg>
  );
};
