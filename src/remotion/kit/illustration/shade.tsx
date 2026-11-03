import type React from "react";
import { useId } from "react";
import { sceneLightDir, useSceneLight } from "./light-context";

/**
 * Illustration shading: the flat-vector look where every shape has a soft shadow crescent on the side
 * away from the light and a thin rim of light on the lit side, instead of a flat fill.
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const hexToHsl = (hex: string): [number, number, number] | null => {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const n = Number.parseInt(h, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, s, l];
};

const hslToHex = (h: number, s: number, l: number) => {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)]
    .map((x) =>
      Math.round(clamp01(x) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

/**
 * A related color: `light` −1…1 darkens/lightens, `hue` shifts in degrees, `sat` −1…1. Shadows look
 * best shifted toward blue/violet (tone(c, -0.25, 12)) rather than just darker; light toward warm.
 */
export const tone = (hex: string, light = 0, hue = 0, sat = 0) => {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  const [h, s, l] = hsl;
  const nl = light >= 0 ? l + (1 - l) * light : l * (1 + light);
  const ns = sat >= 0 ? s + (1 - s) * sat : s * (1 + sat);
  return hslToHex((((h + hue) % 360) + 360) % 360, clamp01(ns), clamp01(nl));
};

/** Mixes two hex colors (t = 0 → a, 1 → b): atmospheric perspective, tinting toward a sky. */
export const mix = (a: string, b: string, t: number) => {
  const pa = hexToHsl(a);
  const pb = hexToHsl(b);
  if (!pa || !pb) return t < 0.5 ? a : b;
  const toRgb = (hex: string) => {
    const h = hex.replace("#", "");
    const v = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
    const n = Number.parseInt(v, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const ca = toRgb(a);
  const cb = toRgb(b);
  return `#${ca
    .map((c, i) =>
      Math.round(c + (cb[i] - c) * clamp01(t))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

export type ShadeProps = {
  /** Direction the light comes from (default up-left). */
  light?: { x: number; y: number };
  /** Width of the shadow crescent in px (≈ 6–10% of the object's size). */
  depth?: number;
  /** Width of the lit rim in px (≈ 2–4% of the object's size). 0 = none. */
  rim?: number;
  /** Shadow color (default a deep violet, which reads richer than black). */
  shadow?: string;
  shadowOpacity?: number;
  highlight?: string;
  highlightOpacity?: number;
  /** Blur of the crescents in px (0 = crisp vector edges). */
  soft?: number;
  children?: React.ReactNode;
};

/**
 * Wrap SVG shapes in <Shade> to shade their combined silhouette: shadow crescent away from the light,
 * a rim of light toward it. Works on any fill color. Use it inside an <svg>.
 */
export const Shade: React.FC<ShadeProps> = ({
  light: ownLight,
  depth = 10,
  rim = 3,
  shadow: ownShadow,
  shadowOpacity = 0.32,
  highlight: ownHighlight,
  highlightOpacity = 0.32,
  soft = 0,
  children,
}) => {
  const id = `kz-shade-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  // Inside a <SceneLight> the light's side, the ambient shadow and the light's color are the defaults.
  const scene = useSceneLight();
  const light = ownLight ?? sceneLightDir(scene);
  const shadow = ownShadow ?? (scene ? tone(scene.ambient, -0.45) : "#1b0f4a");
  const highlight = ownHighlight ?? (scene ? scene.light : "#ffffff");
  const len = Math.hypot(light.x, light.y) || 1;
  const lx = light.x / len;
  const ly = light.y / len;
  return (
    <>
      <defs>
        <filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          {/* Shadow: the silhouette minus itself shifted toward the light = the far-side crescent. */}
          <feOffset in="SourceAlpha" dx={lx * depth} dy={ly * depth} result="toLight" />
          <feComposite in="SourceAlpha" in2="toLight" operator="out" result="far" />
          {soft > 0 ? <feGaussianBlur in="far" stdDeviation={soft} result="farSoft" /> : null}
          <feComposite in={soft > 0 ? "farSoft" : "far"} in2="SourceAlpha" operator="in" result="farIn" />
          <feFlood floodColor={shadow} floodOpacity={shadowOpacity} />
          <feComposite in2="farIn" operator="in" result="shadow" />
          {rim > 0 ? (
            <>
              <feOffset in="SourceAlpha" dx={-lx * rim} dy={-ly * rim} result="fromLight" />
              <feComposite in="SourceAlpha" in2="fromLight" operator="out" result="near" />
              <feFlood floodColor={highlight} floodOpacity={highlightOpacity} />
              <feComposite in2="near" operator="in" result="rimLight" />
            </>
          ) : null}
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="shadow" />
            {rim > 0 ? <feMergeNode in="rimLight" /> : null}
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${id})`}>{children}</g>
    </>
  );
};
