import type React from "react";
import { useId } from "react";
import type { BackgroundClip, Fill } from "../../core/schema";

/** CSS for solid / linear fills (supported by every renderer). */
export const fillToCss = (fill: Fill | undefined): string | undefined => {
  if (!fill) return undefined;
  if (fill.type === "solid") return fill.color;
  if (fill.type === "linear") {
    const stops = fill.stops.map((s) => `${s.color} ${(s.pos * 100).toFixed(1)}%`).join(", ");
    return `linear-gradient(${fill.angle}deg, ${stops})`;
  }
  return undefined;
};

/** SVG gradient definition for any fill (radial gradients render via SVG for renderer support). */
export const SvgFillDef: React.FC<{ id: string; fill: Fill }> = ({ id, fill }) => {
  if (fill.type === "radial") {
    return (
      <radialGradient id={id} cx={fill.cx} cy={fill.cy} r="0.75">
        {fill.stops.map((s) => (
          <stop key={`${s.pos}-${s.color}`} offset={s.pos} stopColor={s.color} />
        ))}
      </radialGradient>
    );
  }
  if (fill.type === "linear") {
    // CSS angle → SVG vector (0deg = upwards).
    const rad = ((fill.angle - 90) * Math.PI) / 180;
    const x = Math.cos(rad) / 2;
    const y = Math.sin(rad) / 2;
    return (
      <linearGradient id={id} x1={0.5 - x} y1={0.5 - y} x2={0.5 + x} y2={0.5 + y}>
        {fill.stops.map((s) => (
          <stop key={`${s.pos}-${s.color}`} offset={s.pos} stopColor={s.color} />
        ))}
      </linearGradient>
    );
  }
  return null;
};

export const BackgroundContent: React.FC<{ clip: BackgroundClip; box: { width: number; height: number } }> = ({ clip, box }) => {
  const id = useId().replace(/:/g, "");
  if (clip.fill.type === "radial") {
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${box.width} ${box.height}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <SvgFillDef id={`bg${id}`} fill={clip.fill} />
        </defs>
        <rect width={box.width} height={box.height} fill={`url(#bg${id})`} />
      </svg>
    );
  }
  return <div style={{ width: "100%", height: "100%", background: fillToCss(clip.fill) }} />;
};
