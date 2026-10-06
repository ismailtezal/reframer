import { getLength, getPointAtLength, getTangentAtLength } from "@remotion/paths";
import type React from "react";
import { useId, useMemo } from "react";
import { Img, useCurrentFrame, useVideoConfig } from "remotion";
import { resolveEasing } from "../../../core/easing";
import { fontStack, useFonts } from "../../fonts";
import { lerp, progress, random01 } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";

type Props = {
  /** One "Name:x,y" per line, x/y as 0..1 of the box */
  stops: string;
  style: "dark" | "paper";
  accentColor: string;
  /** 0..1 amount of land */
  land: number;
  seed: number;
  curvature: number;
  /** seconds for the whole route */
  travelDuration: number;
  /** seconds held at each stop */
  pause: number;
  marker: "dot" | "plane";
  labels: boolean;
  preview: boolean;
  /** camera push across the clip (0.05 = 5%) */
  zoom: number;
  fontFamily: string;
  labelSize: number;
  exit: boolean;
};

type Stop = { id: string; name: string; x: number; y: number };

const PALETTES = {
  dark: {
    bg: "#0A0D13",
    text: "#F2F4F7",
    pill: "rgba(14,17,24,0.86)",
    pillBorder: "rgba(255,255,255,0.12)",
    preview: "rgba(255,255,255,0.3)",
    pinCore: "#FFFFFF",
  },
  paper: {
    bg: "#D9E1E0",
    text: "#1F2328",
    pill: "rgba(255,255,255,0.94)",
    pillBorder: "rgba(0,0,0,0.08)",
    preview: "rgba(31,35,40,0.35)",
    pinCore: "#FFFFFF",
  },
} as const;

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const parseStops = (text: string): Stop[] => {
  const out: Stop[] = [];
  for (const raw of text.split("\n")) {
    const m = raw.trim().match(/^(.*?):\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/);
    if (!m) continue;
    const x = Number.parseFloat(m[2]);
    const y = Number.parseFloat(m[3]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ id: `s${out.length}`, name: m[1].trim(), x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
  }
  return out.slice(0, 5);
};

/** Smooth value noise in [0, 1]. */
const valueNoise = (x: number, y: number, s: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const hash = (i: number, j: number) => random01(i * 127.1 + j * 311.7 + s * 74.7);
  return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
};

/**
 * Bakes the abstract map (land, coasts, graticule, paper grain or dot matrix)
 * into one image. Runs once per layout/seed, never per frame.
 */
const bakeMap = (w: number, h: number, style: Props["style"], land: number, seed: number, stops: Stop[], unit: number): string => {
  if (typeof document === "undefined") return "";
  const scale = style === "paper" ? 0.5 : 1;
  const cw = Math.max(16, Math.round(w * scale));
  const ch = Math.max(16, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const short = Math.min(w, h);
  const threshold = lerp(0.74, 0.4, Math.max(0, Math.min(1, land)));

  // Field sampled on a coarse grid (box px), bilinearly interpolated per pixel.
  const step = 4 / scale;
  const gw = Math.ceil(w / step) + 2;
  const gh = Math.ceil(h / step) + 2;
  const field = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const x = i * step;
      const y = j * step;
      const X = (x / short) * 2.3;
      const Y = (y / short) * 2.3;
      // Octaves are rotated against each other so the value-noise lattice never shows.
      const X2 = (X * 0.8 - Y * 0.6) * 2.03 + 5.2;
      const Y2 = (X * 0.6 + Y * 0.8) * 2.03 + 1.3;
      const X3 = (X * 0.47 + Y * 0.88) * 4.1 + 9.7;
      const Y3 = (-X * 0.88 + Y * 0.47) * 4.1 + 3.1;
      let f = 0.55 * valueNoise(X, Y, seed) + 0.29 * valueNoise(X2, Y2, seed + 1) + 0.16 * valueNoise(X3, Y3, seed + 2);
      for (const s of stops) {
        const d = Math.hypot(x - s.x * w, y - s.y * h) / (0.17 * short);
        f += 0.34 * Math.exp(-d * d);
      }
      field[j * gw + i] = f - threshold;
    }
  }
  const sample = (x: number, y: number) => {
    const gx = Math.min(gw - 1.001, Math.max(0, x / step));
    const gy = Math.min(gh - 1.001, Math.max(0, y / step));
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    const fx = gx - i;
    const fy = gy - j;
    const a = field[j * gw + i];
    const b = field[j * gw + i + 1];
    const c = field[(j + 1) * gw + i];
    const d = field[(j + 1) * gw + i + 1];
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  };

  if (style === "paper") {
    const img = ctx.createImageData(cw, ch);
    const water = [217, 225, 224];
    const shallow = [229, 235, 232];
    const landIn = [245, 240, 228];
    const landEdge = [233, 225, 206];
    const coast = [168, 156, 128];
    for (let py = 0; py < ch; py++) {
      for (let px = 0; px < cw; px++) {
        const x = (px + 0.5) / scale;
        const y = (py + 0.5) / scale;
        const f = sample(x, y);
        const gx = (sample(x + step, y) - sample(x - step, y)) / (2 * step);
        const gy = (sample(x, y + step) - sample(x, y - step)) / (2 * step);
        // Distance to the coastline in screen px (first-order).
        const dist = Math.abs(f) / Math.max(1e-6, Math.hypot(gx, gy));
        let r: number;
        let g: number;
        let b: number;
        if (f > 0) {
          const t = smoothstep(0, 26 * unit, dist);
          r = lerp(landEdge[0], landIn[0], t);
          g = lerp(landEdge[1], landIn[1], t);
          b = lerp(landEdge[2], landIn[2], t);
        } else {
          const t = smoothstep(0, 34 * unit, dist);
          r = lerp(shallow[0], water[0], t);
          g = lerp(shallow[1], water[1], t);
          b = lerp(shallow[2], water[2], t);
        }
        const line = 1 - smoothstep(0.7 * unit, 2 * unit, dist);
        r = lerp(r, coast[0], line * 0.85);
        g = lerp(g, coast[1], line * 0.85);
        b = lerp(b, coast[2], line * 0.85);
        const grain = (random01(px * 12.9898 + py * 78.233 + seed) - 0.5) * 7;
        const o = (py * cw + px) * 4;
        img.data[o] = r + grain;
        img.data[o + 1] = g + grain;
        img.data[o + 2] = b + grain;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = "rgba(70,95,105,0.09)";
  } else {
    ctx.fillStyle = PALETTES.dark.bg;
    ctx.fillRect(0, 0, cw, ch);
    const gap = 13 * unit;
    const r = Math.max(0.8, 2.1 * unit);
    for (let y = gap / 2; y < h; y += gap) {
      for (let x = gap / 2; x < w; x += gap) {
        const f = sample(x, y);
        const a = f > 0 ? 0.26 + 0.24 * smoothstep(0, 0.12, f) : 0.05;
        ctx.fillStyle = `rgba(150,162,184,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x * scale, y * scale, (f > 0 ? r : r * 0.75) * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
  }
  // Graticule
  ctx.lineWidth = Math.max(1, unit * scale);
  const cell = short / 4;
  ctx.beginPath();
  for (let x = (w % cell) / 2; x <= w; x += cell) {
    ctx.moveTo(x * scale, 0);
    ctx.lineTo(x * scale, ch);
  }
  for (let y = (h % cell) / 2; y <= h; y += cell) {
    ctx.moveTo(0, y * scale);
    ctx.lineTo(cw, y * scale);
  }
  ctx.stroke();
  return canvas.toDataURL("image/png");
};

const PLANE =
  "M21 12c0-.8-.6-1.4-1.4-1.4h-5.1L9.9 3.2H8l2.3 7.4H5.8L4 8.3H2.6L3.8 12l-1.2 3.7H4l1.8-2.3h4.5L8 20.8h1.9l4.6-7.4h5.1c.8 0 1.4-.6 1.4-1.4Z";

const MapRoute: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  useFonts([{ family: p.fontFamily, weight: 600 }]);
  const font = fontStack(p.fontFamily);
  const pal = PALETTES[p.style];
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const stops = parseStops(p.stops);
  const stopsKey = stops.map((s) => `${s.x},${s.y}`).join(";");
  // biome-ignore lint/correctness/useExhaustiveDependencies: stopsKey captures the stop positions
  const mapSrc = useMemo(() => bakeMap(w, h, p.style, p.land, p.seed, stops, unit), [w, h, p.style, p.land, p.seed, stopsKey, unit]);

  // --- route geometry ----------------------------------------------------------
  const pts = stops.map((s) => ({ ...s, px: s.x * w, py: s.y * h }));
  let d = pts.length ? `M${pts[0].px} ${pts[0].py}` : "";
  const segLens: number[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k];
    const b = pts[k + 1];
    const dx = b.px - a.px;
    const dy = b.py - a.py;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const bow = p.curvature * len;
    const seg = `C${a.px + dx / 3 + nx * bow} ${a.py + dy / 3 + ny * bow} ${a.px + (2 * dx) / 3 + nx * bow} ${a.py + (2 * dy) / 3 + ny * bow} ${b.px} ${b.py}`;
    segLens.push(getLength(`M${a.px} ${a.py}${seg}`));
    d += seg;
  }
  const total = segLens.length ? getLength(d) : 0;
  const sumSeg = segLens.reduce((s, v) => s + v, 0) || 1;

  // --- timeline ----------------------------------------------------------------
  const ease = resolveEasing("ease-in-out");
  const mapP = progress(frame, 0, 18, "smooth");
  const t0 = 14;
  const travelF = Math.max(4, p.travelDuration * fps);
  const pauseF = Math.max(0, p.pause * fps);
  const segStart: number[] = [];
  const segDur: number[] = [];
  let t = t0 + 10;
  for (const len of segLens) {
    segStart.push(t);
    const dur = Math.max(4, (travelF * len) / sumSeg);
    segDur.push(dur);
    t += dur + pauseF;
  }
  const arrive = (k: number) => (k === 0 ? t0 : segStart[k - 1] + segDur[k - 1]);
  let drawn = 0;
  for (let k = 0; k < segLens.length; k++) {
    const q = Math.min(1, Math.max(0, (frame - segStart[k]) / segDur[k]));
    drawn += segLens[k] * ease(q);
  }
  drawn = Math.min(total, (drawn / sumSeg) * total);
  const lastArrive = pts.length > 1 ? arrive(pts.length - 1) : t0;
  const moving = pts.length > 1 && frame >= segStart[0] && frame < lastArrive + 6;
  const head = total > 0 ? getPointAtLength(d, Math.max(0.01, drawn)) : null;
  const tangent = total > 0 ? getTangentAtLength(d, Math.min(total - 0.01, Math.max(0.01, drawn))) : null;
  const markerP = moving ? Math.min(progress(frame, segStart[0] - 2, 8, "smooth"), 1 - progress(frame, lastArrive, 6, "smooth")) : 0;

  // --- camera ------------------------------------------------------------------
  const zoomP = progress(frame, 0, Math.max(1, p.durationInFrames), "ease-in-out");
  const cx = pts.length ? pts.reduce((s, q) => s + q.px, 0) / pts.length : w / 2;
  const cy = pts.length ? pts.reduce((s, q) => s + q.py, 0) / pts.length : h / 2;
  const exitP = p.exit ? progress(frame, p.durationInFrames - 13, 12, "ease-in") : 0;
  const lw = Math.max(2, 5 * unit);
  const labelFs = Math.max(24 * unit, p.labelSize * unit);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", backgroundColor: pal.bg, opacity: 1 - exitP }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${(1 + p.zoom * zoomP).toFixed(4)})`,
          transformOrigin: `${((cx / w) * 100).toFixed(2)}% ${((cy / h) * 100).toFixed(2)}%`,
        }}
      >
        {mapSrc ? <Img src={mapSrc} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: mapP }} /> : null}
        <svg
          aria-hidden="true"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          <defs>
            <radialGradient id={`halo${uid}`}>
              <stop offset="0" stopColor={p.accentColor} stopOpacity={0.5} />
              <stop offset="0.45" stopColor={p.accentColor} stopOpacity={0.15} />
              <stop offset="1" stopColor={p.accentColor} stopOpacity={0} />
            </radialGradient>
          </defs>
          {p.preview && total > 0 ? (
            <path
              d={d}
              fill="none"
              stroke={pal.preview}
              strokeWidth={Math.max(1.5, 2.6 * unit)}
              strokeLinecap="round"
              strokeDasharray={`${0.1 * unit} ${12 * unit}`}
              opacity={mapP}
            />
          ) : null}
          {total > 0 && drawn > 0.5 ? (
            <>
              <path
                d={d}
                fill="none"
                stroke={p.accentColor}
                strokeWidth={lw * 3}
                strokeLinecap="round"
                opacity={0.16}
                strokeDasharray={`${total} ${total}`}
                strokeDashoffset={total - drawn}
              />
              <path
                d={d}
                fill="none"
                stroke={p.accentColor}
                strokeWidth={lw}
                strokeLinecap="round"
                strokeDasharray={`${total} ${total}`}
                strokeDashoffset={total - drawn}
              />
            </>
          ) : null}
          {pts.map((s, k) => {
            const at = arrive(k);
            const pin = progress(frame, at, 14, "smooth");
            if (pin <= 0) return null;
            const ripple = progress(frame, at, 28, "ease-out");
            return (
              <g key={s.id} transform={`translate(${s.px} ${s.py - (1 - pin) * 26 * unit})`} opacity={Math.min(1, pin * 1.6)}>
                <circle
                  r={(12 + 34 * ripple) * unit}
                  fill="none"
                  stroke={p.accentColor}
                  strokeWidth={Math.max(1, 2 * unit)}
                  opacity={0.55 * (1 - ripple)}
                />
                <circle r={17 * unit * pin} fill={p.accentColor} opacity={0.22} />
                <circle r={10 * unit * (0.6 + 0.4 * pin)} fill={p.accentColor} stroke={pal.pinCore} strokeWidth={Math.max(1, 3 * unit)} />
              </g>
            );
          })}
          {head && markerP > 0 ? (
            <g transform={`translate(${head.x} ${head.y})`} opacity={markerP}>
              <circle r={30 * unit} fill={`url(#halo${uid})`} />
              {p.marker === "plane" ? (
                <g
                  transform={`rotate(${tangent ? (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI : 0}) scale(${(2.1 * unit).toFixed(4)}) translate(-12 -12)`}
                >
                  <path d={PLANE} fill={pal.pinCore} stroke={p.accentColor} strokeWidth={0.9} />
                </g>
              ) : (
                <>
                  <circle r={9 * unit} fill={pal.pinCore} />
                  <circle r={5.5 * unit} fill={p.accentColor} />
                </>
              )}
            </g>
          ) : null}
        </svg>
        {p.labels
          ? pts.map((s, k) => {
              const lp = progress(frame, arrive(k) + 3, 14, "smooth");
              if (lp <= 0) return null;
              const flipX = s.px > w * 0.72;
              const below = s.py < labelFs * 2.6 + 30 * unit;
              return (
                <div
                  key={`label-${s.id}`}
                  style={{
                    position: "absolute",
                    left: s.px + (flipX ? -22 * unit : 22 * unit),
                    top: s.py + (below ? 22 * unit : -22 * unit),
                    transform: `translate(${flipX ? "-100%" : "0"}, ${below ? "0" : "-100%"}) translateY(${((1 - lp) * 8 * unit).toFixed(2)}px)`,
                    opacity: lp,
                    padding: `${labelFs * 0.32}px ${labelFs * 0.62}px`,
                    borderRadius: labelFs,
                    background: pal.pill,
                    border: `${Math.max(1, unit)}px solid ${pal.pillBorder}`,
                    boxShadow: `0 ${8 * unit}px ${24 * unit}px rgba(0,0,0,${p.style === "dark" ? 0.4 : 0.12})`,
                    fontFamily: font,
                    fontWeight: 600,
                    fontSize: labelFs,
                    lineHeight: 1,
                    letterSpacing: "-0.01em",
                    color: pal.text,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.name}
                </div>
              );
            })
          : null}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            p.style === "dark"
              ? "radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)"
              : "radial-gradient(ellipse 80% 75% at 50% 50%, rgba(0,0,0,0) 60%, rgba(60,50,30,0.14) 100%)",
        }}
      />
    </div>
  );
};

export const mapRoute = defineMotionComponent<Props>({
  id: "map-route",
  name: "Map route",
  category: "data",
  description:
    "A stylised abstract map (dark dot-matrix or warm paper with coastlines; no real tiles) where a curved route draws on between 2-5 named stops, pins drop with a ripple and labels as the traveller (dot or plane) arrives, with a slow camera push. One 'Name:x,y' per line with x/y as 0..1 of the box. Use for journeys, expansion, logistics and travel stories — geography is illustrative, not accurate.",
  schema: {
    stops: {
      type: "text",
      label: "Stops",
      default: "Lisbon:0.18,0.64\nParis:0.4,0.36\nBerlin:0.6,0.3\nIstanbul:0.82,0.62",
      description: "One 'Name:x,y' per line (x/y from 0 to 1), 2-5 stops",
    },
    style: { type: "enum", label: "Map style", default: "dark", options: ["dark", "paper"] },
    accentColor: { type: "color", label: "Route color", default: "#FF6A3D" },
    land: { type: "number", label: "Land amount", default: 0.5, min: 0, max: 1, step: 0.05 },
    seed: { type: "number", label: "Seed", default: 3, min: 0, max: 100, step: 1 },
    curvature: { type: "number", label: "Arc curvature", default: 0.18, min: 0, max: 0.6, step: 0.01 },
    travelDuration: { type: "number", label: "Travel time (s)", default: 3, min: 0.5, max: 20, step: 0.1 },
    pause: { type: "number", label: "Pause at stops (s)", default: 0.25, min: 0, max: 3, step: 0.05 },
    marker: { type: "enum", label: "Traveller", default: "dot", options: ["dot", "plane"] },
    labels: { type: "boolean", label: "Labels", default: true },
    preview: { type: "boolean", label: "Dotted preview", default: true },
    zoom: { type: "number", label: "Camera push", default: 0.05, min: 0, max: 0.3, step: 0.01 },
    fontFamily: { type: "font", label: "Font", default: "Inter" },
    labelSize: { type: "number", label: "Label size", default: 30, min: 20, max: 64, step: 1 },
    exit: { type: "boolean", label: "Animate out", default: false },
  },
  defaults: {
    stops: "Lisbon:0.18,0.64\nParis:0.4,0.36\nBerlin:0.6,0.3\nIstanbul:0.82,0.62",
    style: "dark",
    accentColor: "#FF6A3D",
    land: 0.5,
    seed: 3,
    curvature: 0.18,
    travelDuration: 3,
    pause: 0.25,
    marker: "dot",
    labels: true,
    preview: true,
    zoom: 0.05,
    fontFamily: "Inter",
    labelSize: 30,
    exit: false,
  },
  defaultDuration: 6,
  Component: MapRoute,
  tags: ["data", "map", "route", "travel", "journey", "geography", "logistics"],
});
