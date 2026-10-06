import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { withAlpha } from "../../../core/color";
import { fontStack, useFonts } from "../../fonts";
import { progress } from "../helpers";
import { type BoxProps, defineMotionComponent } from "../types";
import { TrafficLights } from "./BrowserWindow";

type Lang = "typescript" | "javascript" | "python";
type Kind = "plain" | "keyword" | "string" | "number" | "comment" | "function" | "type" | "punct" | "property";
type Tok = { text: string; kind: Kind };
type LexState = { block: boolean; template: boolean; triple: string | null };

type Props = {
  code: string;
  language: Lang;
  filename: string;
  theme: "dark" | "light";
  reveal: "lines" | "typewriter" | "none";
  /** frames between lines (lines reveal) */
  stagger: number;
  /** characters per second (typewriter reveal) */
  typeSpeed: number;
  /** 1-based lines, e.g. "3" or "2-4, 7" */
  highlight: string;
  dimOthers: boolean;
  lineNumbers: boolean;
  fontFamily: string;
  fontSize: number;
  accentColor: string;
  radius: number;
  shadow: number;
  exit: boolean;
};

const JS_KEYWORDS = new Set(
  "const let var function return if else for while do switch case break continue new class extends implements interface type enum import from export default async await try catch finally throw typeof instanceof in of as void null undefined true false this super yield static public private protected readonly declare namespace keyof satisfies".split(
    " ",
  ),
);
const PY_KEYWORDS = new Set(
  "def class return if elif else for while in not and or is None True False import from as with try except finally raise lambda yield pass break continue global nonlocal async await del assert match case self".split(
    " ",
  ),
);

type Palette = Record<Kind, string> & { bg: string; bar: string; border: string; gutter: string; dim: string };

const PALETTES: Record<Props["theme"], Palette> = {
  dark: {
    plain: "#E6EDF3",
    keyword: "#FF7B72",
    string: "#A5D6FF",
    number: "#79C0FF",
    comment: "#8B949E",
    function: "#D2A8FF",
    type: "#FFA657",
    punct: "#B1BAC4",
    property: "#C9D1D9",
    bg: "#0E0E11",
    bar: "#16161A",
    border: "rgba(255,255,255,0.09)",
    gutter: "rgba(230,237,243,0.3)",
    dim: "#8B8B95",
  },
  light: {
    plain: "#1F2328",
    keyword: "#CF222E",
    string: "#0A3069",
    number: "#0550AE",
    comment: "#6E7781",
    function: "#8250DF",
    type: "#953800",
    punct: "#57606A",
    property: "#1F2328",
    bg: "#FFFFFF",
    bar: "#F6F8FA",
    border: "rgba(0,0,0,0.1)",
    gutter: "rgba(31,35,40,0.32)",
    dim: "#57606A",
  },
};

const LANG_DOT: Record<Lang, string> = { typescript: "#3178C6", javascript: "#F1E05A", python: "#3572A5" };

/** Index of the closing `quote` (not escaped) at or after `from`, or -1. */
const findClose = (s: string, from: number, quote: string) => {
  for (let i = from; i < s.length; i++) {
    if (s[i] === "\\") i++;
    else if (s.startsWith(quote, i)) return i;
  }
  return -1;
};

/** Small, forgiving tokenizer: enough for keynote-grade code colouring. */
const tokenizeLine = (line: string, lang: Lang, st: LexState): Tok[] => {
  const out: Tok[] = [];
  const push = (text: string, kind: Kind) => {
    if (text) out.push({ text, kind });
  };
  const py = lang === "python";
  let i = 0;
  if (st.block) {
    const end = line.indexOf("*/");
    if (end < 0) return [{ text: line, kind: "comment" }];
    push(line.slice(0, end + 2), "comment");
    i = end + 2;
    st.block = false;
  } else if (st.template) {
    const end = findClose(line, 0, "`");
    if (end < 0) return [{ text: line, kind: "string" }];
    push(line.slice(0, end + 1), "string");
    i = end + 1;
    st.template = false;
  } else if (st.triple) {
    const end = line.indexOf(st.triple);
    if (end < 0) return [{ text: line, kind: "string" }];
    push(line.slice(0, end + 3), "string");
    i = end + 3;
    st.triple = null;
  }
  while (i < line.length) {
    const rest = line.slice(i);
    const take = (re: RegExp) => rest.match(re)?.[0] ?? null;
    if ((!py && rest.startsWith("//")) || (py && rest.startsWith("#"))) {
      push(rest, "comment");
      break;
    }
    if (!py && rest.startsWith("/*")) {
      const end = rest.indexOf("*/", 2);
      if (end < 0) {
        push(rest, "comment");
        st.block = true;
        break;
      }
      push(rest.slice(0, end + 2), "comment");
      i += end + 2;
      continue;
    }
    const triple = py ? take(/^[rRbBfFuU]{0,2}("""|''')/) : null;
    if (triple) {
      const q = triple.slice(-3);
      const end = rest.indexOf(q, triple.length);
      if (end < 0) {
        push(rest, "string");
        st.triple = q;
        break;
      }
      push(rest.slice(0, end + 3), "string");
      i += end + 3;
      continue;
    }
    if (!py && rest[0] === "`") {
      const end = findClose(rest, 1, "`");
      if (end < 0) {
        push(rest, "string");
        st.template = true;
        break;
      }
      push(rest.slice(0, end + 1), "string");
      i += end + 1;
      continue;
    }
    const str = take(py ? /^[rRbBfFuU]{0,2}("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)/ : /^("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)/);
    if (str) {
      push(str, "string");
      i += str.length;
      continue;
    }
    const num = /[\w$]/.test(line[i - 1] ?? "") ? null : take(/^(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?n?)/);
    if (num) {
      push(num, "number");
      i += num.length;
      continue;
    }
    const deco = take(/^@[\w.]+/);
    if (deco) {
      push(deco, "function");
      i += deco.length;
      continue;
    }
    const word = take(/^[A-Za-z_$][\w$]*/);
    if (word) {
      const after = line.slice(i + word.length);
      const before = line.slice(0, i).trimEnd();
      const call = /^\s*(<[^>]*>)?\s*\(/.test(after);
      let kind: Kind = "plain";
      if ((py ? PY_KEYWORDS : JS_KEYWORDS).has(word)) kind = "keyword";
      else if (before.endsWith(".")) kind = call ? "function" : "property";
      else if (call) kind = "function";
      else if (/^[A-Z]/.test(word)) kind = "type";
      else if (!py && /^\s*\??:/.test(after) && /[{,(]\s*$/.test(before)) kind = "property";
      push(word, kind);
      i += word.length;
      continue;
    }
    const space = take(/^\s+/);
    if (space) {
      push(space, "plain");
      i += space.length;
      continue;
    }
    push(rest[0], "punct");
    i += 1;
  }
  return out;
};

/** "2-4, 7" → {2,3,4,7} */
const parseLines = (spec: string): Set<number> => {
  const set = new Set<number>();
  for (const part of spec.split(/[,\s]+/)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2] ?? m[1]);
    for (let k = Math.min(a, b); k <= Math.max(a, b) && k - Math.min(a, b) < 500; k++) set.add(k);
  }
  return set;
};

const CodeWindow: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  useFonts([
    { family: p.fontFamily, weight: 400 },
    { family: "Inter", weight: 500 },
  ]);
  const mono = fontStack(p.fontFamily);
  const pal = PALETTES[p.theme];
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const margin = Math.min(w, h) * 0.04;
  const winW = w - margin * 2;
  const winH = h - margin * 2;
  const barH = Math.max(40 * unit, Math.min(64 * unit, winH * 0.1));
  const padY = Math.max(16 * unit, Math.min(36 * unit, winH * 0.05));
  const padX = Math.max(18 * unit, Math.min(36 * unit, winW * 0.03));

  const lines = p.code.replace(/\t/g, "  ").replace(/\s+$/, "").split("\n");
  const st: LexState = { block: false, template: false, triple: null };
  const tokens = lines.map((l) => tokenizeLine(l, p.language, st));
  const digits = String(lines.length).length;
  const gutterCh = p.lineNumbers ? digits + 2 : 0;
  const maxLen = Math.max(16, ...lines.map((l) => l.length));
  const contentH = winH - barH - padY * 2;
  const fs = Math.max(
    16 * unit,
    Math.min(p.fontSize * unit, (winW - padX * 2) / ((maxLen + gutterCh + 1) * 0.6), contentH / (Math.min(lines.length, 18) * 1.6)),
  );
  const lineH = fs * 1.6;
  const capacity = Math.max(1, Math.floor(contentH / lineH));

  // --- reveal timing -------------------------------------------------------------
  const t0 = 14;
  const lineStart: number[] = [];
  const charTimes: number[][] = [];
  let doneAt = t0;
  if (p.reveal === "typewriter") {
    const fpc = fps / Math.max(1, p.typeSpeed);
    let t = t0;
    for (const l of lines) {
      lineStart.push(t);
      const indent = l.length - l.trimStart().length;
      const times: number[] = [];
      for (let k = 0; k < l.length; k++) {
        if (k >= indent) t += fpc;
        times.push(t);
      }
      charTimes.push(times);
      t += fpc * 4;
    }
    doneAt = t;
  } else {
    lines.forEach((_, i) => {
      lineStart.push(p.reveal === "none" ? 0 : t0 + i * Math.max(0, p.stagger));
      charTimes.push([]);
    });
    doneAt = p.reveal === "none" ? 0 : t0 + (lines.length - 1) * Math.max(0, p.stagger) + 14;
  }

  const hiSet = parseLines(p.highlight);
  const hp = hiSet.size > 0 ? progress(frame, doneAt + 6, 18, "smooth") : 0;
  let scroll = 0;
  for (let i = capacity; i < lines.length; i++) scroll += lineH * progress(frame, lineStart[i], 10, "smooth");

  // Typewriter caret position.
  let caretLine = -1;
  let caretCol = 0;
  if (p.reveal === "typewriter") {
    for (let i = 0; i < lines.length; i++) {
      if (frame >= lineStart[i]) {
        caretLine = i;
        caretCol = charTimes[i].filter((c) => c <= frame).length;
      }
    }
  }
  const typingNow = p.reveal === "typewriter" && frame < doneAt;
  const caretOn = typingNow || Math.floor((frame - doneAt) / Math.max(1, Math.round(fps * 0.53))) % 2 === 0;

  const enter = progress(frame, 0, 18, "smooth");
  const exitP = p.exit ? progress(frame, p.durationInFrames - 13, 12, "ease-in") : 0;

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
          background: pal.bg,
          border: `${Math.max(1, unit)}px solid ${pal.border}`,
          boxShadow: `0 ${44 * unit}px ${110 * unit}px rgba(0,0,0,${(0.5 * p.shadow).toFixed(3)}), 0 ${10 * unit}px ${28 * unit}px rgba(0,0,0,${(0.28 * p.shadow).toFixed(3)})`,
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
            background: pal.bar,
            borderBottom: `${Math.max(1, unit)}px solid ${pal.border}`,
            display: "flex",
            alignItems: "center",
            padding: `0 ${barH * 0.36}px`,
            boxSizing: "border-box",
          }}
        >
          <TrafficLights size={barH * 0.22} mono={p.theme === "light"} monoColor="rgba(0,0,0,0.16)" />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
              gap: barH * 0.18,
              fontFamily: fontStack("Inter"),
              fontWeight: 500,
              fontSize: Math.max(20 * unit, barH * 0.36),
              color: pal.dim,
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ width: barH * 0.16, height: barH * 0.16, borderRadius: "50%", background: LANG_DOT[p.language] }} />
            {p.filename}
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: barH + padY, bottom: padY, overflow: "hidden" }}>
          <div style={{ transform: `translateY(${(-scroll).toFixed(2)}px)` }}>
            {tokens.map((toks, i) => {
              const ln = i + 1;
              const lineP = p.reveal === "lines" ? progress(frame, lineStart[i], 14, "smooth") : 1;
              const isHi = hiSet.has(ln);
              const dim = hiSet.size > 0 && p.dimOthers && !isHi ? 0.58 * hp : 0;
              let budget =
                p.reveal === "typewriter"
                  ? frame >= lineStart[i]
                    ? charTimes[i].filter((c) => c <= frame).length
                    : -1
                  : Number.POSITIVE_INFINITY;
              if (budget < 0) return <div key={`ln${ln}`} style={{ height: lineH }} />;
              const spans: React.ReactNode[] = [];
              let col = 0;
              for (const t of toks) {
                if (budget <= 0) break;
                const text = t.text.slice(0, budget);
                budget -= text.length;
                spans.push(
                  <span key={`c${col}`} style={{ color: pal[t.kind], fontStyle: t.kind === "comment" ? "italic" : undefined }}>
                    {text}
                  </span>,
                );
                col += text.length;
              }
              return (
                <div
                  key={`ln${ln}`}
                  style={{
                    position: "relative",
                    height: lineH,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: padX,
                    paddingRight: padX,
                    fontFamily: mono,
                    fontSize: fs,
                    lineHeight: 1,
                    whiteSpace: "pre",
                    fontVariantLigatures: "none",
                    opacity: lineP,
                    transform: lineP < 1 ? `translateY(${((1 - lineP) * 10 * unit).toFixed(2)}px)` : undefined,
                  }}
                >
                  {isHi ? (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: `linear-gradient(90deg, ${withAlpha(p.accentColor, 0.17)} 0%, ${withAlpha(p.accentColor, 0.07)} 70%, ${withAlpha(p.accentColor, 0.04)} 100%)`,
                          transform: `scaleX(${hp})`,
                          transformOrigin: "0% 50%",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: Math.max(2, 3 * unit),
                          background: p.accentColor,
                          opacity: hp,
                        }}
                      />
                    </>
                  ) : null}
                  {p.lineNumbers ? (
                    <span
                      style={{
                        position: "relative",
                        display: "inline-block",
                        width: `${digits * 0.6 + 1.2}em`,
                        flexShrink: 0,
                        textAlign: "right",
                        paddingRight: "1.2em",
                        boxSizing: "content-box",
                        color: isHi && hp > 0 ? withAlpha(p.accentColor, 0.5 + 0.5 * hp) : pal.gutter,
                        opacity: 1 - dim * 0.6,
                      }}
                    >
                      {ln}
                    </span>
                  ) : null}
                  <span style={{ position: "relative", opacity: 1 - dim }}>
                    {spans}
                    {p.reveal === "typewriter" && caretLine === i && caretCol === col && caretOn ? (
                      <span
                        style={{
                          display: "inline-block",
                          width: Math.max(2, fs * 0.09),
                          height: fs * 1.25,
                          marginLeft: fs * 0.02,
                          verticalAlign: "middle",
                          background: p.accentColor,
                          borderRadius: fs * 0.05,
                        }}
                      />
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const codeWindow = defineMotionComponent<Props>({
  id: "code-window",
  name: "Code window",
  category: "device",
  description:
    "An editor window with line numbers and syntax colouring (JS/TS/Python) whose code reveals line by line or types out with a caret; then the highlighted lines get an accent band while the rest dims, to point at the important bit. Use for SDK/API snippets and dev-tool launches — keep it under ~16 lines and ~60 columns.",
  schema: {
    code: {
      type: "text",
      label: "Code",
      default:
        '// Animate anything, frame by frame\nimport { interpolate, useCurrentFrame } from "remotion";\n\nexport function useFadeIn(delay = 0) {\n  const frame = useCurrentFrame();\n  return interpolate(frame - delay, [0, 20], [0, 1], {\n    extrapolateRight: "clamp",\n  });\n}',
    },
    language: { type: "enum", label: "Language", default: "typescript", options: ["typescript", "javascript", "python"] },
    filename: { type: "string", label: "File name", default: "use-fade-in.ts" },
    theme: { type: "enum", label: "Theme", default: "dark", options: ["dark", "light"] },
    reveal: { type: "enum", label: "Reveal", default: "lines", options: ["lines", "typewriter", "none"] },
    stagger: { type: "number", label: "Line stagger (frames)", default: 3, min: 0, max: 12, step: 1 },
    typeSpeed: { type: "number", label: "Typing (chars/s)", default: 40, min: 5, max: 200, step: 1 },
    highlight: { type: "string", label: "Highlight lines", default: "6-8", description: "e.g. 3 or 2-4, 7 (empty = none)" },
    dimOthers: { type: "boolean", label: "Dim other lines", default: true },
    lineNumbers: { type: "boolean", label: "Line numbers", default: true },
    fontFamily: { type: "font", label: "Font", default: "JetBrains Mono" },
    fontSize: { type: "number", label: "Font size", default: 32, min: 14, max: 64, step: 1 },
    accentColor: { type: "color", label: "Accent", default: "#FFB224" },
    radius: { type: "number", label: "Corner radius", default: 18, min: 0, max: 60, step: 1 },
    shadow: { type: "number", label: "Shadow", default: 0.7, min: 0, max: 1, step: 0.05 },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    code: '// Animate anything, frame by frame\nimport { interpolate, useCurrentFrame } from "remotion";\n\nexport function useFadeIn(delay = 0) {\n  const frame = useCurrentFrame();\n  return interpolate(frame - delay, [0, 20], [0, 1], {\n    extrapolateRight: "clamp",\n  });\n}',
    language: "typescript",
    filename: "use-fade-in.ts",
    theme: "dark",
    reveal: "lines",
    stagger: 3,
    typeSpeed: 40,
    highlight: "6-8",
    dimOthers: true,
    lineNumbers: true,
    fontFamily: "JetBrains Mono",
    fontSize: 32,
    accentColor: "#FFB224",
    radius: 18,
    shadow: 0.7,
    exit: true,
  },
  defaultDuration: 6,
  defaultBox: { x: 0.5, y: 0.5, width: 0.74, height: 0.62 },
  Component: CodeWindow,
  tags: ["device", "code", "editor", "developer", "sdk", "api", "syntax"],
});
