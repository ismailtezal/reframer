import type React from "react";
import { useId, useState } from "react";
import { Img, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { lerp, progress } from "../helpers";
import { useAssetSrc } from "../media";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  color: string;
  intensity: number;
  /** band width, fraction of the box diagonal */
  bandWidth: number;
  /** degrees the band leans from vertical */
  angle: number;
  /** 0 = crisp plateau, 1 = soft Gaussian */
  softness: number;
  /** seconds */
  sweepDuration: number;
  /** seconds before the first sweep */
  delay: number;
  /** seconds between sweeps, 0 = once */
  repeatEvery: number;
  /** Optional image whose alpha limits the shine (use the same logo/card image underneath). */
  mask: string;
  /** px at 1080p — rounded-corner clip when no mask is set */
  radius: number;
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Gradient vector for a light band crossing a w×h box along `angleDeg`
 * (0 = travelling right). `t` 0 → 1 moves the band centre from fully before the
 * box to fully past it; `travel` is the widest layer (layers sharing it stay aligned).
 */
export const sweepBand = (w: number, h: number, angleDeg: number, t: number, band: number, travel = band) => {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const proj = [0, w * dx, h * dy, w * dx + h * dy];
  const lo = Math.min(...proj) - travel / 2;
  const hi = Math.max(...proj) + travel / 2;
  const s = lo + (hi - lo) * t;
  return { x1: dx * (s - band / 2), y1: dy * (s - band / 2), x2: dx * (s + band / 2), y2: dy * (s + band / 2) };
};

const OFFSETS = [0, 0.15, 0.3, 0.42, 0.5, 0.58, 0.7, 0.85, 1];
const HARD = [0, 0, 0.15, 1, 1, 1, 0.15, 0, 0];
const SOFT = [0, 0.08, 0.35, 0.78, 1, 0.78, 0.35, 0.08, 0];

/** Stops (offset, opacity) for a band profile between crisp and soft. */
export const bandStops = (softness: number, peak: number): [number, number][] =>
  OFFSETS.map((o, i) => [o, lerp(HARD[i], SOFT[i], Math.max(0, Math.min(1, softness))) * peak]);

const aspectCache = new Map<string, number>();

/**
 * Natural aspect ratio (w / h) of an image URL, measured once and cached; holds
 * the render until it is known. SVG `<image>` masks are drawn into this exact
 * rectangle so they line up with `object-fit: contain` media (even SVGs without
 * a viewBox, which `preserveAspectRatio` would otherwise stretch).
 */
export const useImageAspect = (src: string | null): number | null => {
  const { delayRender, continueRender } = useDelayRender();
  const [, setTick] = useState(0);
  const [requested] = useState(() => new Set<string>());
  if (src && !aspectCache.has(src) && !requested.has(src) && typeof Image !== "undefined") {
    requested.add(src);
    const handle = delayRender(`Measuring image ${src.slice(0, 48)}`, { timeoutInMilliseconds: 20000 });
    const img = new Image();
    const done = (aspect: number) => {
      aspectCache.set(src, aspect);
      setTick((n) => n + 1);
      // Let React commit the re-render before the frame is captured.
      setTimeout(() => continueRender(handle), 0);
    };
    img.onload = () => done(img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1);
    img.onerror = () => done(1);
    img.src = src;
  }
  return src ? (aspectCache.get(src) ?? null) : null;
};

/** `object-fit: contain` rectangle of an image with `aspect` inside a w×h box. */
export const containRect = (w: number, h: number, aspect: number | null) => {
  if (!aspect) return { x: 0, y: 0, width: w, height: h };
  if (w / h > aspect) {
    const width = h * aspect;
    return { x: (w - width) / 2, y: 0, width, height: h };
  }
  const height = w / aspect;
  return { x: 0, y: (h - height) / 2, width: w, height };
};

const LightSweep: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const media = useAssetSrc(p.mask);
  const maskSrc = media?.kind === "image" ? media.src : null;
  const maskAspect = useImageAspect(maskSrc);
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const maskRect = containRect(w, h, maskAspect);
  const diag = Math.hypot(w, h);
  const band = Math.max(4, p.bandWidth * diag);

  const dur = Math.max(4, Math.round(p.sweepDuration * fps));
  const start = Math.round(p.delay * fps);
  const period = p.repeatEvery > 0 ? Math.max(dur + 1, Math.round(p.repeatEvery * fps)) : 0;
  const local = frame - start;
  const t = local < 0 ? -1 : period > 0 ? mod(local, period) : local;
  const active = t >= 0 && t <= dur;
  const prog = active ? progress(t, 0, dur, "ease-in-out") : 0;

  const layers = active
    ? [
        { key: "halo", width: band * 2.4, stops: bandStops(1, p.intensity * 0.36) },
        { key: "band", width: band, stops: bandStops(p.softness, p.intensity * 0.8) },
        { key: "core", width: band * 0.12, stops: bandStops(1, Math.min(1, p.intensity * 0.55)) },
      ]
    : [];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", pointerEvents: "none" }}>
      {/* Holds the render until the mask image is decoded. */}
      {maskSrc ? <Img src={maskSrc} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} /> : null}
      {active ? (
        <svg
          aria-hidden="true"
          width="100%"
          height="100%"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, display: "block", overflow: "hidden" }}
        >
          <defs>
            {layers.map((l) => {
              const v = sweepBand(w, h, p.angle, prog, l.width, band * 2.4);
              return (
                <linearGradient key={l.key} id={`${l.key}${uid}`} gradientUnits="userSpaceOnUse" {...v}>
                  {l.stops.map(([o, a]) => (
                    <stop key={o} offset={o} stopColor={l.key === "core" ? "#FFFFFF" : p.color} stopOpacity={a} />
                  ))}
                </linearGradient>
              );
            })}
            <mask id={`m${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h} style={{ maskType: "alpha" }}>
              {maskSrc ? (
                <image href={maskSrc} {...maskRect} preserveAspectRatio="none" />
              ) : (
                <rect width={w} height={h} rx={Math.max(0, p.radius * unit)} fill="#FFFFFF" />
              )}
            </mask>
          </defs>
          <g mask={`url(#m${uid})`}>
            {layers.map((l) => (
              <rect key={l.key} width={w} height={h} fill={`url(#${l.key}${uid})`} />
            ))}
          </g>
        </svg>
      ) : null}
    </div>
  );
};

export const lightSweep = defineMotionComponent<Props>({
  id: "light-sweep",
  name: "Light sweep",
  category: "overlay",
  description:
    "A diagonal specular shine that glides across its box once (or on repeat), with a soft halo and a hot core. Place it exactly over a logo, product shot or card; set `mask` to the same image so the shine only touches its pixels, or `radius` to match a card's corners. It adds light, so it reads best on coloured or darker surfaces (logo-reveal has its own sheen for white logos).",
  schema: {
    color: { type: "color", label: "Color", default: "#FFFFFF" },
    intensity: { type: "number", label: "Intensity", default: 0.55, min: 0, max: 1, step: 0.05 },
    bandWidth: { type: "number", label: "Band width", default: 0.2, min: 0.02, max: 0.8, step: 0.01 },
    angle: { type: "number", label: "Angle (deg)", default: 25, min: -80, max: 80, step: 1 },
    softness: { type: "number", label: "Softness", default: 0.75, min: 0, max: 1, step: 0.05 },
    sweepDuration: { type: "number", label: "Sweep time (s)", default: 1.1, min: 0.2, max: 6, step: 0.05 },
    delay: { type: "number", label: "Delay (s)", default: 0.2, min: 0, max: 20, step: 0.05 },
    repeatEvery: { type: "number", label: "Repeat every (s)", default: 0, min: 0, max: 20, step: 0.1, description: "0 = sweep once" },
    mask: { type: "asset", label: "Mask image", default: "", description: "Optional: the logo/card image the shine should be limited to" },
    radius: { type: "number", label: "Corner radius", default: 0, min: 0, max: 400, step: 1 },
  },
  defaults: {
    color: "#FFFFFF",
    intensity: 0.55,
    bandWidth: 0.2,
    angle: 25,
    softness: 0.75,
    sweepDuration: 1.1,
    delay: 0.2,
    repeatEvery: 0,
    mask: "",
    radius: 0,
  },
  defaultDuration: 2,
  Component: LightSweep,
  tags: ["overlay", "shine", "glint", "logo", "card", "specular"],
});
