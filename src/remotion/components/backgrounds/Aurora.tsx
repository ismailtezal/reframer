import type React from "react";
import { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { mixColors, withAlpha } from "../../../core/color";
import { GRAIN_TILE_SIZE, getGrainTile } from "../grain";
import { lerp, random01 } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  background: string;
  color1: string;
  color2: string;
  color3: string;
  intensity: number;
  /** how far the curtains sway (0 = still) */
  speed: number;
  /** vertical position of the curtains' lower edge, 0 = top, 1 = bottom */
  position: number;
  /** curtain height, fraction of the box */
  curtainHeight: number;
  waviness: number;
  /** 0..1 vertical ray striations */
  rays: number;
  grain: number;
  seed: number;
};

const TAU = Math.PI * 2;

/** Smooth 1D value noise. */
const noise1 = (x: number, seed: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(random01(i * 1.618 + seed * 57.1), random01((i + 1) * 1.618 + seed * 57.1), u);
};

/**
 * Draws on a tiny canvas (1/4 width, 1/10 height) and lets the browser upscale it:
 * the anisotropic resolution keeps vertical rays while smearing the curtains
 * vertically, and the single blur pass on ~500×100 px costs next to nothing.
 */
const Aurora: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const clip = Math.max(1, p.durationInFrames);
  const cw = Math.max(48, Math.round(w / 4));
  const ch = Math.max(32, Math.round(h / 10));
  // Waves sway (phase oscillates) on ~10 s cycles, an integer number per clip: the clip
  // loops seamlessly and the apparent speed doesn't depend on the clip length.
  const cycles = Math.max(1, Math.round(clip / fps / 10));
  const period = clip / fps / cycles;
  const sway = 0.8 * p.speed * Math.min(1.5, period / 10);
  const theta = (frame / clip) * cycles * TAU;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (!scratchRef.current) scratchRef.current = document.createElement("canvas");
    const scratch = scratchRef.current;
    if (scratch.width !== cw || scratch.height !== ch) {
      scratch.width = cw;
      scratch.height = ch;
    }
    const sc = scratch.getContext("2d");
    if (!sc) return;
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.globalAlpha = 1;
    sc.clearRect(0, 0, cw, ch);
    sc.globalCompositeOperation = "lighter";
    const sx = cw / w;
    const sy = ch / h;
    const colors = [p.color1, p.color2, p.color3];
    const weights = [1, 0.72, 0.5];
    const offsets = [0.04, -0.03, -0.12];
    const heights = [0.55, 0.62, 0.85];

    for (let i = 0; i < 3; i++) {
      const r = (k: number) => random01(p.seed * 97.3 + i * 13.7 + k * 3.1);
      const color = colors[i];
      const top = i === 2 ? color : mixColors(color, p.color3, 0.55);
      const baseY = h * (p.position + offsets[i]);
      const amp = h * 0.11 * p.waviness * (0.7 + 0.6 * r(1));
      const thick = h * p.curtainHeight * heights[i] * (0.85 + 0.3 * r(2));
      // A shared diagonal sweep (rising to the right) reads more cinematic than a flat band.
      const tilt = -(0.1 + 0.12 * r(9)) * h * (i === 2 ? 0.6 : 1);
      const f1 = 0.7 + 0.8 * r(3);
      const f2 = 1.6 + 1.6 * r(4);
      const f3 = 2.2 + 2 * r(5);
      // Integer harmonics of the loop phase, so every sway closes at the clip end.
      const s1 = sway * Math.sin(theta * (1 + (i % 2)) + r(10) * TAU);
      const s2 = sway * 1.3 * Math.sin(theta * 2 + r(11) * TAU);
      const s3 = sway * Math.sin(theta + r(12) * TAU);
      const raySway = 2.2 * Math.sin(theta + i);
      const rayFlicker = 1.4 * Math.cos(theta * 2 + i);
      const grad = sc.createLinearGradient(0, 1, 0, 0);
      grad.addColorStop(0, withAlpha(color, 0));
      grad.addColorStop(0.08, withAlpha(color, 0.95));
      grad.addColorStop(0.3, withAlpha(color, 0.66));
      grad.addColorStop(0.56, withAlpha(mixColors(color, top, 0.55), 0.36));
      grad.addColorStop(0.8, withAlpha(top, 0.12));
      grad.addColorStop(1, withAlpha(top, 0));
      // Faint light scattered just below the lower edge, so it glows instead of cutting off.
      const under = sc.createLinearGradient(0, 0, 0, 1);
      under.addColorStop(0, withAlpha(color, 0.22));
      under.addColorStop(0.35, withAlpha(color, 0.07));
      under.addColorStop(1, withAlpha(color, 0));
      const underH = h * 0.07;
      const edge = (x: number) => {
        const u = (TAU * x) / w;
        return (
          baseY +
          tilt * (x / w - 0.5) +
          amp * (0.62 * Math.sin(u * f1 + r(6) * TAU + s1) + 0.38 * Math.sin(u * f2 + r(7) * TAU - s2)) +
          amp * 0.6 * (noise1((x / w) * 4.5 + s1 * 0.4, p.seed + i * 5 + 11) - 0.5)
        );
      };
      for (let cx = 0; cx < cw; cx++) {
        const x = (cx + 0.5) / sx;
        const u = (TAU * x) / w;
        const yb = edge(x);
        // Curtain folds: where the lower edge turns steeply we look along the sheet, so it glows brighter.
        const slope = Math.abs(edge(x + 4 / sx) - yb) / (4 / sx);
        const fold = 1 + 0.7 * Math.min(1, slope * 2.5);
        const tall = noise1((x / w) * 5 + s3 * 0.6, p.seed + i * 5 + 13) ** 1.3;
        const t = thick * (0.55 + 0.8 * tall) * (0.82 + 0.18 * Math.sin(u * f3 + r(8) * TAU + s3));
        // Vertical rays: noise across x that sways back and forth with the loop.
        const ray =
          0.65 * noise1(cx / 7 + raySway * p.speed, p.seed + i * 3 + 1) +
          0.35 * noise1(cx / 2.6 + rayFlicker * p.speed, p.seed + i * 3 + 2);
        sc.globalAlpha = Math.max(0, Math.min(1, p.intensity * weights[i] * fold * (1 - p.rays + p.rays * ray ** 1.6 * 1.5)));
        // Map the unit gradient onto this column: local y = 1 is the bright lower edge.
        sc.fillStyle = grad;
        sc.setTransform(1, 0, 0, t * sy, cx, (yb - t) * sy);
        sc.fillRect(0, 0, 1.6, 1);
        sc.fillStyle = under;
        sc.setTransform(1, 0, 0, underH * sy, cx, (yb - underH * 0.15) * sy);
        sc.fillRect(0, 0, 1.6, 1);
      }
    }
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.globalAlpha = 1;
    sc.globalCompositeOperation = "source-over";

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.filter = "blur(2.5px)";
    ctx.drawImage(scratch, 0, 0);
    ctx.filter = "none";
  });

  const sky = mixColors(p.background, p.color2, 0.06);
  const glowY = Math.round(Math.max(0, Math.min(1, p.position - 0.1)) * 100);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: p.background,
        backgroundImage: [
          `radial-gradient(ellipse 70% 40% at 50% ${glowY}%, ${withAlpha(p.color1, 0.07 * p.intensity)} 0%, ${withAlpha(p.color1, 0)} 100%)`,
          `linear-gradient(180deg, ${p.background} 0%, ${sky} 55%, ${p.background} 100%)`,
        ].join(", "),
      }}
    >
      <canvas
        ref={canvasRef}
        width={cw}
        height={ch}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", mixBlendMode: "screen" }}
      />
      {p.grain > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${getGrainTile(frame)})`,
            backgroundSize: `${Math.round(GRAIN_TILE_SIZE * Math.max(1, unit))}px`,
            opacity: p.grain * 0.16,
            mixBlendMode: "overlay",
          }}
        />
      ) : null}
    </div>
  );
};

export const aurora = defineMotionComponent<Props>({
  id: "aurora",
  name: "Aurora",
  category: "background",
  description:
    "Flowing northern-lights curtains with soft vertical rays over a night sky; loops seamlessly. Use as a cinematic, calm backdrop for intros, music, travel or 'night' themes — keep text above or below the curtains.",
  schema: {
    background: { type: "color", label: "Sky", default: "#03050B" },
    color1: { type: "color", label: "Color 1", default: "#2DF5A8" },
    color2: { type: "color", label: "Color 2", default: "#17C3D6" },
    color3: { type: "color", label: "Upper fringe", default: "#8B7BFF" },
    intensity: { type: "number", label: "Intensity", default: 0.68, min: 0, max: 1, step: 0.05 },
    speed: { type: "number", label: "Motion", default: 1, min: 0, max: 3, step: 0.1 },
    position: { type: "number", label: "Position", default: 0.62, min: 0.1, max: 1, step: 0.01 },
    curtainHeight: { type: "number", label: "Curtain height", default: 0.5, min: 0.1, max: 1, step: 0.01 },
    waviness: { type: "number", label: "Waviness", default: 0.6, min: 0, max: 1, step: 0.05 },
    rays: { type: "number", label: "Rays", default: 0.55, min: 0, max: 1, step: 0.05 },
    grain: { type: "number", label: "Grain", default: 0.35, min: 0, max: 1, step: 0.05 },
    seed: { type: "number", label: "Seed", default: 0, min: 0, max: 100, step: 1 },
  },
  defaults: {
    background: "#03050B",
    color1: "#2DF5A8",
    color2: "#17C3D6",
    color3: "#8B7BFF",
    intensity: 0.68,
    speed: 1,
    position: 0.62,
    curtainHeight: 0.5,
    waviness: 0.6,
    rays: 0.55,
    grain: 0.35,
    seed: 0,
  },
  defaultDuration: 8,
  Component: Aurora,
  tags: ["background", "aurora", "northern lights", "night", "cinematic", "loop"],
});
