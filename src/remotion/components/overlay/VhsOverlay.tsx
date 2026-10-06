import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { fontStack, useFonts } from "../../fonts";
import { random01 } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";
import { getSpeckleTile, SPECKLE_TILE_SIZE } from "./FilmGrain";

type Props = {
  mode: "play" | "rec" | "pause" | "none";
  date: string;
  /** Start time of the on-screen clock, e.g. "8:17 PM" or "20:17"; empty hides it. */
  time: string;
  showCounter: boolean;
  osdRight: string;
  osdColor: string;
  /** px at 1080p */
  osdSize: number;
  scanlines: number;
  noise: number;
  tracking: number;
  vignette: number;
  seed: number;
};

const pad2 = (n: number) => n.toString().padStart(2, "0");

/** Parses "8:17 PM", "8:17:05 pm" or "20:17" into seconds since midnight. */
const parseClock = (s: string): { sec: number; twelve: boolean } | null => {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let hh = Number(m[1]);
  const ap = m[4]?.toUpperCase();
  if (ap === "PM" && hh < 12) hh += 12;
  if (ap === "AM" && hh === 12) hh = 0;
  return { sec: hh * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0), twelve: Boolean(ap) };
};

const formatClock = (total: number, twelve: boolean) => {
  const t = ((Math.floor(total) % 86400) + 86400) % 86400;
  const hh = Math.floor(t / 3600);
  const mm = pad2(Math.floor((t % 3600) / 60));
  const ss = pad2(t % 60);
  if (!twelve) return `${pad2(hh)}:${mm}:${ss}`;
  return `${hh % 12 === 0 ? 12 : hh % 12}:${mm}:${ss} ${hh < 12 ? "AM" : "PM"}`;
};

const ModeIcon: React.FC<{ mode: Props["mode"]; size: number; color: string; on: boolean }> = ({ mode, size, color, on }) => {
  if (mode === "rec") {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 10 10" style={{ display: "block", opacity: on ? 1 : 0 }}>
        <circle cx={5} cy={5} r={4.2} fill="#FF3B30" />
      </svg>
    );
  }
  if (mode === "pause") {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 10 10" style={{ display: "block" }}>
        <rect x={1.4} y={1} width={2.6} height={8} fill={color} />
        <rect x={6} y={1} width={2.6} height={8} fill={color} />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 10 10" style={{ display: "block" }}>
      <path d="M1.5 1L9 5L1.5 9Z" fill={color} />
    </svg>
  );
};

const VhsOverlay: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([{ family: "VT323", weight: 400 }]);
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const clip = Math.max(1, p.durationInFrames);
  const seed = p.seed * 1000;
  const r = (k: number) => random01(frame * 7.13 + k * 3.71 + seed);

  // Scanlines on whole pixels to avoid moiré.
  const period = Math.max(2, Math.round(4 * unit));
  const line = Math.max(1, Math.round(period / 2));

  // Tracking band rolls upwards on integer cycles per clip.
  const rollCycles = Math.max(1, Math.round(clip / fps / 5));
  const u = (frame / clip) * rollCycles + random01(seed + 9);
  const bandH = h * 0.085;
  const bandY = (1 - (u - Math.floor(u))) * (h + bandH * 2) - bandH * 1.5;
  const bandAlpha = p.tracking * (0.45 + 0.25 * r(1));
  const streaks = Array.from({ length: Math.round(2 + p.tracking * 5) }, (_, i) => ({
    id: `st${i}`,
    x: r(10 + i) * w * 0.7,
    y: bandY + r(20 + i) * bandH,
    len: (0.08 + r(30 + i) * 0.4) * w,
    a: 0.18 + r(40 + i) * 0.4,
  }));
  const headH = Math.max(6 * unit, h * 0.022);

  const tile = SPECKLE_TILE_SIZE * Math.max(1, unit);
  const size = p.osdSize * unit;
  const margin = { x: Math.max(64 * unit, w * 0.055), y: Math.max(52 * unit, h * 0.07) };
  const jitter = r(50) < 0.08 ? (r(51) - 0.5) * 5 * unit : 0;
  const elapsed = frame / fps;
  const clock = parseClock(p.time);
  const timeText = p.time.trim() === "" ? "" : clock ? formatClock(clock.sec + elapsed, clock.twelve) : p.time;
  const counter = `${Math.floor(elapsed / 3600)}:${pad2(Math.floor((elapsed % 3600) / 60))}:${pad2(Math.floor(elapsed % 60))}`;
  const blinkOn = Math.floor(frame / Math.max(1, Math.round(fps * 0.5))) % 2 === 0;
  const modeLabel = p.mode === "rec" ? "REC" : p.mode === "pause" ? "PAUSE" : "PLAY";

  const osd: React.CSSProperties = {
    position: "absolute",
    fontFamily: fontStack("VT323"),
    fontSize: size,
    lineHeight: 0.95,
    color: p.osdColor,
    letterSpacing: "0.04em",
    textShadow: `0 0 ${6 * unit}px rgba(255,255,255,0.35), ${-2.5 * unit}px 0 rgba(255,40,90,0.55), ${2.5 * unit}px 0 rgba(40,210,255,0.55)`,
    whiteSpace: "nowrap",
    transform: `translateX(${jitter}px)`,
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", pointerEvents: "none" }}>
      {/* Faint chroma bleed at the edges + vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: [
            `radial-gradient(ellipse 75% 72% at 50% 50%, rgba(0,0,0,0) 58%, rgba(0,0,0,${(p.vignette * 0.42).toFixed(3)}) 85%, rgba(0,0,0,${(p.vignette * 0.75).toFixed(3)}) 100%)`,
            `linear-gradient(90deg, rgba(255,30,80,${(0.05 * p.noise).toFixed(3)}) 0%, rgba(0,0,0,0) 6%, rgba(0,0,0,0) 94%, rgba(30,200,255,${(0.05 * p.noise).toFixed(3)}) 100%)`,
          ].join(", "),
        }}
      />
      {p.scanlines > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `repeating-linear-gradient(180deg, rgba(0,0,0,${(p.scanlines * 0.32).toFixed(3)}) 0px, rgba(0,0,0,${(p.scanlines * 0.32).toFixed(3)}) ${line}px, rgba(0,0,0,0) ${line}px, rgba(0,0,0,0) ${period}px)`,
          }}
        />
      ) : null}
      {p.noise > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${getSpeckleTile(frame)})`,
            backgroundSize: `${(tile * 1.2).toFixed(1)}px ${(tile * 0.9).toFixed(1)}px`,
            backgroundPosition: `${(r(2) * tile).toFixed(1)}px ${(r(3) * tile).toFixed(1)}px`,
            opacity: Math.min(1, p.noise * 0.3),
          }}
        />
      ) : null}
      {p.tracking > 0 ? (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: bandY,
              width: "100%",
              height: bandH,
              backgroundImage: `url(${getSpeckleTile(frame + 3)})`,
              backgroundSize: `${(tile * 9).toFixed(1)}px ${(tile * 0.16).toFixed(1)}px`,
              backgroundPosition: `${(r(4) * tile * 9).toFixed(1)}px 0px`,
              opacity: bandAlpha,
              maskImage: "linear-gradient(180deg, transparent 0%, #000 38%, #000 62%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 38%, #000 62%, transparent 100%)",
            }}
          />
          {streaks.map((s) => (
            <div
              key={s.id}
              style={{
                position: "absolute",
                left: s.x,
                top: s.y,
                width: s.len,
                height: Math.max(1, 1.5 * unit),
                background: `linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,${(s.a * p.tracking).toFixed(3)}) 30%, rgba(255,255,255,0))`,
              }}
            />
          ))}
          {/* Head-switching noise along the bottom edge */}
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: "100%",
              height: headH,
              backgroundColor: `rgba(0,0,0,${(0.35 * p.tracking).toFixed(3)})`,
              backgroundImage: `url(${getSpeckleTile(frame + 1)})`,
              backgroundSize: `${(tile * 6).toFixed(1)}px ${(tile * 0.12).toFixed(1)}px`,
              backgroundPosition: `${(r(5) * tile * 6).toFixed(1)}px 0px`,
              transform: `translateX(${((r(6) - 0.5) * 14 * unit).toFixed(1)}px)`,
              opacity: Math.min(1, 0.4 + 0.6 * p.tracking),
            }}
          />
        </>
      ) : null}
      {p.mode !== "none" ? (
        <div style={{ ...osd, left: margin.x, top: margin.y, display: "flex", alignItems: "center", gap: size * 0.28 }}>
          {p.mode === "rec" ? <ModeIcon mode="rec" size={size * 0.52} color={p.osdColor} on={blinkOn} /> : null}
          <span>{modeLabel}</span>
          {p.mode !== "rec" ? <ModeIcon mode={p.mode} size={size * 0.5} color={p.osdColor} on /> : null}
        </div>
      ) : null}
      {p.osdRight || p.showCounter ? (
        <div style={{ ...osd, right: margin.x, top: margin.y, textAlign: "right" }}>
          {p.osdRight ? <div>{p.osdRight}</div> : null}
          {p.showCounter ? <div style={{ marginTop: size * 0.12 }}>{counter}</div> : null}
        </div>
      ) : null}
      {timeText || p.date ? (
        <div style={{ ...osd, left: margin.x, bottom: margin.y + headH }}>
          {timeText ? <div>{timeText}</div> : null}
          {p.date ? <div style={{ marginTop: size * 0.12 }}>{p.date}</div> : null}
        </div>
      ) : null}
    </div>
  );
};

export const vhsOverlay = defineMotionComponent<Props>({
  id: "vhs-overlay",
  name: "VHS overlay",
  category: "overlay",
  description:
    "Camcorder/VHS look over footage: scanlines, tape noise, a rolling tracking band, head-switching noise at the bottom and a VT323 on-screen display (PLAY/REC/PAUSE, running clock, tape counter, date stamp). Use only for retro, home-video or nostalgia briefs; put it on the top track.",
  schema: {
    mode: { type: "enum", label: "OSD mode", default: "play", options: ["play", "rec", "pause", "none"] },
    date: { type: "string", label: "Date stamp", default: "OCT. 06 1997" },
    time: { type: "string", label: "Clock start", default: "8:17 PM", description: "Runs with the clip; empty hides it" },
    showCounter: { type: "boolean", label: "Tape counter", default: true },
    osdRight: { type: "string", label: "Top-right text", default: "SP" },
    osdColor: { type: "color", label: "OSD color", default: "#F2F2F2" },
    osdSize: { type: "number", label: "OSD size", default: 64, min: 32, max: 140, step: 1 },
    scanlines: { type: "number", label: "Scanlines", default: 0.5, min: 0, max: 1, step: 0.05 },
    noise: { type: "number", label: "Noise", default: 0.45, min: 0, max: 1, step: 0.05 },
    tracking: { type: "number", label: "Tracking", default: 0.55, min: 0, max: 1, step: 0.05 },
    vignette: { type: "number", label: "Vignette", default: 0.35, min: 0, max: 1, step: 0.05 },
    seed: { type: "number", label: "Seed", default: 0, min: 0, max: 100, step: 1 },
  },
  defaults: {
    mode: "play",
    date: "OCT. 06 1997",
    time: "8:17 PM",
    showCounter: true,
    osdRight: "SP",
    osdColor: "#F2F2F2",
    osdSize: 64,
    scanlines: 0.5,
    noise: 0.45,
    tracking: 0.55,
    vignette: 0.35,
    seed: 0,
  },
  defaultDuration: 6,
  Component: VhsOverlay,
  tags: ["overlay", "vhs", "retro", "camcorder", "90s", "analog", "glitch"],
});
