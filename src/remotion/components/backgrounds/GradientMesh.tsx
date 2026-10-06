import type React from "react";
import { useId } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { getGrainTile } from "../grain";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  background: string;
  color1: string;
  color2: string;
  color3: string;
  color4: string;
  /** cycles per 10 seconds */
  speed: number;
  /** 0..1 — how far each blob's light spreads */
  softness: number;
  grain: number;
  seed: number;
};

const GradientMesh: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const id = useId().replace(/:/g, "");
  const w = p.width;
  const h = p.height;
  const t = (frame / fps / 10) * p.speed * Math.PI * 2;
  const colors = [p.color1, p.color2, p.color3, p.color4];
  const reach = 0.42 + 0.22 * p.softness;
  const blobs = colors.map((color, i) => {
    const a = i * 1.7 + p.seed;
    return {
      color,
      i,
      cx: w * (0.5 + 0.34 * Math.sin(t * (0.6 + i * 0.13) + a)),
      cy: h * (0.5 + 0.32 * Math.cos(t * (0.5 + i * 0.11) + a * 1.3)),
      r: Math.max(w, h) * (reach + 0.06 * Math.sin(t * 0.7 + i)),
    };
  });

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", backgroundColor: p.background }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ display: "block", position: "absolute", inset: 0 }}
      >
        <defs>
          {blobs.map((b) => (
            // Soft multi-stop falloff gives the "mesh" look without an expensive blur pass.
            <radialGradient key={b.i} id={`m${id}${b.i}`}>
              <stop offset="0" stopColor={b.color} stopOpacity="0.9" />
              <stop offset="0.35" stopColor={b.color} stopOpacity="0.55" />
              <stop offset="0.7" stopColor={b.color} stopOpacity="0.16" />
              <stop offset="1" stopColor={b.color} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>
        {blobs.map((b) => (
          <circle key={b.i} cx={b.cx} cy={b.cy} r={b.r} fill={`url(#m${id}${b.i})`} />
        ))}
      </svg>
      {p.grain > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${getGrainTile(frame)})`,
            backgroundSize: `${Math.round(192 * Math.max(1, Math.min(w, h) / 1080))}px`,
            opacity: p.grain * 0.16,
            mixBlendMode: "overlay",
          }}
        />
      ) : null}
    </div>
  );
};

export const gradientMesh = defineMotionComponent<Props>({
  id: "gradient-mesh",
  name: "Gradient mesh",
  category: "background",
  description:
    "Slowly drifting multi-color gradient blobs with optional film grain. Premium backdrop for titles, launches and quotes. Use brand colors; keep speed low (0.3-1).",
  schema: {
    background: { type: "color", label: "Base", default: "#0B0B12" },
    color1: { type: "color", label: "Color 1", default: "#7C3AED" },
    color2: { type: "color", label: "Color 2", default: "#2563EB" },
    color3: { type: "color", label: "Color 3", default: "#DB2777" },
    color4: { type: "color", label: "Color 4", default: "#0EA5E9" },
    speed: { type: "number", label: "Speed", default: 0.6, min: 0, max: 4, step: 0.05 },
    softness: { type: "number", label: "Softness", default: 0.8, min: 0, max: 1, step: 0.05 },
    grain: { type: "number", label: "Grain", default: 0.4, min: 0, max: 1, step: 0.05 },
    seed: { type: "number", label: "Seed", default: 0, min: 0, max: 100, step: 1 },
  },
  defaults: {
    background: "#0B0B12",
    color1: "#7C3AED",
    color2: "#2563EB",
    color3: "#DB2777",
    color4: "#0EA5E9",
    speed: 0.6,
    softness: 0.8,
    grain: 0.4,
    seed: 0,
  },
  defaultDuration: 6,
  Component: GradientMesh,
  tags: ["background", "gradient", "launch", "premium"],
});
