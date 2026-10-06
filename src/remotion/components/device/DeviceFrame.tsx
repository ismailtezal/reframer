import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { mixColors, withAlpha } from "../../../core/color";
import { progress } from "../helpers";
import { AssetMedia, useAssetSrc } from "../media";
import { type BoxProps, defineMotionComponent } from "../types";

type Device = "phone" | "laptop" | "tablet";

type Props = {
  device: Device;
  screen: string;
  fit: "cover" | "contain";
  orientation: "auto" | "portrait" | "landscape";
  frameColor: string;
  /** Tints the placeholder screen shown when no media is set. */
  accentColor: string;
  entrance: "tilt" | "rise" | "fade" | "none";
  /** Resting pose, degrees */
  tiltX: number;
  tiltY: number;
  /** Degrees the device turns (Y) across the clip */
  drift: number;
  float: boolean;
  shadow: number;
  reflection: boolean;
  glare: boolean;
  exit: boolean;
};

const TAU = Math.PI * 2;

const metal = (c: string, angle = 145) =>
  `linear-gradient(${angle}deg, ${mixColors(c, "#FFFFFF", 0.42)} 0%, ${c} 22%, ${mixColors(c, "#000000", 0.35)} 52%, ${mixColors(c, "#FFFFFF", 0.16)} 78%, ${mixColors(c, "#000000", 0.42)} 100%)`;

const Glare: React.FC<{ shift: number }> = ({ shift }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: `linear-gradient(${118 + shift}deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.035) 33%, rgba(255,255,255,0) 33.4%, rgba(255,255,255,0) 100%)`,
    }}
  />
);

/** Calm skeleton UI so the mockup looks intentional before real media is dropped in. */
const Placeholder: React.FC<{ device: Device; landscape: boolean; accent: string; sw: number; sh: number }> = ({
  device,
  landscape,
  accent,
  sw,
  sh,
}) => {
  const s = Math.min(sw, sh);
  const wall = `radial-gradient(120% 80% at 15% 0%, ${withAlpha(accent, 0.32)} 0%, ${withAlpha(accent, 0)} 55%), linear-gradient(160deg, #16161C 0%, #0D0D11 60%, #09090C 100%)`;
  const bar = (key: string, style: React.CSSProperties, alpha = 0.09) => (
    <div key={key} style={{ position: "absolute", borderRadius: s, background: `rgba(255,255,255,${alpha})`, ...style }} />
  );
  if (device === "phone" && !landscape) {
    const rows: React.ReactNode[] = [];
    for (let i = 0; i < 4; i++) {
      const top = 46 + i * 10;
      rows.push(
        <div
          key={`icon${i}`}
          style={{
            position: "absolute",
            left: "7%",
            top: `${top}%`,
            width: s * 0.13,
            height: s * 0.13,
            borderRadius: s * 0.04,
            background: i === 0 ? withAlpha(accent, 0.5) : "rgba(255,255,255,0.08)",
          }}
        />,
        bar(`r1${i}`, { left: "26%", top: `${top + 1}%`, width: "46%", height: s * 0.028 }),
        bar(`r2${i}`, { left: "26%", top: `${top + 3.4}%`, width: "30%", height: s * 0.022 }, 0.05),
      );
    }
    return (
      <div style={{ position: "absolute", inset: 0, background: wall }}>
        <div
          style={{
            position: "absolute",
            left: "7%",
            top: "8.5%",
            width: s * 0.11,
            height: s * 0.11,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.12)",
          }}
        />
        {bar("t1", { left: "23%", top: "9.2%", width: "34%", height: s * 0.03 }, 0.14)}
        {bar("t2", { left: "23%", top: "11.6%", width: "22%", height: s * 0.022 }, 0.06)}
        <div
          style={{
            position: "absolute",
            left: "6%",
            right: "6%",
            top: "18%",
            height: "22%",
            borderRadius: s * 0.07,
            background: `linear-gradient(135deg, ${accent} 0%, ${mixColors(accent, "#000000", 0.45)} 100%)`,
            boxShadow: `0 ${s * 0.04}px ${s * 0.12}px ${withAlpha(accent, 0.25)}`,
          }}
        >
          {bar("c1", { left: "8%", top: "16%", width: "40%", height: s * 0.03 }, 0.35)}
          {bar("c2", { left: "8%", bottom: "16%", width: "56%", height: s * 0.075 }, 0.55)}
        </div>
        {rows}
        <div style={{ position: "absolute", left: "10%", right: "10%", bottom: "4.5%", display: "flex", justifyContent: "space-between" }}>
          {["a", "b", "c", "d"].map((k, i) => (
            <div
              key={k}
              style={{ width: s * 0.06, height: s * 0.06, borderRadius: "50%", background: i === 0 ? accent : "rgba(255,255,255,0.14)" }}
            />
          ))}
        </div>
      </div>
    );
  }
  const cards = ["a", "b", "c"].map((k, i) => (
    <div
      key={k}
      style={{
        position: "absolute",
        left: `${21 + i * 26}%`,
        top: "15%",
        width: "24%",
        height: "17%",
        borderRadius: s * 0.025,
        background: i === 0 ? withAlpha(accent, 0.16) : "rgba(255,255,255,0.045)",
        border: `1px solid ${i === 0 ? withAlpha(accent, 0.35) : "rgba(255,255,255,0.06)"}`,
      }}
    >
      {bar(`${k}1`, { left: "10%", top: "20%", width: "40%", height: s * 0.022 }, 0.1)}
      {bar(`${k}2`, { left: "10%", bottom: "20%", width: "62%", height: s * 0.05 }, i === 0 ? 0.3 : 0.16)}
    </div>
  ));
  return (
    <div style={{ position: "absolute", inset: 0, background: wall }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "17%",
          background: "rgba(255,255,255,0.025)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "14%",
            top: "5%",
            width: s * 0.05,
            height: s * 0.05,
            borderRadius: s * 0.014,
            background: accent,
          }}
        />
        {["n1", "n2", "n3", "n4", "n5"].map((k, i) =>
          bar(k, { left: "14%", top: `${16 + i * 7}%`, width: i === 0 ? "62%" : "48%", height: s * 0.02 }, i === 0 ? 0.16 : 0.07),
        )}
      </div>
      <div style={{ position: "absolute", left: "17%", right: 0, top: 0, height: "9%", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {bar("h1", { left: "4%", top: "38%", width: "18%", height: s * 0.022 }, 0.12)}
        {bar("h2", { right: "4%", top: "30%", width: "9%", height: s * 0.04 }, 0.08)}
      </div>
      {cards}
      <div
        style={{
          position: "absolute",
          left: "21%",
          right: "3%",
          top: "36%",
          height: "38%",
          borderRadius: s * 0.025,
          background: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <svg
          aria-hidden="true"
          width="100%"
          height="100%"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0 }}
        >
          <path d="M0 34 C12 31 18 26 28 27 S44 18 54 19 S70 10 80 11 S94 5 100 4 L100 40 L0 40Z" fill={withAlpha(accent, 0.18)} />
          <path
            d="M0 34 C12 31 18 26 28 27 S44 18 54 19 S70 10 80 11 S94 5 100 4"
            fill="none"
            stroke={accent}
            strokeWidth={0.7}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      {["l1", "l2"].map((k, i) => (
        <div key={k}>
          {bar(`${k}a`, { left: "21%", top: `${79 + i * 7}%`, width: "30%", height: s * 0.022 }, 0.1)}
          {bar(`${k}b`, { right: "3%", top: `${79 + i * 7}%`, width: "10%", height: s * 0.022 }, 0.06)}
        </div>
      ))}
    </div>
  );
};

type Side = "left" | "right" | "top" | "bottom";

/** Phone or tablet: a rounded slab with a metal rim, black bezel and real edge thickness in 3D. */
const Slab: React.FC<{
  kind: "phone" | "tablet";
  width: number;
  height: number;
  landscape: boolean;
  frameColor: string;
  content: React.ReactNode;
  glare: boolean;
  glareShift: number;
  shadow: number;
  unit: number;
}> = ({ kind, width, height, landscape, frameColor, content, glare, glareShift, shadow, unit }) => {
  const s = Math.min(width, height);
  const phone = kind === "phone";
  const radius = s * (phone ? 0.155 : 0.075);
  const rim = Math.max(1.5, s * (phone ? 0.012 : 0.008));
  const bezel = s * (phone ? 0.026 : 0.045);
  const screenRadius = Math.max(2, radius - rim - bezel * (phone ? 0.5 : 0.7));
  const depth = s * (phone ? 0.1 : 0.045);
  const btn = Math.max(2, s * 0.012);
  const buttons: { id: string; side: Side; at: number; len: number }[] = phone
    ? landscape
      ? [
          { id: "b1", side: "top", at: 0.66, len: 0.055 },
          { id: "b2", side: "top", at: 0.75, len: 0.055 },
          { id: "b3", side: "bottom", at: 0.7, len: 0.1 },
        ]
      : [
          { id: "b1", side: "left", at: 0.2, len: 0.055 },
          { id: "b2", side: "left", at: 0.285, len: 0.055 },
          { id: "b3", side: "right", at: 0.25, len: 0.1 },
        ]
    : [{ id: "b1", side: landscape ? "top" : "right", at: landscape ? 0.82 : 0.12, len: 0.05 }];

  const layers: React.ReactNode[] = [];
  const count = 6;
  for (let k = count; k >= 1; k--) {
    layers.push(
      <div
        key={`layer-${k}`}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          background: mixColors(frameColor, "#000000", 0.18 + (0.5 * k) / count),
          transform: `translateZ(${(-k * depth) / count}px)`,
        }}
      />,
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      {layers}
      {buttons.map((b) => {
        const vertical = b.side === "left" || b.side === "right";
        const along = vertical ? height : width;
        const style: React.CSSProperties = {
          position: "absolute",
          borderRadius: btn,
          background: metal(frameColor, vertical ? 90 : 180),
          transform: `translateZ(${-depth / 2}px)`,
          width: vertical ? btn : along * b.len,
          height: vertical ? along * b.len : btn,
          left: b.side === "left" ? -btn * 0.7 : b.side === "right" ? width - btn * 0.3 : along * b.at,
          top: b.side === "top" ? -btn * 0.7 : b.side === "bottom" ? height - btn * 0.3 : along * b.at,
        };
        return <div key={b.id} style={style} />;
      })}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          background: metal(frameColor),
          boxShadow: `inset 0 0 0 ${Math.max(1, unit)}px rgba(255,255,255,0.12), 0 ${s * 0.06}px ${s * 0.16}px rgba(0,0,0,${(0.42 * shadow).toFixed(3)})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: rim,
            borderRadius: radius - rim,
            background: "#030304",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ position: "absolute", inset: bezel, borderRadius: screenRadius, overflow: "hidden", background: "#000000" }}>
            {content}
            {glare ? <Glare shift={glareShift} /> : null}
            {phone ? (
              <div
                style={{
                  position: "absolute",
                  left: landscape ? s * 0.025 : "50%",
                  top: landscape ? "50%" : s * 0.025,
                  width: s * 0.034,
                  height: s * 0.034,
                  transform: landscape ? "translateY(-50%)" : "translateX(-50%)",
                  borderRadius: "50%",
                  background: "radial-gradient(circle at 38% 34%, #232838 0%, #050506 62%)",
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
                }}
              />
            ) : null}
          </div>
          {!phone ? (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: bezel * 0.5,
                width: bezel * 0.26,
                height: bezel * 0.26,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background: "#14161D",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.05)",
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

/** Laptop: thin-bezel lid plus a front-facing deck with a finger notch. */
const Laptop: React.FC<{
  total: number;
  lidW: number;
  lidH: number;
  baseH: number;
  frameColor: string;
  content: React.ReactNode;
  glare: boolean;
  glareShift: number;
  shadow: number;
}> = ({ total, lidW, lidH, baseH, frameColor, content, glare, glareShift, shadow }) => {
  const rTop = lidW * 0.022;
  const rBot = lidW * 0.006;
  const rim = Math.max(1.5, lidW * 0.004);
  const side = lidW * 0.018;
  const top = lidW * 0.028;
  const chin = lidW * 0.034;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: (total - lidW) / 2,
          top: 0,
          width: lidW,
          height: lidH,
          borderRadius: `${rTop}px ${rTop}px ${rBot}px ${rBot}px`,
          background: metal(frameColor),
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.12), 0 ${lidW * 0.03}px ${lidW * 0.08}px rgba(0,0,0,${(0.4 * shadow).toFixed(3)})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: rim,
            borderRadius: `${rTop - rim}px ${rTop - rim}px ${rBot}px ${rBot}px`,
            background: "#030304",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: side,
              right: side,
              top,
              bottom: chin,
              borderRadius: lidW * 0.004,
              overflow: "hidden",
              background: "#000000",
            }}
          >
            {content}
            {glare ? <Glare shift={glareShift} /> : null}
          </div>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: top * 0.5 - rim,
              width: top * 0.2,
              height: top * 0.2,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              background: "#14161D",
            }}
          />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: lidH - baseH * 0.12,
          width: total,
          height: baseH,
          borderRadius: `${baseH * 0.2}px ${baseH * 0.2}px ${baseH * 0.9}px ${baseH * 0.9}px / ${baseH * 0.2}px ${baseH * 0.2}px ${baseH * 0.75}px ${baseH * 0.75}px`,
          background: `linear-gradient(180deg, ${mixColors(frameColor, "#FFFFFF", 0.55)} 0%, ${mixColors(frameColor, "#FFFFFF", 0.2)} 16%, ${frameColor} 55%, ${mixColors(frameColor, "#000000", 0.5)} 100%)`,
          boxShadow: `0 ${baseH * 0.5}px ${baseH * 1.4}px rgba(0,0,0,${(0.45 * shadow).toFixed(3)})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: total * 0.15,
            height: baseH * 0.38,
            transform: "translateX(-50%)",
            borderRadius: `0 0 ${baseH * 0.4}px ${baseH * 0.4}px`,
            background: mixColors(frameColor, "#000000", 0.35),
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
          }}
        />
      </div>
    </div>
  );
};

const DeviceFrame: React.FC<Props & BoxProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const media = useAssetSrc(p.screen);
  const w = Math.max(1, p.width);
  const h = Math.max(1, p.height);
  const laptop = p.device === "laptop";
  const landscape = p.orientation === "landscape" || (p.orientation === "auto" && p.device === "tablet");

  // Body aspect (width / height) and overall footprint.
  const aspect = laptop ? 1.487 : p.device === "phone" ? (landscape ? 1 / 0.486 : 0.486) : landscape ? 1.43 : 0.7;
  const baseW = laptop ? 1.13 : 1;
  const baseFrac = laptop ? 0.036 : 0;
  const totalAspect = baseW / (1 / aspect + baseFrac);
  const totalW = Math.min(w * 0.86, h * 0.82 * totalAspect);
  const totalH = totalW / totalAspect;
  const bodyW = totalW / baseW;
  const bodyH = bodyW / aspect;

  // --- motion --------------------------------------------------------------
  const enter = p.entrance === "none" ? 1 : progress(frame, 0, Math.round(1.15 * fps), "smooth");
  const driftP = progress(frame, 0, Math.max(1, p.durationInFrames), "ease-in-out");
  const exitP = p.exit ? progress(frame, p.durationInFrames - 13, 12, "ease-in") : 0;
  const floatY = p.float ? Math.sin(((frame / fps) * TAU) / 4.5) * 10 * unit * enter : 0;
  let rotX = p.tiltX;
  let rotY = p.tiltY + p.drift * (driftP - 0.5);
  let ty = floatY;
  let scale = 1;
  let opacity = 1;
  if (p.entrance === "tilt") {
    rotX += (1 - enter) * 22;
    rotY += (1 - enter) * -30;
    ty += (1 - enter) * 110 * unit;
    scale = 0.86 + 0.14 * enter;
    opacity = Math.min(1, enter * 1.8);
  } else if (p.entrance === "rise") {
    ty += (1 - enter) * 90 * unit;
    scale = 0.95 + 0.05 * enter;
    opacity = Math.min(1, enter * 1.6);
  } else if (p.entrance === "fade") {
    opacity = enter;
  }
  opacity *= 1 - exitP;
  ty += exitP * 50 * unit;
  rotX += exitP * 8;
  scale *= 1 - 0.03 * exitP;

  const screenW = laptop ? bodyW * (1 - 0.036) : bodyW;
  const screenH = laptop ? bodyH * 0.9 : bodyH;
  const content = media ? (
    <AssetMedia value={p.screen} fit={p.fit} />
  ) : (
    <Placeholder device={p.device} landscape={landscape || laptop} accent={p.accentColor} sw={screenW} sh={screenH} />
  );
  const glareShift = rotY * 0.6;
  const shadowLift = Math.max(0, -floatY) / (10 * unit || 1);
  const shadowW = totalW * (laptop ? 1.02 : 0.92) * (1 - 0.06 * shadowLift);
  const shadowH = Math.max(totalW * (laptop ? 0.05 : 0.09), 8 * unit);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {p.shadow > 0 ? (
        <div
          style={{
            position: "absolute",
            left: (w - shadowW) / 2,
            top: (h + totalH) / 2 + totalH * 0.025 - shadowH / 2 + exitP * 30 * unit,
            width: shadowW,
            height: shadowH,
            borderRadius: "50%",
            background: `radial-gradient(closest-side, rgba(0,0,0,${(0.6 * p.shadow).toFixed(3)}) 0%, rgba(0,0,0,${(0.25 * p.shadow).toFixed(3)}) 55%, rgba(0,0,0,0) 100%)`,
            opacity: opacity * (1 - 0.25 * shadowLift),
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: (w - totalW) / 2,
          top: (h - totalH) / 2,
          width: totalW,
          height: totalH,
          perspective: `${Math.round(Math.max(totalW, totalH) * 3.2)}px`,
          perspectiveOrigin: "50% 45%",
          opacity,
          WebkitBoxReflect: p.reflection
            ? `below ${Math.round(totalH * 0.03)}px linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 62%, rgba(255,255,255,0.16) 100%)`
            : undefined,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            transform: `translateY(${ty.toFixed(2)}px) rotateX(${rotX.toFixed(3)}deg) rotateY(${rotY.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
          }}
        >
          {laptop ? (
            <Laptop
              total={totalW}
              lidW={bodyW}
              lidH={bodyH}
              baseH={bodyW * baseFrac}
              frameColor={p.frameColor}
              content={content}
              glare={p.glare}
              glareShift={glareShift}
              shadow={p.shadow}
            />
          ) : (
            <Slab
              kind={p.device === "tablet" ? "tablet" : "phone"}
              width={bodyW}
              height={bodyH}
              landscape={landscape}
              frameColor={p.frameColor}
              content={content}
              glare={p.glare}
              glareShift={glareShift}
              shadow={p.shadow}
              unit={unit}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const deviceFrame = defineMotionComponent<Props>({
  id: "device-frame",
  name: "Device frame",
  category: "device",
  description:
    "A generic modern phone, tablet or laptop mockup (no brand marks) showing your screenshot or screen recording, with a 3D tilt-in entrance that settles into a slight angle, gentle floating, glass glare and a soft floor shadow. Use for app promos and product reveals; set `screen` to the real capture (a skeleton UI shows until then).",
  schema: {
    device: { type: "enum", label: "Device", default: "phone", options: ["phone", "laptop", "tablet"] },
    screen: { type: "asset", label: "Screen media", default: "", description: "Screenshot or screen recording" },
    fit: { type: "enum", label: "Fit", default: "cover", options: ["cover", "contain"] },
    orientation: { type: "enum", label: "Orientation", default: "auto", options: ["auto", "portrait", "landscape"] },
    frameColor: { type: "color", label: "Frame color", default: "#2A2A2E" },
    accentColor: { type: "color", label: "Placeholder tint", default: "#FFB224" },
    entrance: { type: "enum", label: "Entrance", default: "tilt", options: ["tilt", "rise", "fade", "none"] },
    tiltX: { type: "number", label: "Tilt X (deg)", default: 6, min: -30, max: 30, step: 0.5 },
    tiltY: { type: "number", label: "Tilt Y (deg)", default: -12, min: -45, max: 45, step: 0.5 },
    drift: { type: "number", label: "Turn across clip (deg)", default: 10, min: -40, max: 40, step: 0.5 },
    float: { type: "boolean", label: "Float", default: true },
    shadow: { type: "number", label: "Shadow", default: 0.6, min: 0, max: 1, step: 0.05 },
    reflection: { type: "boolean", label: "Floor reflection", default: false },
    glare: { type: "boolean", label: "Glass glare", default: true },
    exit: { type: "boolean", label: "Animate out", default: true },
  },
  defaults: {
    device: "phone",
    screen: "",
    fit: "cover",
    orientation: "auto",
    frameColor: "#2A2A2E",
    accentColor: "#FFB224",
    entrance: "tilt",
    tiltX: 6,
    tiltY: -12,
    drift: 10,
    float: true,
    shadow: 0.6,
    reflection: false,
    glare: true,
    exit: true,
  },
  defaultDuration: 5,
  defaultBox: { x: 0.5, y: 0.52, width: 0.7, height: 0.86 },
  Component: DeviceFrame,
  tags: ["device", "mockup", "phone", "laptop", "tablet", "app", "product", "3d"],
});
