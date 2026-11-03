import type React from "react";
import { useId } from "react";
import { useCurrentFrame } from "remotion";
import { random01 } from "../../components/helpers";
import { sceneLightDir, useSceneLight } from "./light-context";
import { Shade, tone } from "./shade";

/**
 * An expressive cartoon character built from independently animated parts (body, eyes, lids, brows,
 * mouth, arms, feet, ground shadow), so scenes can act: look before moving, react, hop with
 * anticipation and squash. Local units: the body is 100 wide, the feet stand at y = 0, the top of
 * the head is about y = −118 × height. Children are drawn in those units (hats, tools, signs).
 */

export type Mood = "neutral" | "happy" | "surprised" | "worried" | "angry" | "sad" | "sleepy";
export type Pose = "idle" | "wave" | "cheer" | "point" | "shrug" | "hold";

export type CritterProps = {
  /** Where the feet touch the ground, in px of the clip box. */
  x: number;
  y: number;
  /** Body width in px. Heroes 220–420 px at 1080p; never under 120 px when the character acts. */
  size: number;
  color?: string;
  /** Body shape: 1 = bean, 1.25 = tall, 0.85 = round. */
  height?: number;
  /** Where the eyes look, −1…1 on each axis (look at what's about to happen before it happens). */
  look?: { x: number; y: number };
  mood?: Mood;
  pose?: Pose;
  /** Arm angles in degrees (0 = hanging, 90 = out, 160 = up), overriding the pose. */
  arms?: { left?: number; right?: number };
  /** −1…1: positive squashes wide, negative stretches tall (feet stay planted). Use hop()/take(). */
  squash?: number;
  /** Lift off the ground in px (the ground shadow stays and shrinks). */
  lift?: number;
  /** Lean in degrees, pivoting on the feet. */
  lean?: number;
  /** 0–1 mouth opening while speaking. */
  talk?: number;
  /** 0–1 forces the eyes shut (otherwise they blink by themselves). */
  eyesClosed?: number;
  /** Mirror (faces the other way: the pointing/waving arm swaps). */
  flip?: boolean;
  /** Pink cheeks. Default true. */
  blush?: boolean;
  ears?: "none" | "round" | "pointy" | "antenna";
  /** Seed for blink timing and idle sway, so a crowd doesn't move in lockstep. */
  seed?: number;
  /** Light direction for the body shading. */
  light?: { x: number; y: number };
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

const INK = "#24123a";

/** Bean-shaped body path; h scales the height (the top narrows as it grows). */
const bodyPath = (h: number) => {
  const top = -118 * h;
  const s = (y: number) => y * h;
  return [
    `M 0 ${top}`,
    `C 30 ${top} 46 ${s(-100)} 48 ${s(-74)}`,
    `C 51 ${s(-48)} 53 ${s(-24)} 45 ${s(-13)}`,
    `C 37 -5 21 -6 0 -6`,
    `C -21 -6 -37 -5 -45 ${s(-13)}`,
    `C -53 ${s(-24)} -51 ${s(-48)} -48 ${s(-74)}`,
    `C -46 ${s(-100)} -30 ${top} 0 ${top} Z`,
  ].join(" ");
};

const POSES: Record<Pose, { left: number; right: number }> = {
  idle: { left: 14, right: 14 },
  wave: { left: 14, right: 150 },
  cheer: { left: 155, right: 155 },
  point: { left: 14, right: 92 },
  shrug: { left: 70, right: 70 },
  hold: { left: 62, right: 62 },
};

/** Seeded blinks: one roughly every 2.5–4 s, each 7 frames, sometimes a double blink. */
const blinkAt = (frame: number, seed: number) => {
  const period = 96;
  const n = Math.floor(frame / period);
  let closed = 0;
  for (const k of [n - 1, n]) {
    const t0 = k * period + 12 + random01(seed * 131 + k) * 66;
    const d = Math.abs(frame - t0);
    if (d < 3.5) closed = Math.max(closed, 1 - d / 3.5);
    if (random01(seed * 977 + k) > 0.75) {
      const d2 = Math.abs(frame - (t0 + 9));
      if (d2 < 3.5) closed = Math.max(closed, 1 - d2 / 3.5);
    }
  }
  return closed;
};

export const Critter: React.FC<CritterProps> = ({
  x,
  y,
  size,
  color = "#ff7a59",
  height = 1,
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
  blush = true,
  ears = "none",
  seed = 1,
  light: ownLight,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  // Lit from the scene's side inside a <SceneLight>, otherwise from the upper left.
  const scene = useSceneLight();
  const light = ownLight ?? sceneLightDir(scene);
  const k = size / 100;
  const h = height;
  // Alive at rest: a slow breath and a little sway, offset per character.
  const breath = 0.025 * Math.sin(((frame + seed * 17) / 70) * Math.PI * 2);
  const q = Math.max(-0.9, Math.min(0.9, squash + breath)) * 0.22;
  const sx = 1 + q;
  const sy = 1 / (1 + q);
  const base = POSES[pose];
  const wave = pose === "wave" ? 22 * Math.sin((frame / 7) * Math.PI) : 0;
  const armL = (arms?.left ?? base.left) + 3 * Math.sin((frame + seed * 31) / 23);
  const armR = (arms?.right ?? base.right) + wave + 3 * Math.sin((frame + seed * 47) / 27);
  // Eyes
  const lidAuto = mood === "sleepy" ? 0.55 : 0;
  const closed = Math.max(eyesClosed ?? 0, blinkAt(frame, seed), lidAuto);
  const eyeY = -84 * h + 4;
  const eyeR = mood === "surprised" ? 16.5 : 15;
  const pupilR = mood === "surprised" ? 6 : 7.6;
  const lx = Math.max(-1, Math.min(1, look.x)) * (flip ? -1 : 1);
  const ly = Math.max(-1, Math.min(1, look.y));
  const px = lx * (eyeR - pupilR - 1.5);
  const py = ly * (eyeR - pupilR - 2);
  const lidColor = tone(color, -0.08);
  const dark = tone(color, -0.32, 10);
  const mouthY = eyeY + 27;
  const air = Math.min(1, lift / (size * 0.9));
  const pad = 40;
  const vbW = 200 + pad * 2;
  const vbTop = -118 * h - 70;
  const vbH = -vbTop + 20;

  const brow = (side: -1 | 1) => {
    // Angle of the brow's inner end: up when worried/sad, down when angry.
    const tilt = mood === "worried" || mood === "sad" ? -16 : mood === "angry" ? 20 : 0;
    const raise = mood === "surprised" ? -8 : mood === "angry" ? 4 : 0;
    if (mood === "neutral" || mood === "happy" || mood === "sleepy") return null;
    const cx = side * 19;
    const cy = eyeY - eyeR - 7 + raise;
    return (
      <line
        x1={cx - 8}
        y1={cy}
        x2={cx + 8}
        y2={cy}
        stroke={INK}
        strokeWidth={4.5}
        strokeLinecap="round"
        transform={`rotate(${side * tilt} ${cx} ${cy})`}
      />
    );
  };

  const eye = (side: -1 | 1) => {
    const cx = side * 19;
    const clip = `${uid}-eye${side}`;
    // Mood lids: slanted upper lids (worried/angry/sad), smiling lower lids (happy).
    const slant = mood === "angry" ? 0.42 : mood === "worried" || mood === "sad" ? 0.32 : 0;
    const slantAngle = mood === "angry" ? side * -18 : side * 16;
    return (
      <g key={side}>
        <defs>
          <clipPath id={clip}>
            <circle cx={cx} cy={eyeY} r={eyeR} />
          </clipPath>
        </defs>
        <circle cx={cx} cy={eyeY} r={eyeR} fill="#ffffff" />
        <g clipPath={`url(#${clip})`}>
          <circle cx={cx + px} cy={eyeY + py} r={pupilR} fill={INK} />
          <circle cx={cx + px - pupilR * 0.35} cy={eyeY + py - pupilR * 0.4} r={pupilR * 0.34} fill="#ffffff" />
          {closed > 0 ? (
            <rect x={cx - eyeR - 2} y={eyeY - eyeR - 2} width={eyeR * 2 + 4} height={(eyeR * 2 + 4) * closed} fill={lidColor} />
          ) : null}
          {slant > 0 ? (
            <rect
              x={cx - eyeR - 6}
              y={eyeY - eyeR - 10}
              width={eyeR * 2 + 12}
              height={10 + eyeR * 2 * slant}
              fill={lidColor}
              transform={`rotate(${slantAngle} ${cx} ${eyeY})`}
            />
          ) : null}
          {mood === "happy" ? <ellipse cx={cx} cy={eyeY + eyeR * 1.3} rx={eyeR * 1.35} ry={eyeR * 0.95} fill={lidColor} /> : null}
        </g>
      </g>
    );
  };

  const mouth = () => {
    if (talk > 0.02) return <ellipse cx={0} cy={mouthY + 2} rx={7 + 2 * talk} ry={1.5 + 7.5 * talk} fill={INK} />;
    switch (mood) {
      case "happy":
        return (
          <g>
            <path d={`M -12 ${mouthY - 2} Q 0 ${mouthY + 15} 12 ${mouthY - 2} Z`} fill={INK} />
            <path d={`M -6 ${mouthY + 6} Q 0 ${mouthY + 2} 6 ${mouthY + 6} Q 0 ${mouthY + 11} -6 ${mouthY + 6} Z`} fill="#ff6f91" />
          </g>
        );
      case "surprised":
        return <ellipse cx={0} cy={mouthY + 3} rx={6} ry={8} fill={INK} />;
      case "worried":
        return (
          <path
            d={`M -9 ${mouthY + 2} Q -4.5 ${mouthY - 3} 0 ${mouthY + 2} Q 4.5 ${mouthY + 6} 9 ${mouthY + 2}`}
            stroke={INK}
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
          />
        );
      case "angry":
      case "sad":
        return (
          <path
            d={`M -9 ${mouthY + 4} Q 0 ${mouthY - 3} 9 ${mouthY + 4}`}
            stroke={INK}
            strokeWidth={3.8}
            fill="none"
            strokeLinecap="round"
          />
        );
      case "sleepy":
        return <ellipse cx={0} cy={mouthY + 2} rx={3.5} ry={3} fill={INK} />;
      default:
        return <path d={`M -7 ${mouthY} Q 0 ${mouthY + 6} 7 ${mouthY}`} stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />;
    }
  };

  const arm = (side: -1 | 1, angle: number) => {
    const sx0 = side * 42;
    const sy0 = -54 * h;
    // 0° hangs down; positive swings outward and up. A rounded hand at the end reads at any size.
    return (
      <g key={side} transform={`rotate(${side === 1 ? -angle : angle} ${sx0} ${sy0})`}>
        <rect x={sx0 - 6.5} y={sy0 - 4} width={13} height={46} rx={6.5} fill={color} />
        <circle cx={sx0} cy={sy0 + 42} r={8.5} fill={color} />
      </g>
    );
  };

  const earShapes = () => {
    const top = -118 * h;
    if (ears === "round") return [-1, 1].map((s) => <circle key={s} cx={s * 30} cy={top + 14} r={15} fill={color} />);
    if (ears === "pointy")
      return [-1, 1].map((s) => (
        <path key={s} d={`M ${s * 16} ${top + 12} L ${s * 36} ${top - 22} L ${s * 44} ${top + 26} Z`} fill={color} strokeLinejoin="round" />
      ));
    if (ears === "antenna")
      return (
        <g>
          <path d={`M 0 ${top + 4} Q 6 ${top - 24} 14 ${top - 36}`} stroke={dark} strokeWidth={4} fill="none" strokeLinecap="round" />
          <circle cx={14} cy={top - 38} r={7} fill={tone(color, 0.25, -20)} />
        </g>
      );
    return null;
  };

  const flipX = flip ? -1 : 1;
  return (
    <svg
      viewBox={`${-vbW / 2} ${vbTop} ${vbW} ${vbH}`}
      width={vbW * k}
      height={vbH * k}
      style={{ position: "absolute", left: x - (vbW * k) / 2, top: y + vbTop * k, overflow: "visible", ...style }}
    >
      {/* Ground shadow stays on the ground and shrinks as the character leaves it. */}
      <ellipse cx={0} cy={1} rx={50 * (1 - air * 0.45) * sx} ry={8 * (1 - air * 0.45)} fill="#000000" opacity={0.22 * (1 - air * 0.6)} />
      <g transform={`translate(0 ${-lift / k}) rotate(${lean}) scale(${flipX * sx} ${sy})`}>
        <Shade light={{ x: light.x * flipX, y: light.y }} depth={9} rim={2.6}>
          {earShapes()}
          {arm(-1, armL)}
          {arm(1, armR)}
          <ellipse cx={-19} cy={-3} rx={15} ry={7.5} fill={dark} />
          <ellipse cx={19} cy={-3} rx={15} ry={7.5} fill={dark} />
          <path d={bodyPath(h)} fill={color} />
        </Shade>
        <ellipse cx={0} cy={-36 * h} rx={31} ry={26 * h} fill={tone(color, 0.16, -6)} opacity={0.55} />
        {blush && mood !== "angry" ? (
          <>
            <ellipse cx={-33} cy={eyeY + 17} rx={7.5} ry={4.5} fill="#ff6f91" opacity={0.35} />
            <ellipse cx={33} cy={eyeY + 17} rx={7.5} ry={4.5} fill="#ff6f91" opacity={0.35} />
          </>
        ) : null}
        {eye(-1)}
        {eye(1)}
        {brow(-1)}
        {brow(1)}
        {mouth()}
        {children}
      </g>
    </svg>
  );
};

const ease = (t: number) => 1 - (1 - t) ** 3;

/**
 * A hop with the animation principles built in: crouch (anticipation), stretch on the way up, a
 * squash on landing and a settle. Spread the result into <Critter {...hop(frame, 30, { height: 160 })}>.
 */
export const hop = (frame: number, start: number, { height = 120, duration = 18 }: { height?: number; duration?: number } = {}) => {
  const t = frame - start;
  if (t < -8) return { lift: 0, squash: 0 };
  if (t < 0) {
    const p = (t + 8) / 8;
    return { lift: 0, squash: 0.55 * Math.sin((p * Math.PI) / 2) };
  }
  if (t < duration) {
    const p = t / duration;
    return { lift: height * 4 * p * (1 - p), squash: p < 0.5 ? -0.5 * (1 - p * 2) : -0.25 * (p - 0.5) * 2 };
  }
  const s = t - duration;
  if (s < 16) return { lift: 0, squash: 0.6 * Math.exp(-s / 4) * Math.cos(s / 2.2) };
  return { lift: 0, squash: 0 };
};

/**
 * A surprise "take": a small crouch, a tall stretch with wide eyes, then a wobbly settle.
 * Returns props for <Critter>; mood switches to surprised for ~1 s.
 */
export const take = (frame: number, at: number) => {
  const t = frame - at;
  if (t < -4) return { squash: 0 };
  if (t < 0) return { squash: 0.3 * ease((t + 4) / 4) };
  if (t < 30)
    return {
      squash: -0.65 * Math.exp(-t / 7) * Math.cos(t / 3),
      mood: "surprised" as Mood,
      lift: Math.max(0, 14 * Math.sin((t / 8) * Math.PI)) * (t < 8 ? 1 : 0),
    };
  return { squash: 0 };
};

/** Where to point the eyes so a character looks from (x, y) at a target point (all px). */
export const lookAt = (x: number, y: number, tx: number, ty: number) => {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: (dy / d) * 0.85 };
};
