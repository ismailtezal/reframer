import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { KIT_GRAIN_TILE, kitGrainTile } from "./grain";
import { rgba } from "./shared";

export type LightStageProps = {
  /** dark: a product on a black stage under a soft key light (Apple keynote). light: Apple's white
   * room. color: saturated light blooms (launch-day color stories). */
  variant?: "dark" | "light" | "color";
  /** Tint of the glow around the key light (dark/light) or the main bloom (color). */
  accent?: string;
  /** Second bloom color for `color`. */
  accent2?: string;
  /** Key light position as 0–1 of the frame. */
  light?: { x: number; y: number };
  /** 0–1, default 1. */
  intensity?: number;
  /** Horizon of a soft reflective floor, 0–1 from the top (e.g. 0.72); null = no floor. */
  floor?: number | null;
  /** Film grain, 0–1 (default 0.35); keeps gradients from banding. */
  grain?: number;
  /** Slow light drift so the frame never holds dead still. Default true. */
  drift?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

/**
 * A lit stage instead of a flat background: soft key light, a halo in the accent color, an
 * optional reflective floor, vignette and fine grain. Put devices, type and UI inside it.
 */
export const LightStage: React.FC<LightStageProps> = ({
  variant = "dark",
  accent = "#5b8cff",
  accent2 = "#ff5bb0",
  light = { x: 0.5, y: 0.42 },
  intensity = 1,
  floor = null,
  grain = 0.35,
  drift = true,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const dx = drift ? Math.sin(frame / 140) * 1.6 : 0;
  const dy = drift ? Math.cos(frame / 170) * 1.1 : 0;
  const lx = light.x * 100 + dx;
  const ly = light.y * 100 + dy;
  const I = intensity;
  const dark = variant !== "light";

  const layers: string[] = [];
  if (variant === "dark") {
    // A designed key light, not a blob: a soft beam from above, a bright core with a long smooth
    // falloff, and the accent as a wide saturated halo (kept clean so warm colors don't go brown).
    layers.push(
      `radial-gradient(ellipse 26% 20% at ${lx}% ${ly}%, ${rgba("#ffffff", 0.16 * I)} 0%, ${rgba("#ffffff", 0.05 * I)} 50%, transparent 100%)`,
      `radial-gradient(ellipse 52% 40% at ${lx}% ${ly + 4}%, ${rgba(accent, 0.2 * I)} 0%, ${rgba(accent, 0.07 * I)} 45%, ${rgba(accent, 0.02 * I)} 75%, transparent 100%)`,
      `radial-gradient(ellipse 95% 75% at ${lx}% ${ly + 10}%, ${rgba(accent, 0.07 * I)} 0%, transparent 80%)`,
      `radial-gradient(ellipse 120% 90% at 50% 45%, #0b0b0e 0%, #000 70%)`,
    );
  } else if (variant === "light") {
    layers.push(
      `radial-gradient(ellipse 55% 45% at ${lx}% ${ly}%, #ffffff 0%, rgba(255,255,255,0.6) 40%, transparent 75%)`,
      `radial-gradient(ellipse 70% 55% at ${lx}% ${ly + 10}%, ${rgba(accent, 0.1 * I)} 0%, transparent 70%)`,
      `linear-gradient(180deg, #fbfbfd 0%, #f2f2f5 60%, #e8e8ed 100%)`,
    );
  } else {
    layers.push(
      `radial-gradient(ellipse 30% 26% at ${lx}% ${ly}%, ${rgba("#ffffff", 0.16 * I)} 0%, transparent 100%)`,
      `radial-gradient(ellipse 120% 85% at ${lx}% ${ly}%, ${rgba(accent, 0.18 * I)} 0%, transparent 70%)`,
      "linear-gradient(180deg, #06060a 0%, #040406 100%)",
    );
  }

  // Color: two saturated light sweeps on their own softened layer, slowly turning.
  const sweep =
    variant === "color" ? (
      <div
        style={{
          position: "absolute",
          inset: "-25%",
          background: `conic-gradient(from ${200 + Math.sin(frame / 90) * 10}deg at ${lx}% ${ly + 12}%, ${rgba(accent, 0)} 0deg, ${rgba(accent, 0.6 * I)} 70deg, ${rgba(accent2, 0.62 * I)} 150deg, ${rgba(accent2, 0)} 225deg, ${rgba(accent, 0)} 360deg)`,
          filter: "blur(70px)",
        }}
      />
    ) : null;

  return (
    <AbsoluteFill style={{ background: layers.join(", "), overflow: "hidden", ...style }}>
      {sweep}
      {floor !== null && floor !== undefined ? (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          {/* The floor: darker below the horizon, a faint horizon line, and a pool of light under the key. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${floor * 100}%`,
              bottom: 0,
              background: dark
                ? `linear-gradient(180deg, ${rgba("#ffffff", 0.035 * I)} 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0.85) 100%)`
                : "linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.0) 40%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "8%",
              right: "8%",
              top: `${floor * 100}%`,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${rgba(dark ? "#ffffff" : "#000000", dark ? 0.12 * I : 0.08)}, transparent)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${lx - 22}%`,
              width: "44%",
              top: `${floor * 100 - 2}%`,
              height: "12%",
              background: `radial-gradient(ellipse 50% 40% at 50% 30%, ${rgba(dark ? accent : "#000000", dark ? 0.16 * I : 0.06)} 0%, transparent 70%)`,
            }}
          />
        </AbsoluteFill>
      ) : null}
      {children}
      {/* Vignette, then grain on top of everything. */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: dark
            ? "radial-gradient(ellipse 85% 80% at 50% 48%, transparent 55%, rgba(0,0,0,0.6) 100%)"
            : "radial-gradient(ellipse 85% 80% at 50% 48%, transparent 60%, rgba(0,0,0,0.07) 100%)",
        }}
      />
      {grain > 0 ? (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            backgroundImage: `url(${kitGrainTile(frame)})`,
            backgroundSize: `${KIT_GRAIN_TILE}px ${KIT_GRAIN_TILE}px`,
            opacity: 0.12 * grain,
            mixBlendMode: "overlay",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
