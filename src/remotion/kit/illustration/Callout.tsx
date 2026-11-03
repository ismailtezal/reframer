import type React from "react";
import { useCurrentFrame } from "remotion";
import { fontStack, useFonts } from "../../fonts";
import { ramp } from "../shared";

export type CalloutProps = {
  /** The point being labelled, in px of the clip box. */
  x: number;
  y: number;
  text: string;
  /** Smaller second line (a number, a translation). */
  sub?: string;
  /** Which way the leader line runs from the point. */
  side?: "left" | "right" | "up-left" | "up-right" | "down-left" | "down-right";
  /** Leader length in px. */
  length?: number;
  /** Frames into the clip when the line starts drawing. */
  start?: number;
  /** Label size in px at 1080p (≥ 40 so it reads on a phone). */
  size?: number;
  color?: string;
  accent?: string;
  font?: string;
  /** Frames into the clip when it leaves (line retracts, text fades); omit to stay. */
  exitAt?: number;
};

/**
 * A label anchored to the thing it names: a dot on the object, a leader line that draws out, then
 * bold text. Labels float free of nothing: the line ties them to their object.
 */
export const Callout: React.FC<CalloutProps> = ({
  x,
  y,
  text,
  sub,
  side = "up-right",
  length = 150,
  start = 0,
  size = 48,
  color = "#ffffff",
  accent = "#ffc93c",
  font = "Nunito",
  exitAt,
}) => {
  const frame = useCurrentFrame();
  useFonts([
    { family: font, weight: 800 },
    { family: font, weight: 700 },
  ]);
  const out = exitAt !== undefined ? ramp(frame, exitAt, 10, "ease-in") : 0;
  const dot = ramp(frame, start, 8, "overshoot") * (1 - out);
  const draw = ramp(frame, start + 3, 12) * (1 - out);
  const label = ramp(frame, start + 10, 12) * (1 - out);
  const dirX = side.includes("left") ? -1 : 1;
  const diag = side.startsWith("up") ? -1 : side.startsWith("down") ? 1 : 0;
  // Leader: a short diagonal, then horizontal toward the text.
  const ex = x + dirX * length * (diag ? 0.45 : 1) * Math.min(1, draw * 2);
  const ey = y + diag * length * 0.45 * Math.min(1, draw * 2);
  const hx = ex + dirX * length * 0.55 * Math.max(0, draw * 2 - 1) * (diag ? 1 : 0);
  const tx = x + dirX * length * (diag ? 1 : 1) + dirX * 14;
  const ty = y + diag * length * 0.45;
  return (
    <>
      <svg style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
        <circle cx={x} cy={y} r={9 * dot} fill={accent} />
        <circle cx={x} cy={y} r={16 * dot} fill="none" stroke={accent} strokeOpacity={0.45} strokeWidth={3} />
        {draw > 0 ? (
          <polyline
            points={`${x},${y} ${ex},${ey} ${hx},${ey}`}
            fill="none"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
      <div
        style={{
          position: "absolute",
          left: dirX > 0 ? tx : undefined,
          right: dirX < 0 ? `calc(100% - ${tx}px)` : undefined,
          top: ty,
          transform: `translateY(-50%) translateX(${(1 - label) * dirX * -16}px)`,
          opacity: label,
          fontFamily: fontStack(font),
          color,
          textAlign: dirX > 0 ? "left" : "right",
          textShadow: "0 3px 14px rgba(10, 8, 40, 0.55)",
          whiteSpace: "nowrap",
          lineHeight: 1.05,
        }}
      >
        <div style={{ fontSize: size, fontWeight: 800, letterSpacing: "-0.01em" }}>{text}</div>
        {sub ? <div style={{ fontSize: size * 0.58, fontWeight: 700, color: accent, marginTop: size * 0.12 }}>{sub}</div> : null}
      </div>
    </>
  );
};
