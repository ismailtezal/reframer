import type React from "react";
import { useId } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { random01 } from "../../components/helpers";
import { useClipBox } from "../../context";
import type { Mood, Pose } from "./Critter";
import { mix, Shade, tone } from "./shade";

/**
 * A simple, appealing flat-vector person (round head, soft body, short legs, dot eyes) with the
 * same acting controls as <Critter>: look, blink, mood, poses, talk, squash, lift and lean.
 * Local units: 100 = height from the feet (y = 0) to the top of the head; children draw in them.
 */

export type HairStyle = "short" | "long" | "bun" | "curly" | "side" | "bald" | "spiky";

export type PersonProps = {
  /** Feet position in px of the clip box. */
  x: number;
  y: number;
  /** Height in px. Main characters 300–600 px at 1080p; crowd members ≥ 120 px. */
  size: number;
  skin?: string;
  hair?: HairStyle;
  hairColor?: string;
  shirt?: string;
  pants?: string;
  /** A jacket over the shirt (suits, uniforms). */
  jacket?: string;
  tie?: string;
  mustache?: boolean;
  beard?: boolean;
  glasses?: boolean;
  /** Body width factor (0.8 slim … 1.35 broad). */
  build?: number;
  look?: { x: number; y: number };
  mood?: Mood;
  pose?: Pose;
  arms?: { left?: number; right?: number };
  squash?: number;
  lift?: number;
  lean?: number;
  talk?: number;
  eyesClosed?: number;
  flip?: boolean;
  seed?: number;
  /** Bigger, more expressive eyes for a main character. */
  hero?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

const INK = "#1f1530";

const POSES: Record<Pose, { left: number; right: number }> = {
  idle: { left: 8, right: 8 },
  wave: { left: 8, right: 150 },
  cheer: { left: 160, right: 160 },
  point: { left: 8, right: 90 },
  shrug: { left: 55, right: 55 },
  hold: { left: 40, right: 40 },
};

const blink = (frame: number, seed: number) => {
  const period = 100;
  const n = Math.floor(frame / period);
  let c = 0;
  for (const k of [n - 1, n]) {
    const t0 = k * period + 10 + random01(seed * 211 + k) * 75;
    const d = Math.abs(frame - t0);
    if (d < 3) c = Math.max(c, 1 - d / 3);
  }
  return c;
};

export const Person: React.FC<PersonProps> = ({
  x,
  y,
  size,
  skin = "#f2c6a0",
  hair = "short",
  hairColor = "#3b2a26",
  shirt = "#4f8cff",
  pants = "#2d3557",
  jacket,
  tie,
  mustache = false,
  beard = false,
  glasses = false,
  build = 1,
  look = { x: 0, y: 0 },
  mood = "neutral",
  pose = "idle",
  arms,
  squash = 0,
  lift = 0,
  lean = 0,
  talk = 0,
  eyesClosed,
  flip = false,
  seed = 1,
  hero = false,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const k = size / 100;
  const breath = 0.02 * Math.sin(((frame + seed * 13) / 64) * Math.PI * 2);
  const q = Math.max(-0.9, Math.min(0.9, squash + breath)) * 0.2;
  const sx = 1 + q;
  const sy = 1 / (1 + q);
  const base = POSES[pose];
  const wave = pose === "wave" ? 22 * Math.sin((frame / 7) * Math.PI) : 0;
  const armL = (arms?.left ?? base.left) + 2.5 * Math.sin((frame + seed * 29) / 25);
  const armR = (arms?.right ?? base.right) + wave + 2.5 * Math.sin((frame + seed * 37) / 21);
  const closed = Math.max(eyesClosed ?? 0, blink(frame, seed), mood === "sleepy" ? 0.6 : 0);
  const fx = flip ? -1 : 1;
  const lx = Math.max(-1, Math.min(1, look.x)) * fx;
  const ly = Math.max(-1, Math.min(1, look.y));
  const w = build;
  const headY = -84;
  const headR = 13.5;
  const eyeR = hero ? 3.6 : 2.2;
  const eyeY = headY + 0.5;
  const sw = 17 * w; // half shoulder width
  const hw = 15 * w; // half hip width
  const top = jacket ?? shirt;
  const hairDark = tone(hairColor, -0.15);
  const air = Math.min(1, lift / (size * 0.5));

  const arm = (side: -1 | 1, angle: number) => {
    const ax = side * (sw - 3.5);
    const ay = -67;
    return (
      <g key={side} transform={`rotate(${side === 1 ? -angle : angle} ${ax} ${ay})`}>
        <rect x={ax - 4} y={ay - 3} width={8} height={30} rx={4} fill={top} />
        <circle cx={ax} cy={ay + 29} r={4.4} fill={skin} />
      </g>
    );
  };

  const hairBack = () => {
    if (hair === "long")
      return (
        <path
          d={`M -15 ${headY - 2} Q -16 ${headY + 22} -12 ${headY + 26} L 12 ${headY + 26} Q 16 ${headY + 22} 15 ${headY - 2} Z`}
          fill={hairDark}
        />
      );
    if (hair === "bun") return <circle cx={0} cy={headY - 15} r={7.5} fill={hairColor} />;
    return null;
  };

  const hairFront = () => {
    const capTop = headY - headR - 1.5;
    switch (hair) {
      case "short":
      case "long":
      case "bun":
        return (
          <path
            d={`M -14.2 ${headY + 1} Q -15 ${capTop} 0 ${capTop} Q 15 ${capTop} 14.2 ${headY + 1} Q 9 ${headY - 7} 2 ${headY - 6} Q -6 ${headY - 9} -14.2 ${headY + 1} Z`}
            fill={hairColor}
          />
        );
      case "curly":
        return (
          <g fill={hairColor}>
            {[-11, -5.5, 0, 5.5, 11].map((cx, i) => (
              <circle key={cx} cx={cx} cy={headY - 10 + Math.abs(cx) * 0.35 - (i % 2) * 1.5} r={6} />
            ))}
          </g>
        );
      case "side":
        return (
          <g fill={hairColor}>
            <path d={`M -14.5 ${headY + 3} Q -15 ${headY - 9} -9 ${headY - 9} L -11 ${headY + 4} Z`} />
            <path d={`M 14.5 ${headY + 3} Q 15 ${headY - 9} 9 ${headY - 9} L 11 ${headY + 4} Z`} />
          </g>
        );
      case "spiky":
        return (
          <path
            d={`M -14 ${headY - 2} L -12 ${capTop - 3} L -6 ${capTop + 1} L -2 ${capTop - 5} L 3 ${capTop} L 8 ${capTop - 4} L 11 ${capTop + 2} L 14 ${headY - 2} Q 0 ${headY - 9} -14 ${headY - 2} Z`}
            fill={hairColor}
          />
        );
      default:
        return null;
    }
  };

  const brows = () => {
    if (mood === "neutral" || mood === "happy" || mood === "sleepy") return null;
    const tilt = mood === "angry" ? 18 : mood === "surprised" ? 0 : -15;
    const yy = eyeY - (hero ? 6.5 : 5) - (mood === "surprised" ? 2 : 0);
    return [-1, 1].map((s) => (
      <line
        key={s}
        x1={s * 5.2 - 2.6}
        y1={yy}
        x2={s * 5.2 + 2.6}
        y2={yy}
        stroke={INK}
        strokeWidth={1.5}
        strokeLinecap="round"
        transform={`rotate(${s * tilt} ${s * 5.2} ${yy})`}
      />
    ));
  };

  const mouth = () => {
    const my = headY + 7;
    if (talk > 0.02) return <ellipse cx={0} cy={my} rx={2.6} ry={0.6 + 2.6 * talk} fill={INK} />;
    if (mood === "happy") return <path d={`M -4 ${my - 1} Q 0 ${my + 4.5} 4 ${my - 1} Z`} fill={INK} />;
    if (mood === "surprised") return <ellipse cx={0} cy={my + 0.5} rx={2.2} ry={3} fill={INK} />;
    if (mood === "angry" || mood === "sad")
      return (
        <path d={`M -3.5 ${my + 1.5} Q 0 ${my - 1.5} 3.5 ${my + 1.5}`} stroke={INK} strokeWidth={1.3} fill="none" strokeLinecap="round" />
      );
    if (mood === "worried")
      return (
        <path
          d={`M -3.5 ${my} Q -1.75 ${my - 1.6} 0 ${my} Q 1.75 ${my + 1.6} 3.5 ${my}`}
          stroke={INK}
          strokeWidth={1.3}
          fill="none"
          strokeLinecap="round"
        />
      );
    return <path d={`M -3 ${my} Q 0 ${my + 2} 3 ${my}`} stroke={INK} strokeWidth={1.3} fill="none" strokeLinecap="round" />;
  };

  const eyes = () =>
    [-1, 1].map((s) => {
      const ex = s * 5.2;
      if (hero) {
        const clip = `${uid}-e${s}`;
        return (
          <g key={s}>
            <defs>
              <clipPath id={clip}>
                <circle cx={ex} cy={eyeY} r={eyeR} />
              </clipPath>
            </defs>
            <circle cx={ex} cy={eyeY} r={eyeR} fill="#ffffff" />
            <g clipPath={`url(#${clip})`}>
              <circle cx={ex + lx * 1.3} cy={eyeY + ly * 1.2} r={eyeR * 0.55} fill={INK} />
              <rect x={ex - eyeR} y={eyeY - eyeR} width={eyeR * 2} height={eyeR * 2 * closed} fill={skin} />
              {mood === "happy" ? <ellipse cx={ex} cy={eyeY + eyeR * 1.35} rx={eyeR * 1.4} ry={eyeR} fill={skin} /> : null}
            </g>
          </g>
        );
      }
      // Dot eyes: they squash to a line to blink and shift toward what they look at.
      return (
        <ellipse
          key={s}
          cx={ex + lx * 1.4}
          cy={eyeY + ly * 1.1}
          rx={eyeR}
          ry={Math.max(0.35, eyeR * (1 - closed) * (mood === "happy" ? 0.6 : 1))}
          fill={INK}
        />
      );
    });

  const vb = { x: -60, y: -125, w: 120, h: 132 };
  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      width={vb.w * k}
      height={vb.h * k}
      style={{ position: "absolute", left: x + vb.x * k, top: y + vb.y * k, overflow: "visible", ...style }}
    >
      <ellipse cx={0} cy={1} rx={20 * w * (1 - air * 0.4)} ry={3.5 * (1 - air * 0.4)} fill="#000" opacity={0.22 * (1 - air * 0.6)} />
      <g transform={`translate(0 ${-lift / k}) rotate(${lean}) scale(${fx * sx} ${sy})`}>
        <Shade depth={4} rim={1.2}>
          {hairBack()}
          {arm(-1, armL)}
          {arm(1, armR)}
          {/* Legs and shoes */}
          <rect x={-hw + 3} y={-38} width={9.5} height={37} rx={4} fill={pants} />
          <rect x={hw - 12.5} y={-38} width={9.5} height={37} rx={4} fill={pants} />
          <ellipse cx={-hw + 7.5} cy={-1.5} rx={6.5} ry={3} fill={INK} />
          <ellipse cx={hw - 7.5} cy={-1.5} rx={6.5} ry={3} fill={INK} />
          {/* Torso: a soft trapezoid */}
          <path
            d={`M ${-sw} -62 Q ${-sw} -71 ${-sw + 9} -71 L ${sw - 9} -71 Q ${sw} -71 ${sw} -62 L ${hw} -36 Q ${hw} -32 ${hw - 4} -32 L ${-hw + 4} -32 Q ${-hw} -32 ${-hw} -36 Z`}
            fill={top}
          />
          {/* Head */}
          <circle cx={0} cy={headY} r={headR} fill={skin} />
        </Shade>
        {jacket ? (
          <>
            <path d={`M -6 -71 L 0 -58 L 6 -71 Z`} fill={shirt} />
            {tie ? <path d={`M -1.8 -66 L 1.8 -66 L 2.6 -48 L 0 -45 L -2.6 -48 Z`} fill={tie} /> : null}
            <path d={`M -6 -71 L 0 -58 L -3 -50 Z M 6 -71 L 0 -58 L 3 -50 Z`} fill={tone(jacket, -0.12)} />
          </>
        ) : tie ? (
          <path d={`M -1.8 -70 L 1.8 -70 L 2.6 -52 L 0 -49 L -2.6 -52 Z`} fill={tie} />
        ) : null}
        {hairFront()}
        {beard ? (
          <path
            d={`M -13 ${headY + 1} Q -12 ${headY + 15} 0 ${headY + 16} Q 12 ${headY + 15} 13 ${headY + 1} Q 8 ${headY + 9} 0 ${headY + 9} Q -8 ${headY + 9} -13 ${headY + 1} Z`}
            fill={hairColor}
          />
        ) : null}
        {eyes()}
        {brows()}
        {mustache ? (
          <path
            d={`M -6.5 ${headY + 5.8} Q -3.5 ${headY + 3} 0 ${headY + 4.6} Q 3.5 ${headY + 3} 6.5 ${headY + 5.8} Q 3 ${headY + 7.6} 0 ${headY + 6.4} Q -3 ${headY + 7.6} -6.5 ${headY + 5.8} Z`}
            fill={hairColor}
          />
        ) : (
          mouth()
        )}
        {glasses ? (
          <g stroke={INK} strokeWidth={1.1} fill="#ffffff" fillOpacity={0.15}>
            <circle cx={-5.2} cy={eyeY} r={4.2} />
            <circle cx={5.2} cy={eyeY} r={4.2} />
            <line x1={-1} y1={eyeY} x2={1} y2={eyeY} />
          </g>
        ) : null}
        {children}
      </g>
    </svg>
  );
};

const SKINS = ["#f6d2b4", "#f2c6a0", "#e0a97f", "#c98b62", "#a86b47", "#7c4a32", "#5c3726"];
const HAIRS = ["#2b1d1a", "#3b2a26", "#5a3b2a", "#8c5a3a", "#c99a5b", "#d9d4cf", "#1c1c24"];
const CLOTHES = ["#ef6b5b", "#f2b544", "#36b3a8", "#5b7cfa", "#9b6cf0", "#e86fa6", "#4fa36b", "#f0e6d0", "#3c4a75"];
const STYLES: HairStyle[] = ["short", "long", "bun", "curly", "side", "spiky", "short", "long"];

export type CrowdProps = {
  /** Rows of people, back to front. */
  rows?: number;
  perRow?: number;
  /** Ground line of the front row (0–1 of the height) and the height of a front-row person in px. */
  ground?: number;
  size?: number;
  /** Horizontal span (0–1 of the width). */
  from?: number;
  to?: number;
  seed?: number;
  /** Everyone reacts (a take, mood change) around this frame, each with their own small delay. */
  reactAt?: number;
  reaction?: Mood;
  /** Where the crowd looks (−1…1); each person varies a little. */
  look?: { x: number; y: number };
  /** Tint the back rows toward this color (atmosphere / stage lighting). */
  air?: string;
};

/**
 * A crowd of distinct people (skin, hair, clothes, height, build all seeded) that react with
 * overlapping timing: each person's take starts a few frames after the last, so it ripples.
 */
export const Crowd: React.FC<CrowdProps> = ({
  rows = 2,
  perRow = 9,
  ground = 0.95,
  size = 230,
  from = 0.04,
  to = 0.96,
  seed = 11,
  reactAt,
  reaction = "surprised",
  look = { x: 0, y: -0.2 },
  air,
}) => {
  const frame = useCurrentFrame();
  const clip = useClipBox();
  const box = { W: clip.width, H: clip.height };
  const people: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const depth = rows === 1 ? 1 : 0.72 + (0.28 * r) / (rows - 1); // back rows smaller
    const rowSize = size * depth;
    const gy = box.H * (ground - (rows - 1 - r) * 0.075);
    // Farther rows sink into the air a little (atmospheric depth).
    const fade = (c: string) => (air && rows > 1 ? mix(c, air, 0.35 * (1 - r / (rows - 1))) : c);
    for (let i = 0; i < perRow; i++) {
      const s = seed * 1000 + r * 100 + i;
      const t = (i + 0.5 + (r % 2) * 0.5 + (random01(s) - 0.5) * 0.5) / (perRow + 0.5);
      const px = box.W * (from + (to - from) * t);
      const delay = Math.floor(random01(s + 7) * 10) + Math.abs(i - perRow / 2) * 1.2;
      const tt = reactAt !== undefined ? frame - (reactAt + delay) : -999;
      const reacting = tt >= 0;
      const squash = reacting ? -0.6 * Math.exp(-tt / 7) * Math.cos(tt / 3) : tt > -4 && tt < 0 ? 0.25 : 0;
      people.push(
        <Person
          key={`${r}-${i}`}
          x={px}
          y={gy}
          size={rowSize * (0.86 + random01(s + 1) * 0.26)}
          build={0.85 + random01(s + 2) * 0.45}
          skin={fade(SKINS[Math.floor(random01(s + 3) * SKINS.length)])}
          hair={STYLES[Math.floor(random01(s + 4) * STYLES.length)]}
          hairColor={fade(HAIRS[Math.floor(random01(s + 5) * HAIRS.length)])}
          shirt={fade(CLOTHES[Math.floor(random01(s + 6) * CLOTHES.length)])}
          pants={fade(["#2d3557", "#3a3a48", "#4b3b5c", "#2f4858"][Math.floor(random01(s + 8) * 4)])}
          glasses={random01(s + 9) > 0.82}
          look={{ x: look.x + (random01(s + 10) - 0.5) * 0.5, y: look.y }}
          mood={reacting && tt < 60 ? reaction : "neutral"}
          squash={squash}
          seed={s}
          flip={random01(s + 11) > 0.5}
        />,
      );
    }
  }
  return <AbsoluteFill>{people}</AbsoluteFill>;
};
