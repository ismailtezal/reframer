import type React from "react";
import { useId } from "react";
import { evaluateAny, evaluateNumber } from "../../core/keyframes";
import type { ShapeClip } from "../../core/schema";
import { SvgFillDef } from "./BackgroundContent";

const polygonPoints = (n: number, w: number, h: number, inner?: number) => {
  const pts: string[] = [];
  const count = inner ? n * 2 : n;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const r = inner && i % 2 === 1 ? inner : 1;
    pts.push(`${(w / 2 + Math.cos(angle) * (w / 2) * r).toFixed(2)},${(h / 2 + Math.sin(angle) * (h / 2) * r).toFixed(2)}`);
  }
  return pts.join(" ");
};

export const ShapeContent: React.FC<{
  clip: ShapeClip;
  frame: number;
  box: { width: number; height: number };
}> = ({ clip, frame, box }) => {
  const id = useId().replace(/:/g, "");
  const w = box.width;
  const h = box.height;
  const sw = evaluateNumber(clip.keyframes, "strokeWidth", frame, clip.strokeWidth ?? 0);
  const draw = evaluateNumber(clip.keyframes, "drawProgress", frame, clip.drawProgress ?? 1);
  const stroke = evaluateAny(clip.keyframes, "stroke", frame, clip.stroke ?? "transparent");
  const solidFill = clip.fill?.type === "solid" ? evaluateAny(clip.keyframes, "fill.color", frame, clip.fill.color) : undefined;
  const fill = clip.fill ? (clip.fill.type === "solid" ? solidFill : `url(#f${id})`) : "none";
  const half = sw / 2;
  const dash = draw < 1 ? { pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: 1 - Math.max(0, draw) } : {};
  const common = {
    fill,
    stroke: sw > 0 ? stroke : "none",
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...dash,
  };

  let shape: React.ReactNode;
  switch (clip.shape) {
    case "rect":
      shape = <rect x={half} y={half} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)} rx={clip.cornerRadius ?? 0} {...common} />;
      break;
    case "ellipse":
      shape = <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - half)} ry={Math.max(0, h / 2 - half)} {...common} />;
      break;
    case "triangle":
      shape = <polygon points={`${w / 2},${half} ${w - half},${h - half} ${half},${h - half}`} {...common} />;
      break;
    case "star":
      shape = (
        <polygon points={polygonPoints(clip.points ?? 5, w - sw, h - sw, 0.45)} transform={`translate(${half} ${half})`} {...common} />
      );
      break;
    case "polygon":
      shape = <polygon points={polygonPoints(clip.points ?? 6, w - sw, h - sw)} transform={`translate(${half} ${half})`} {...common} />;
      break;
    case "line":
      shape = <line x1={half} y1={h / 2} x2={w - half} y2={h / 2} {...common} fill="none" />;
      break;
    case "arrow": {
      const head = Math.min(h * 0.9, Math.max(sw * 3.2, 18));
      const end = w - half;
      shape = (
        <g>
          <line x1={half} y1={h / 2} x2={end - head * 0.35} y2={h / 2} {...common} fill="none" />
          {draw >= 0.98 ? (
            <path
              d={`M ${end - head} ${h / 2 - head * 0.55} L ${end} ${h / 2} L ${end - head} ${h / 2 + head * 0.55}`}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </g>
      );
      break;
    }
  }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      {clip.fill && clip.fill.type !== "solid" ? (
        <defs>
          <SvgFillDef id={`f${id}`} fill={clip.fill} />
        </defs>
      ) : null}
      {shape}
    </svg>
  );
};
