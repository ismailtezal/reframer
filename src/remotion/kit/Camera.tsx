import type React from "react";
import { createContext, useContext } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { EasingPreset } from "../../core/schema";
import { ramp, useClipDuration } from "./shared";

export type CameraKey = {
  /** 1 = framed as laid out. */
  scale?: number;
  /** Offset as a fraction of the frame (0.05 = 5% of the width/height). */
  x?: number;
  y?: number;
  /** Degrees. */
  rotate?: number;
  /** Point of the frame (0–1) brought to the center at this key, e.g. { x: 0.5, y: 0.78 } to move in on
   * a timeline near the bottom; overrides x/y. Pair with scale > 1 for a close-up. */
  focus?: { x: number; y: number };
};

export type CameraProps = {
  from?: CameraKey;
  to?: CameraKey;
  /** Frames into the clip when the move starts (default 0). */
  start?: number;
  /** Length of the move in frames (default: the whole clip). */
  duration?: number;
  /** Default linear: a steady dolly that is already moving at the cut (eased starts snap right after cuts). */
  ease?: EasingPreset;
  children?: React.ReactNode;
};

type Move = { scale: number; x: number; y: number; rotate: number };
const CameraContext = createContext<{ base: Move; travel: Move } | null>(null);

const resolve = (k: CameraKey | undefined, fallback: Move): Move => {
  const scale = k?.scale ?? fallback.scale;
  return {
    scale,
    // The translate is applied after the scale, so centering a point takes (0.5 − point) × scale.
    x: k?.focus ? (0.5 - k.focus.x) * scale : (k?.x ?? fallback.x),
    y: k?.focus ? (0.5 - k.focus.y) * scale : (k?.y ?? fallback.y),
    rotate: k?.rotate ?? fallback.rotate,
  };
};

/**
 * A camera over the whole scene: a slow, eased push/drift so nothing ever sits still like a
 * slide. Default: a 10% push-in with a slight drift across the clip (subtler moves read as frozen). Wrap layers in <Layer depth> for parallax.
 */
export const Camera: React.FC<CameraProps> = ({ from, to, start = 0, duration, ease = "linear", children }) => {
  const frame = useCurrentFrame();
  const clip = useClipDuration();
  const len = duration ?? Math.max(1, clip - start);
  const p = ramp(frame, start, len, ease);
  const a = resolve(from, { scale: 1, x: 0, y: 0, rotate: 0 });
  // No `to`: keep pushing in from wherever `from` framed the shot (a camera that stops reads as a
  // slide). A `to` without its own framing keeps the focus point of `from`.
  const keepFocus = from?.focus ? { focus: from.focus } : {};
  const toKey: CameraKey =
    to === undefined
      ? { scale: a.scale * 1.1, ...keepFocus }
      : !to.focus && to.x === undefined && to.y === undefined
        ? { ...keepFocus, ...to }
        : to;
  const b = resolve(toKey, { scale: from ? a.scale : 1.1, x: from ? a.x : -0.012, y: a.y, rotate: a.rotate });
  // Zoom like a lens: scale moves geometrically (a 1→40 zoom-through doesn't rush the start), and the
  // point at the frame's center travels in a straight line, so a focus point stays put while zooming.
  const scale = a.scale > 0 && b.scale > 0 ? a.scale * (b.scale / a.scale) ** p : a.scale + (b.scale - a.scale) * p;
  const centerA = { x: 0.5 - a.x / a.scale, y: 0.5 - a.y / a.scale };
  const centerB = { x: 0.5 - b.x / b.scale, y: 0.5 - b.y / b.scale };
  const cur: Move = {
    scale,
    x: (0.5 - (centerA.x + (centerB.x - centerA.x) * p)) * scale,
    y: (0.5 - (centerA.y + (centerB.y - centerA.y) * p)) * scale,
    rotate: a.rotate + (b.rotate - a.rotate) * p,
  };
  return (
    <CameraContext.Provider
      value={{ base: a, travel: { scale: cur.scale - a.scale, x: cur.x - a.x, y: cur.y - a.y, rotate: cur.rotate - a.rotate } }}
    >
      <AbsoluteFill
        style={{
          transform: `translate(${cur.x * 100}%, ${cur.y * 100}%) scale(${cur.scale}) rotate(${cur.rotate}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        {children}
      </AbsoluteFill>
    </CameraContext.Provider>
  );
};

/**
 * A depth layer inside <Camera>: depth 1 moves with the camera, 0.3 barely moves (far background),
 * 1.6 moves more (foreground) — the parallax that makes a flat scene feel like a space.
 */
export const Layer: React.FC<{ depth?: number; children?: React.ReactNode; style?: React.CSSProperties }> = ({
  depth = 1,
  children,
  style,
}) => {
  const cam = useContext(CameraContext);
  if (!cam) return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
  // The camera already applied 1×; add (depth − 1)× of its travel on top.
  const k = depth - 1;
  const t = cam.travel;
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${t.x * k * 100}%, ${t.y * k * 100}%) scale(${1 + (t.scale * k) / Math.max(0.01, cam.base.scale)})`,
        transformOrigin: "50% 50%",
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Float: a slow vertical bob + tiny tilt for a hero object (devices, cards) so it feels alive. */
export const Float: React.FC<{ amount?: number; speed?: number; children?: React.ReactNode; style?: React.CSSProperties }> = ({
  amount = 1,
  speed = 1,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const y = Math.sin((frame / 48) * speed) * 8 * amount;
  const r = Math.sin((frame / 70) * speed) * 0.4 * amount;
  return <div style={{ transform: `translateY(${y}px) rotate(${r}deg)`, ...style }}>{children}</div>;
};
