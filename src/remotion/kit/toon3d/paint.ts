import * as THREE from "three";
import { rng } from "./chars/pen";

/**
 * Painted textures, all drawn in code: flat colour fields with thin painted lines (plank seams, key gaps), never
 * photo detail. Text uses the self-hosted fonts loaded before the first frame.
 */
export const canvasTex = (
  w: number,
  h: number,
  paint: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { repeat?: [number, number]; srgb?: boolean } = {},
) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvasTex: this browser has no 2D canvas");
  paint(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...opts.repeat);
  }
  return t;
};

const hsl = (h: number, s: number, l: number) => `hsl(${h},${s}%,${l}%)`;

/** Warm oak planks: 4 m square tile, boards 0.2 m wide, staggered end joints, soft grain, thin dark seams. */
export const woodFloor = () =>
  canvasTex(
    1024,
    1024,
    (g, w, h) => {
      const r = rng(7);
      const boards = 20;
      const bw = w / boards;
      for (let i = 0; i < boards; i++) {
        let y = -r() * 300;
        while (y < h) {
          const len = 260 + r() * 340;
          g.fillStyle = hsl(30 + r() * 6, 52 + r() * 10, 66 + r() * 7);
          g.fillRect(i * bw, y, bw, len);
          // grain
          g.globalAlpha = 0.09;
          for (let k = 0; k < 5; k++) {
            g.fillStyle = hsl(26, 50, 45);
            const gx = i * bw + 6 + r() * (bw - 12);
            g.fillRect(gx, y + r() * 30, 1.5 + r() * 2, len * (0.5 + r() * 0.5));
          }
          g.globalAlpha = 1;
          // end joint
          g.fillStyle = "rgba(90,52,30,0.55)";
          g.fillRect(i * bw, y + len - 2, bw, 3);
          y += len;
        }
        g.fillStyle = "rgba(90,52,30,0.6)";
        g.fillRect(i * bw, 0, 2.5, h);
      }
    },
    { repeat: [8, 6] },
  );

/** A soft carpet/rug tile. */
export const rug = (base: string, stripe: string) =>
  canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = stripe;
    g.lineWidth = 26;
    g.strokeRect(30, 30, w - 60, h - 60);
    g.lineWidth = 8;
    g.strokeRect(70, 70, w - 140, h - 140);
  });

/** Plain painted wall with a faint roller texture. */
export const wallPaint = (base: string, seed = 1) =>
  canvasTex(
    512,
    512,
    (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 0.035;
      for (let i = 0; i < 260; i++) {
        g.fillStyle = r() > 0.5 ? "#ffffff" : "#000000";
        g.fillRect(r() * w, r() * h, 20 + r() * 60, 2 + r() * 3);
      }
      g.globalAlpha = 1;
    },
    { repeat: [4, 1] },
  );

export type SkyMode = "morning" | "night" | "dawn";
/**
 * The city outside the windows: a saturated gradient sky, layered skyline silhouettes with window grids (lit at
 * night), a sun glow or a moon. Drawn once per mode; the backdrop plane is unlit, so it reads like real daylight.
 */
export const skyline = (mode: SkyMode) =>
  canvasTex(2048, 1024, (g, w, h) => {
    const r = rng(mode === "night" ? 31 : mode === "dawn" ? 47 : 19);
    const sky = g.createLinearGradient(0, 0, 0, h);
    if (mode === "morning") {
      sky.addColorStop(0, "#4f8fe0");
      sky.addColorStop(0.45, "#8fc0f0");
      sky.addColorStop(0.72, "#ffe2b8");
      sky.addColorStop(1, "#ffd39a");
    } else if (mode === "night") {
      sky.addColorStop(0, "#0d0f2e");
      sky.addColorStop(0.5, "#24215a");
      sky.addColorStop(0.78, "#4b2f72");
      sky.addColorStop(1, "#7a3f7c");
    } else {
      sky.addColorStop(0, "#5a63b8");
      sky.addColorStop(0.42, "#c58bbd");
      sky.addColorStop(0.7, "#ffb08a");
      sky.addColorStop(1, "#ffd59a");
    }
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    if (mode === "night") {
      for (let i = 0; i < 220; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`;
        const s = r() < 0.1 ? 3 : 1.6;
        g.fillRect(r() * w, r() * h * 0.55, s, s);
      }
      const mg = g.createRadialGradient(1500, 210, 10, 1500, 210, 220);
      mg.addColorStop(0, "rgba(255,244,214,0.9)");
      mg.addColorStop(0.25, "rgba(200,190,255,0.25)");
      mg.addColorStop(1, "rgba(120,110,200,0)");
      g.fillStyle = mg;
      g.fillRect(1200, 0, 600, 500);
      g.fillStyle = "#fff6dc";
      g.beginPath();
      g.arc(1500, 210, 58, 0, Math.PI * 2);
      g.fill();
    } else {
      const sx = mode === "dawn" ? 620 : 1450;
      const sy = mode === "dawn" ? 760 : 420;
      const sg = g.createRadialGradient(sx, sy, 10, sx, sy, 520);
      sg.addColorStop(0, mode === "dawn" ? "rgba(255,236,190,0.95)" : "rgba(255,250,230,0.9)");
      sg.addColorStop(1, "rgba(255,220,180,0)");
      g.fillStyle = sg;
      g.fillRect(0, 0, w, h);
      // soft clouds
      for (let i = 0; i < 9; i++) {
        const cx = r() * w;
        const cy = 120 + r() * 380;
        g.fillStyle = mode === "dawn" ? "rgba(255,190,190,0.55)" : "rgba(255,255,255,0.7)";
        for (let k = 0; k < 5; k++) {
          g.beginPath();
          g.ellipse(cx + k * 46 - 90, cy + Math.sin(k * 2.1) * 10, 70 + r() * 40, 26 + r() * 14, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // three skyline layers, far (hazy) to near
    const layers =
      mode === "night"
        ? ["#3a2f6e", "#2a2456", "#1c1a40"]
        : mode === "dawn"
          ? ["#b48ab8", "#8e6aa4", "#6c4f8c"]
          : ["#9fb9df", "#7d9bc9", "#5f7fb5"];
    layers.forEach((col, li) => {
      let x = -20;
      while (x < w) {
        const bw = 60 + r() * 140;
        const bh = 140 + r() * (260 - li * 40) + li * 30;
        const top = h - bh - li * 30 + 40;
        g.fillStyle = col;
        g.fillRect(x, top, bw, h - top);
        if (r() < 0.25) g.fillRect(x + bw * 0.4, top - 40, 8, 40);
        // windows
        const lit = mode === "night" ? 0.45 : mode === "dawn" ? 0.2 : 0.0;
        for (let wy = top + 14; wy < h - 10; wy += 22) {
          for (let wx = x + 10; wx < x + bw - 12; wx += 18) {
            if (r() < lit) {
              g.fillStyle = r() < 0.7 ? "#ffd27a" : "#9fe7ff";
              g.fillRect(wx, wy, 8, 11);
            } else if (mode !== "night") {
              g.fillStyle = "rgba(255,255,255,0.12)";
              g.fillRect(wx, wy, 8, 11);
            }
          }
        }
        x += bw + r() * 12;
      }
    });
  });

/** A desk keyboard: dark keys on a light body. */
export const keyboardTex = () =>
  canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = "#d9dbe6";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3a3f55";
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 15; col++) {
        const kw = row === 4 && col > 4 && col < 10 ? 0 : 28;
        if (!kw) continue;
        g.fillRect(14 + col * 32.5, 12 + row * 28.5, kw, 22);
      }
    }
    g.fillRect(14 + 5 * 32.5, 12 + 4 * 28.5, 5 * 32.5 - 4, 22);
  });

/** Clock face with Arabic numerals. */
export const clockFace = () =>
  canvasTex(512, 512, (g, w) => {
    g.fillStyle = "#fffaf0";
    g.beginPath();
    g.arc(w / 2, w / 2, w / 2 - 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2a1c38";
    g.font = "800 64px 'Baloo 2', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      g.fillText(String(i), w / 2 + Math.cos(a) * 190, w / 2 + Math.sin(a) * 190 + 4);
    }
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const r0 = i % 5 ? 236 : 226;
      g.fillRect(w / 2 + Math.cos(a) * r0 - 2, w / 2 + Math.sin(a) * r0 - 2, 4, 4);
    }
  });

/** The rolling whiteboard: this month's target, a rocket chart. */
export const whiteboardTex = () =>
  canvasTex(1024, 640, (g, w, h) => {
    g.fillStyle = "#fbfbf7";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#e4483b";
    g.font = "800 110px 'Baloo 2', sans-serif";
    g.textAlign = "left";
    g.textBaseline = "top";
    g.fillText("HEDEF:", 60, 40);
    g.fillStyle = "#2d4a8f";
    g.font = "800 190px 'Baloo 2', sans-serif";
    g.fillText("10x", 470, 0);
    // chart
    g.strokeStyle = "#2a1c38";
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(80, 240);
    g.lineTo(80, 580);
    g.lineTo(940, 580);
    g.stroke();
    g.strokeStyle = "#20a67a";
    g.lineWidth = 14;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(110, 560);
    g.lineTo(380, 530);
    g.lineTo(560, 470);
    g.lineTo(700, 360);
    g.quadraticCurveTo(820, 250, 880, 230);
    g.stroke();
    // rocket at the tip
    g.save();
    g.translate(890, 230);
    g.rotate(-0.8);
    g.fillStyle = "#ff7a3d";
    g.beginPath();
    g.moveTo(0, -60);
    g.quadraticCurveTo(28, -10, 20, 40);
    g.lineTo(-20, 40);
    g.quadraticCurveTo(-28, -10, 0, -60);
    g.fill();
    g.fillStyle = "#ffd23f";
    g.beginPath();
    g.moveTo(-14, 44);
    g.lineTo(0, 84);
    g.lineTo(14, 44);
    g.fill();
    g.restore();
    g.fillStyle = "#8a8fa8";
    g.font = "600 40px 'Baloo 2', sans-serif";
    g.fillText("Q4 · velocity", 110, 600 - 18);
    void h;
  });

/** Neon sign: glowing tubes on transparency (drawn twice: soft halo + bright core). */
export const neonTex = (text: string, color: string) =>
  canvasTex(1024, 384, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "800 230px 'JetBrains Mono', monospace";
    g.lineJoin = "round";
    g.strokeStyle = color;
    g.lineWidth = 34;
    g.globalAlpha = 0.25;
    g.strokeText(text, w / 2, h / 2);
    g.globalAlpha = 1;
    g.lineWidth = 16;
    g.strokeText(text, w / 2, h / 2);
    g.strokeStyle = "#ffffff";
    g.lineWidth = 6;
    g.strokeText(text, w / 2, h / 2);
  });

/** Abstract poster (no words): bold shapes in the office palette. */
export const posterTex = (seed: number) =>
  canvasTex(384, 512, (g, w, h) => {
    const r = rng(seed);
    const pal = ["#ef6f5b", "#f0b43c", "#3aa8a0", "#5a63b8", "#f6e7d0", "#ff9fb2"];
    g.fillStyle = pal[Math.floor(r() * pal.length)];
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = pal[Math.floor(r() * pal.length)];
      g.beginPath();
      if (r() < 0.5) g.arc(r() * w, r() * h, 50 + r() * 120, 0, Math.PI * 2);
      else g.rect(r() * w * 0.7, r() * h * 0.7, 80 + r() * 160, 80 + r() * 160);
      g.fill();
    }
    g.strokeStyle = "#fffaf0";
    g.lineWidth = 18;
    g.strokeRect(9, 9, w - 18, h - 18);
  });

/** Spines of a tall stack of programming books (Mehmet's ten years). */
export const bookSpine = (seed: number) =>
  canvasTex(256, 64, (g, w, h) => {
    const r = rng(seed);
    const cols = ["#d9483b", "#3a6fc4", "#2e9e7a", "#e8a33c", "#7b5ac9", "#3f4a63"];
    g.fillStyle = cols[seed % cols.length];
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.fillRect(20, h * 0.36, 110 + r() * 80, h * 0.26);
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(0, 0, w, 5);
    g.fillRect(0, h - 5, w, 5);
  });

/** PR document (top of a slab): header, +/- counts, coloured diff lines. */
export const prDocTex = (seed: number) =>
  canvasTex(512, 352, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = "#fbfaf6";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#2a1c38";
    g.font = "800 46px 'JetBrains Mono', monospace";
    g.textBaseline = "top";
    g.fillText(`PR #${3000 + Math.floor(r() * 6999)}`, 26, 22);
    g.font = "800 34px 'JetBrains Mono', monospace";
    g.fillStyle = "#1f9d55";
    const plus = 200 + Math.floor(r() * 9800);
    g.fillText(`+${plus.toLocaleString("tr-TR")}`, 28, 82);
    g.fillStyle = "#d9363e";
    g.fillText(`−${Math.floor(r() * 90)}`, 300, 82);
    for (let i = 0; i < 9; i++) {
      const add = r() < 0.75;
      g.fillStyle = add ? "rgba(46,170,98,0.22)" : "rgba(217,54,62,0.2)";
      g.fillRect(20, 136 + i * 22, w - 40, 18);
      g.fillStyle = add ? "#2a9a5c" : "#c93a43";
      g.fillRect(30, 141 + i * 22, 40 + r() * (w - 140), 8);
    }
    g.strokeStyle = "#2a1c38";
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6);
  });

/** Paper edge for slab sides: stacked sheets. */
export const paperEdgeTex = () =>
  canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = "#f4f1e8";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(120,110,140,0.35)";
    for (let y = 4; y < h; y += 7) g.fillRect(0, y, w, 1.5);
    g.fillStyle = "#38c172";
    g.fillRect(0, 0, 18, h);
  });
