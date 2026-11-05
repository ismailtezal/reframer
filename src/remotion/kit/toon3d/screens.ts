import * as THREE from "three";
import { rng } from "./chars/pen";

/** Canvas-backed screen textures (monitors, the AI's face), redrawn only when their state key changes. */
export class Screen {
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;
  private last = "";
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    const g = this.canvas.getContext("2d");
    if (!g) throw new Error("Screen: this browser has no 2D canvas");
    this.g = g;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }
  draw(key: string, fn: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
    if (key === this.last) return;
    this.last = key;
    this.g.setTransform(1, 0, 0, 1, 0, 0);
    fn(this.g, this.w, this.h);
    this.texture.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Fake but plausible TypeScript, coloured like an editor theme.
const KW = ["const", "let", "export", "async", "function", "return", "await", "if", "import", "new", "type"];
const IDS = ["user", "res", "cache", "items", "order", "token", "config", "payload", "session", "retry", "queue", "result"];
const FNS = ["fetchUser", "normalize", "debounce", "validate", "mapItems", "toJSON", "sync", "parseDate", "retryWith", "hydrate"];
type Tok = { t: string; c: string };
export const codeLine = (i: number): { indent: number; toks: Tok[] } => {
  const r = rng(i * 7919 + 13);
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  const kind = Math.floor(r() * 6);
  const indent = Math.floor(r() * 3);
  const P = "#c9c3e6";
  switch (kind) {
    case 0:
      return {
        indent,
        toks: [
          { t: `${pick(KW)} `, c: "#ff7ab8" },
          { t: pick(IDS), c: "#9fe2ff" },
          { t: " = ", c: P },
          { t: pick(FNS), c: "#ffd76a" },
          { t: `(${pick(IDS)});`, c: P },
        ],
      };
    case 1:
      return {
        indent,
        toks: [
          { t: "if ", c: "#ff7ab8" },
          { t: `(!${pick(IDS)}.ok) `, c: P },
          { t: "throw ", c: "#ff7ab8" },
          { t: "new ", c: "#ff7ab8" },
          { t: "Error", c: "#ffd76a" },
          { t: `("${pick(IDS)}");`, c: "#9df59a" },
        ],
      };
    case 2:
      return {
        indent,
        toks: [
          { t: "export async function ", c: "#ff7ab8" },
          { t: pick(FNS), c: "#ffd76a" },
          { t: `(${pick(IDS)}: `, c: P },
          { t: "string", c: "#7ee0c3" },
          { t: ") {", c: P },
        ],
      };
    case 3:
      return {
        indent,
        toks: [
          { t: "return ", c: "#ff7ab8" },
          { t: `${pick(IDS)}.`, c: "#9fe2ff" },
          { t: pick(FNS), c: "#ffd76a" },
          { t: `(${Math.floor(r() * 100)});`, c: P },
        ],
      };
    case 4:
      return { indent, toks: [{ t: `// TODO: ${pick(["refactor", "edge case", "tests", "cache", "perf"])}`, c: "#7d7a9c" }] };
    default:
      return {
        indent,
        toks: [
          { t: "await ", c: "#ff7ab8" },
          { t: `${pick(IDS)}.`, c: "#9fe2ff" },
          { t: pick(FNS), c: "#ffd76a" },
          { t: `({ ${pick(IDS)}, ${pick(IDS)} });`, c: P },
        ],
      };
  }
};

/** Editor with line numbers; `scroll` in lines (fractional = smooth), `rows` visible rows, `maxChars` reveal cap. */
export const drawCode = (
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  o: { scroll: number; rows: number; first?: number; bg?: string; reveal?: number; cursor?: boolean; dim?: number; gutter?: boolean },
) => {
  g.fillStyle = o.bg ?? "#141a35";
  g.fillRect(0, 0, w, h);
  const lh = h / o.rows;
  const fs = lh * 0.62;
  g.font = `700 ${fs}px 'JetBrains Mono', monospace`;
  g.textBaseline = "middle";
  const base = Math.floor(o.scroll);
  const frac = o.scroll - base;
  const gut = o.gutter === false ? 0 : fs * 2.6;
  for (let k = -1; k <= o.rows + 1; k++) {
    const idx = (o.first ?? 0) + base + k;
    if (idx < 0) continue;
    if (o.reveal !== undefined && idx > o.reveal) break;
    const y = (k - frac + 0.5) * lh;
    if (gut) {
      g.fillStyle = "#4b5078";
      g.textAlign = "right";
      g.fillText(String(idx + 1), gut - fs * 0.6, y);
    }
    g.textAlign = "left";
    const line = codeLine(idx);
    let x = gut + fs * 0.5 + line.indent * fs * 1.2;
    let chars = o.reveal !== undefined && idx === Math.floor(o.reveal) ? Math.floor((o.reveal % 1) * 40) : 999;
    for (const tk of line.toks) {
      if (chars <= 0) break;
      const t = tk.t.slice(0, chars);
      chars -= t.length;
      g.fillStyle = tk.c;
      g.globalAlpha = o.dim ?? 1;
      g.fillText(t, x, y);
      x += g.measureText(t).width;
    }
    g.globalAlpha = 1;
    if (o.cursor && o.reveal !== undefined && idx === Math.floor(o.reveal)) {
      g.fillStyle = "#ffffff";
      g.fillRect(x + 2, y - fs * 0.55, fs * 0.55, fs * 1.1);
    }
  }
};

/** Mehmet's monitor while he can't name a variable: a big-font editor line with the names he tries. */
export const drawNaming = (g: CanvasRenderingContext2D, w: number, h: number, t: number, frame: number) => {
  g.fillStyle = "#141a35";
  g.fillRect(0, 0, w, h);
  const names = ["data", "data2", "temp", "asdf", "x"];
  const seg = 1 / names.length;
  const i = Math.min(names.length - 1, Math.floor(t / seg));
  const local = (t - i * seg) / seg;
  const word = names[i];
  const shown =
    local < 0.55
      ? word.slice(0, Math.ceil((local / 0.55) * word.length))
      : local < 0.85
        ? word
        : word.slice(0, Math.max(0, Math.round((1 - (local - 0.85) / 0.15) * word.length)));
  // centred two-line layout so a portrait insert can crop the screen's sides and keep the joke
  const fs = h * 0.24;
  g.font = `800 ${fs}px 'JetBrains Mono', monospace`;
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.fillStyle = "#ff7ab8";
  g.fillText("const", w / 2, h * 0.3);
  const shownW = g.measureText(shown).width;
  const x0 = w / 2 - Math.max(shownW, fs * 0.6) / 2;
  g.textAlign = "left";
  g.fillStyle = "#9fe2ff";
  g.fillText(shown, x0, h * 0.64);
  if (frame % 16 < 10) {
    g.fillStyle = "#ffffff";
    g.fillRect(x0 + shownW + 6, h * 0.64 - fs * 0.55, fs * 0.5, fs * 1.1);
  }
};

/** A PR review page: header, counts, slowly scrolling diff. */
export const drawPR = (g: CanvasRenderingContext2D, w: number, h: number, scroll: number, n: number) => {
  g.fillStyle = "#f6f7fb";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#24294a";
  g.fillRect(0, 0, w, h * 0.17);
  g.fillStyle = "#ffffff";
  g.font = `800 ${h * 0.085}px 'JetBrains Mono', monospace`;
  g.textBaseline = "middle";
  g.textAlign = "left";
  g.fillText(`PR #${n}`, w * 0.04, h * 0.085);
  g.fillStyle = "#4cd38a";
  g.fillText("+12.408", w * 0.42, h * 0.085);
  g.fillStyle = "#ff6b74";
  g.fillText("−3", w * 0.78, h * 0.085);
  const lh = h * 0.075;
  const r = rng(n);
  for (let k = 0; k < 14; k++) {
    const y = h * 0.2 + k * lh - (scroll % 1) * lh;
    if (y > h) break;
    const add = r() < 0.85;
    g.fillStyle = add ? "#dcf5e4" : "#fde2e4";
    g.fillRect(0, y, w, lh - 3);
    g.fillStyle = add ? "#1f9d55" : "#d9363e";
    g.font = `800 ${lh * 0.62}px 'JetBrains Mono', monospace`;
    g.fillText(add ? "+" : "−", w * 0.02, y + lh / 2);
    g.fillStyle = add ? "#5aa979" : "#c96b72";
    g.fillRect(w * 0.08, y + lh * 0.32, w * (0.2 + r() * 0.6), lh * 0.32);
  }
};

/** The production error: red banner, alarm text, a stack trace. */
export const drawError = (g: CanvasRenderingContext2D, w: number, h: number, frame: number, count = 1) => {
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.5);
  g.fillStyle = `rgb(${120 + pulse * 60},14,30)`;
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `800 ${h * 0.2}px 'Baloo 2', sans-serif`;
  g.fillText(count > 1 ? `${count} HATA` : "HATA", w / 2, h * 0.32);
  g.font = `700 ${h * 0.075}px 'JetBrains Mono', monospace`;
  g.fillStyle = "#ffd0d4";
  g.fillText("500 · production", w / 2, h * 0.52);
  g.textAlign = "left";
  g.font = `600 ${h * 0.05}px 'JetBrains Mono', monospace`;
  g.fillStyle = "rgba(255,220,225,0.75)";
  for (let k = 0; k < 4; k++)
    g.fillText(
      `  at ${["handler", "sync", "retry", "cache"][k]} (src/${["api", "jobs", "lib", "core"][k]}.ts:${41 + k * 17})`,
      w * 0.06,
      h * (0.66 + k * 0.08),
    );
};

export const drawFixed = (g: CanvasRenderingContext2D, w: number, h: number) => {
  g.fillStyle = "#0f6b45";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `800 ${h * 0.42}px 'Baloo 2', sans-serif`;
  g.fillText("✓", w / 2, h * 0.42);
  g.font = `800 ${h * 0.12}px 'Baloo 2', sans-serif`;
  g.fillText("düzeltildi", w / 2, h * 0.78);
};

// ---------------------------------------------------------------------------------------------------------------
export type AIEyes = "neutral" | "happy" | "wide" | "sorry" | "eager" | "closed" | "focus";
export type AIFace = {
  eyes: AIEyes;
  /** mouth open 0..1 (talks with the narrator's voice on its lines) */
  mouth: number;
  smile: number;
  blink: number;
  /** code waterfall behind the face: speed in lines per frame (0 = none) and scroll position */
  code: number;
  scroll: number;
  /** typed text under the eyes (the closing question) and how much of it is shown */
  text?: string;
  textShown?: number;
  cursorOn?: boolean;
  tint: "cyan" | "red" | "green";
  sweat?: number;
  counter?: number;
};

const TINT = { cyan: "#6ff6ff", red: "#ff5a6a", green: "#7dffb0" };
const BG = { cyan: "#0b1433", red: "#2a0712", green: "#06281b" };

/** The AI's screen: a friendly glowing face, a code waterfall behind it, and text when it asks something. */
export const drawAIFace = (g: CanvasRenderingContext2D, w: number, h: number, f: AIFace) => {
  const col = TINT[f.tint];
  g.fillStyle = BG[f.tint];
  g.fillRect(0, 0, w, h);
  if (f.code > 0) {
    drawCode(g, w, h, { scroll: f.scroll, rows: 16, bg: BG[f.tint], dim: 0.42, gutter: false });
    g.fillStyle = `${BG[f.tint]}aa`;
    g.fillRect(0, 0, w, h);
  }
  // scanlines
  g.fillStyle = "rgba(255,255,255,0.035)";
  for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 2);

  const hasText = !!f.text;
  const ey = hasText ? h * 0.3 : h * 0.4;
  const ex = w * 0.17;
  const ew = w * 0.13 * (f.eyes === "wide" || f.eyes === "eager" ? 1.18 : 1);
  const eh = h * (hasText ? 0.26 : 0.33) * (f.eyes === "wide" || f.eyes === "eager" ? 1.12 : 1);
  g.fillStyle = col;
  g.strokeStyle = col;
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const s of [-1, 1]) {
    const x = w / 2 + s * ex;
    const shut = f.eyes === "closed" || f.blink > 0.6;
    if (f.eyes === "happy" && !shut) {
      g.lineWidth = w * 0.035;
      g.beginPath();
      g.moveTo(x - ew * 0.55, ey + eh * 0.12);
      g.quadraticCurveTo(x, ey - eh * 0.55, x + ew * 0.55, ey + eh * 0.12);
      g.stroke();
    } else if (f.eyes === "sorry" && !shut) {
      g.lineWidth = w * 0.032;
      g.beginPath();
      g.moveTo(x - s * ew * 0.5, ey - eh * 0.3);
      g.lineTo(x + s * ew * 0.45, ey);
      g.lineTo(x - s * ew * 0.5, ey + eh * 0.3);
      g.stroke();
    } else if (shut) {
      g.lineWidth = w * 0.03;
      g.beginPath();
      g.moveTo(x - ew * 0.5, ey);
      g.lineTo(x + ew * 0.5, ey);
      g.stroke();
    } else {
      const hh = eh * (1 - f.blink) * (f.eyes === "focus" ? 0.6 : 1);
      g.beginPath();
      g.roundRect(x - ew / 2, ey - hh / 2, ew, hh, ew / 2);
      g.fill();
      if (f.eyes === "eager") {
        g.fillStyle = BG[f.tint];
        g.beginPath();
        g.arc(x - ew * 0.15, ey - hh * 0.2, ew * 0.16, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = col;
      }
    }
  }
  // cheeks
  g.fillStyle = "rgba(255,130,190,0.55)";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(w / 2 + s * w * 0.3, ey + eh * 0.55, w * 0.05, h * 0.03, 0, 0, Math.PI * 2);
    g.fill();
  }
  // mouth
  const my = hasText ? h * 0.5 : h * 0.68;
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = w * 0.03;
  if (f.mouth > 0.06) {
    const mw = w * 0.11;
    const mh = h * (0.05 + 0.14 * f.mouth);
    g.beginPath();
    g.moveTo(w / 2 - mw, my - mh * 0.2);
    g.quadraticCurveTo(w / 2, my - mh * 0.35, w / 2 + mw, my - mh * 0.2);
    g.quadraticCurveTo(w / 2 + mw * 0.8, my + mh, w / 2, my + mh);
    g.quadraticCurveTo(w / 2 - mw * 0.8, my + mh, w / 2 - mw, my - mh * 0.2);
    g.fill();
  } else {
    const mw = w * (0.08 + 0.05 * f.smile);
    g.beginPath();
    g.moveTo(w / 2 - mw, my - h * 0.03 * f.smile);
    g.quadraticCurveTo(w / 2, my + h * 0.09 * f.smile, w / 2 + mw, my - h * 0.03 * f.smile);
    g.stroke();
  }
  if (f.sweat) {
    g.globalAlpha = f.sweat;
    g.fillStyle = "#9fe7ff";
    const sx = w * 0.82;
    const sy = h * 0.18;
    g.beginPath();
    g.moveTo(sx, sy - h * 0.07);
    g.quadraticCurveTo(sx + w * 0.04, sy + h * 0.03, sx, sy + h * 0.05);
    g.quadraticCurveTo(sx - w * 0.04, sy + h * 0.03, sx, sy - h * 0.07);
    g.fill();
    g.globalAlpha = 1;
  }
  if (f.counter !== undefined) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `800 ${h * 0.13}px 'JetBrains Mono', monospace`;
    g.fillStyle = "#ffe066";
    g.fillText(`+${Math.round(f.counter).toLocaleString("tr-TR")} satır`, w / 2, h * 0.88);
  }
  if (hasText && f.text) {
    const shown = f.text.slice(0, Math.round((f.textShown ?? 1) * f.text.length));
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `800 ${h * 0.12}px 'JetBrains Mono', monospace`;
    const full = g.measureText(f.text).width;
    const x0 = w / 2 - full / 2;
    g.textAlign = "left";
    g.fillStyle = "#ffffff";
    g.fillText(shown, x0, h * 0.78);
    if (f.cursorOn) {
      const cx = x0 + g.measureText(shown).width + 6;
      g.fillStyle = col;
      g.fillRect(cx, h * 0.78 - h * 0.065, h * 0.065, h * 0.13);
    }
  }
};
