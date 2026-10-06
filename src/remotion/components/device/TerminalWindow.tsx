import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { mixColors, withAlpha } from "../../../core/color";
import { fontStack, useFonts } from "../../fonts";
import { progress, random01 } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";
import { TrafficLights } from "./BrowserWindow";

type Props = {
  script: string;
  title: string;
  cwd: string;
  prompt: string;
  fontFamily: string;
  /** px at 1080p (shrinks to fit the longest line) */
  fontSize: number;
  /** characters per second */
  typeSpeed: number;
  /** frames between output lines */
  lineDelay: number;
  /** seconds before typing starts */
  startDelay: number;
  accentColor: string;
  background: string;
  textColor: string;
  dimColor: string;
  radius: number;
  shadow: number;
  exit: boolean;
};

type Row = {
  id: string;
  kind: "cmd" | "out" | "idle";
  text: string;
  /** frame the row appears (prompt shown / output printed) */
  appear: number;
  /** frames at which each typed character lands (commands) */
  chars: number[];
  /** frame the Enter key is pressed (commands) */
  enter: number;
};

const SUCCESS = "#4ADE80";
const ERROR = "#F87171";
const WARN = "#FBBF24";
const LINK = "#8BD5FF";

const buildRows = (script: string, fps: number, typeSpeed: number, lineDelay: number, startDelay: number): Row[] => {
  const lines = script.replace(/\s+$/, "").split("\n");
  const fpc = fps / Math.max(1, typeSpeed);
  const rows: Row[] = [];
  let t = Math.round(startDelay * fps) + 12;
  let prev: Row["kind"] | null = null;
  lines.forEach((raw, i) => {
    const isCmd = raw.startsWith("$ ") || raw === "$";
    if (isCmd) {
      const text = raw.slice(2);
      const appear = prev === null ? Math.max(0, t - 12) : t;
      if (prev !== null) t += 8;
      const chars: number[] = [];
      for (let k = 0; k < text.length; k++) {
        t += fpc * (0.55 + 0.9 * random01(i * 97.1 + k * 13.3 + 5)) * (text[k] === " " ? 1.5 : 1);
        chars.push(t);
      }
      t += 9;
      rows.push({ id: `r${i}`, kind: "cmd", text, appear, chars, enter: t });
      t += 5;
    } else {
      rows.push({ id: `r${i}`, kind: "out", text: raw, appear: t, chars: [], enter: t });
      t += Math.max(0, lineDelay);
    }
    prev = isCmd ? "cmd" : "out";
  });
  rows.push({ id: "idle", kind: "idle", text: "", appear: t + 6, chars: [], enter: t + 6 });
  return rows;
};

const outColor = (text: string, base: string, dim: string): { glyph: number; color: string } => {
  const tr = text.trimStart();
  const lead = text.length - tr.length;
  if (/^[✓✔√]/.test(tr)) return { glyph: lead + 1, color: SUCCESS };
  if (/^[✗✖×]/.test(tr)) return { glyph: lead + 1, color: ERROR };
  if (/^(error|err!)/i.test(tr)) return { glyph: text.length, color: ERROR };
  if (/^(⚠|!|warn)/i.test(tr)) return { glyph: lead + 1, color: WARN };
  if (tr.startsWith("#")) return { glyph: text.length, color: dim };
  return { glyph: 0, color: base };
};

/** Output text with coloured status glyphs and highlighted URLs. */
const OutText: React.FC<{ text: string; base: string; dim: string }> = ({ text, base, dim }) => {
  const { glyph, color } = outColor(text, base, dim);
  const head = text.slice(0, glyph);
  const rest = text.slice(glyph);
  const parts = rest.split(/(https?:\/\/\S+)/);
  let offset = 0;
  return (
    <>
      {head ? <span style={{ color }}>{head}</span> : null}
      {parts.map((part) => {
        const key = `p${offset}`;
        offset += part.length;
        if (!part) return null;
        return /^https?:\/\//.test(part) ? (
          <span key={key} style={{ color: LINK }}>
            {part}
          </span>
        ) : (
          <span key={key} style={{ color: glyph === text.length ? color : base }}>
            {part}
          </span>
        );
      })}
    </>
  );
};

const TerminalWindow: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([
    { family: p.fontFamily, weight: 400 },
    { family: p.fontFamily, weight: 600 },
    { family: "Inter", weight: 500 },
  ]);
  const mono = fontStack(p.fontFamily);
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const margin = Math.min(w, h) * 0.04;
  const winW = w - margin * 2;
  const winH = h - margin * 2;
  const barH = Math.max(40 * unit, Math.min(64 * unit, winH * 0.1));
  const padX = Math.max(20 * unit, Math.min(40 * unit, winW * 0.035));
  const padY = Math.max(16 * unit, Math.min(32 * unit, winH * 0.05));

  const rows = buildRows(p.script, fps, p.typeSpeed, p.lineDelay, p.startDelay);
  const prefix = `${p.cwd ? `${p.cwd} ` : ""}${p.prompt} `;
  const maxChars = Math.max(12, ...rows.map((r) => (r.kind === "out" ? r.text.length : prefix.length + r.text.length + 1)));
  const fs = Math.max(16 * unit, Math.min(p.fontSize * unit, (winW - padX * 2) / (maxChars * 0.6)));
  const lineH = fs * 1.55;
  const capacity = Math.max(1, Math.floor((winH - barH - padY * 2) / lineH));

  // --- state at this frame ---------------------------------------------------
  const visible = rows.filter((r) => frame >= r.appear);
  const typing = rows.find((r) => r.kind === "cmd" && frame >= r.appear && frame < r.enter);
  const idle = rows[rows.length - 1];
  // The cursor is solid while keys land and blinks whenever it waits.
  let cursorRow: Row | null = null;
  let solid = false;
  let blinkFrom = 0;
  if (typing) {
    cursorRow = typing;
    const first = typing.chars[0];
    const last = typing.chars[typing.chars.length - 1];
    solid = first !== undefined && last !== undefined && frame >= first - 1 && frame <= last + 1;
    blinkFrom = last !== undefined && frame > last ? last : typing.appear;
  } else if (frame >= idle.appear) {
    cursorRow = idle;
    blinkFrom = idle.appear;
  }
  const cursorOn = solid || Math.floor((frame - blinkFrom) / Math.max(1, Math.round(fps * 0.53))) % 2 === 0;
  let scroll = 0;
  for (let i = capacity; i < visible.length; i++) scroll += lineH * progress(frame, visible[i].appear, 7, "smooth");

  const enter = progress(frame, 0, 18, "smooth");
  const exitP = p.exit ? progress(frame, p.durationInFrames - 13, 12, "ease-in") : 0;
  const outBase = mixColors(p.textColor, p.background, 0.16);
  const bar = mixColors(p.background, "#FFFFFF", 0.045);

  const promptNode = (
    <>
      {p.cwd ? <span style={{ color: p.dimColor }}>{`${p.cwd} `}</span> : null}
      <span style={{ color: p.accentColor, fontWeight: 600 }}>{`${p.prompt} `}</span>
    </>
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        style={{
          position: "absolute",
          left: margin,
          top: margin,
          width: winW,
          height: winH,
          borderRadius: p.radius * unit,
          overflow: "hidden",
          background: p.background,
          border: `${Math.max(1, unit)}px solid rgba(255,255,255,0.1)`,
          boxShadow: `inset 0 ${Math.max(1, unit)}px 0 rgba(255,255,255,0.06), 0 ${44 * unit}px ${110 * unit}px rgba(0,0,0,${(0.55 * p.shadow).toFixed(3)}), 0 ${10 * unit}px ${28 * unit}px rgba(0,0,0,${(0.3 * p.shadow).toFixed(3)})`,
          boxSizing: "border-box",
          opacity: Math.min(1, enter * 1.5) * (1 - exitP),
          transform: `translateY(${((1 - enter) * 44 + exitP * 26) * unit}px) scale(${(0.96 + 0.04 * enter) * (1 - 0.02 * exitP)})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: barH,
            background: bar,
            borderBottom: `${Math.max(1, unit)}px solid rgba(255,255,255,0.06)`,
            display: "flex",
            alignItems: "center",
            padding: `0 ${barH * 0.36}px`,
            boxSizing: "border-box",
          }}
        >
          <TrafficLights size={barH * 0.22} />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              maxWidth: "60%",
              fontFamily: fontStack("Inter"),
              fontWeight: 500,
              fontSize: Math.max(20 * unit, barH * 0.36),
              color: p.dimColor,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {p.title}
          </div>
        </div>
        <div style={{ position: "absolute", left: padX, right: padX, top: barH + padY, bottom: padY, overflow: "hidden" }}>
          <div style={{ transform: `translateY(${(-scroll).toFixed(2)}px)` }}>
            {visible.map((r) => {
              const typed = r.kind === "cmd" ? r.text.slice(0, r.chars.filter((c) => c <= frame).length) : "";
              const appearP = progress(frame, r.appear, 5, "smooth");
              const showCursor = cursorRow?.id === r.id && cursorOn;
              return (
                <div
                  key={r.id}
                  style={{
                    height: lineH,
                    display: "flex",
                    alignItems: "center",
                    fontFamily: mono,
                    fontSize: fs,
                    lineHeight: 1,
                    color: p.textColor,
                    whiteSpace: "pre",
                    opacity: r.kind === "out" ? appearP : 1,
                    transform: r.kind === "out" ? `translateY(${((1 - appearP) * 6 * unit).toFixed(2)}px)` : undefined,
                    fontVariantLigatures: "none",
                  }}
                >
                  {/* One inline run: whitespace-only flex items would be dropped. */}
                  <span style={{ whiteSpace: "pre" }}>
                    {r.kind === "out" ? (
                      <OutText text={r.text} base={outBase} dim={p.dimColor} />
                    ) : (
                      <>
                        {promptNode}
                        {typed}
                      </>
                    )}
                  </span>
                  {showCursor ? (
                    <span
                      style={{
                        display: "inline-block",
                        width: fs * 0.6,
                        height: fs * 1.18,
                        marginLeft: fs * 0.04,
                        background: withAlpha(p.accentColor, 0.9),
                        borderRadius: Math.max(1, fs * 0.06),
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const terminalWindow = defineMotionComponent<Props>({
  id: "terminal-window",
  name: "Terminal window",
  category: "device",
  description:
    "A dark terminal window where commands type out character by character (natural rhythm, block cursor) and their output lines print in a quick stagger, auto-scrolling when full. Lines starting with '$ ' are typed commands, everything else is output (✓ / ✗ / ! / # / URLs get colour). Use for CLI installs, dev tools and API demos — keep lines under ~60 characters.",
  schema: {
    script: {
      type: "text",
      label: "Script",
      default:
        "$ npm create reframer@latest my-video\n✓ Project created in ./my-video\n✓ Installed 214 packages in 3.8s\n$ cd my-video && npm run dev\n→ Editor ready at http://localhost:3000",
      description: "Lines starting with '$ ' are typed; other lines are output",
    },
    title: { type: "string", label: "Title", default: "my-video — zsh" },
    cwd: { type: "string", label: "Directory", default: "~" },
    prompt: { type: "string", label: "Prompt", default: "$" },
    fontFamily: { type: "font", label: "Font", default: "JetBrains Mono" },
    fontSize: { type: "number", label: "Font size", default: 32, min: 16, max: 72, step: 1 },
    typeSpeed: { type: "number", label: "Typing (chars/s)", default: 30, min: 4, max: 120, step: 1 },
    lineDelay: { type: "number", label: "Output stagger (frames)", default: 2, min: 0, max: 20, step: 1 },
    startDelay: { type: "number", label: "Start delay (s)", default: 0.3, min: 0, max: 10, step: 0.05 },
    accentColor: { type: "color", label: "Prompt & cursor", default: "#FFB224" },
    background: { type: "color", label: "Background", default: "#0C0C0E" },
    textColor: { type: "color", label: "Text", default: "#EDEDED" },
    dimColor: { type: "color", label: "Dim text", default: "#7C7C86" },
    radius: { type: "number", label: "Corner radius", default: 18, min: 0, max: 60, step: 1 },
    shadow: { type: "number", label: "Shadow", default: 0.7, min: 0, max: 1, step: 0.05 },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    script:
      "$ npm create reframer@latest my-video\n✓ Project created in ./my-video\n✓ Installed 214 packages in 3.8s\n$ cd my-video && npm run dev\n→ Editor ready at http://localhost:3000",
    title: "my-video — zsh",
    cwd: "~",
    prompt: "$",
    fontFamily: "JetBrains Mono",
    fontSize: 32,
    typeSpeed: 30,
    lineDelay: 2,
    startDelay: 0.3,
    accentColor: "#FFB224",
    background: "#0C0C0E",
    textColor: "#EDEDED",
    dimColor: "#7C7C86",
    radius: 18,
    shadow: 0.7,
    exit: true,
  },
  defaultDuration: 6,
  defaultBox: { x: 0.5, y: 0.5, width: 0.7, height: 0.56 },
  Component: TerminalWindow,
  tags: ["device", "terminal", "cli", "code", "developer", "install", "typing"],
});
