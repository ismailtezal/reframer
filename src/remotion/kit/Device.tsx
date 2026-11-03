import { Video } from "@remotion/media";
import type React from "react";
import { Img, useCurrentFrame } from "remotion";
import type { EasingPreset } from "../../core/schema";
import { clamp, ramp, rgba, useClipDuration } from "./shared";

export type Tilt = { x?: number; y?: number; z?: number };

export type DeviceProps = {
  kind?: "macbook" | "iphone";
  /** macbook: "space-black" | "silver"; iphone: "titanium" | "black". */
  finish?: "space-black" | "silver" | "titanium" | "black";
  /** Width of the device in px (the MacBook's lid; the iPhone's body). */
  width: number;
  /** 3D angle in degrees, eased from → to across the move (rest pose: { x: 0, y: 0 }). MacBook: x is the
   * camera's height (positive looks down onto the keyboard; 10–20 shows the deck), y turns it. */
  tilt?: { from?: Tilt; to?: Tilt };
  start?: number;
  /** Frames (default: the whole clip). */
  duration?: number;
  /** Default "ease": starts gently (no snap right after a cut) and settles into the pose. */
  ease?: EasingPreset;
  /** A light sweep across the glass now and then. Default true. */
  glare?: boolean;
  /** Contact shadow under the device. Default true. */
  shadow?: boolean;
  /** Screen media URL (image or video); otherwise `children` are the screen content. */
  screen?: string;
  /** Behind the screen content. Default black. */
  screenBackground?: string;
  /** The screen's light: a bloom around the display and a pool of light under the device. */
  glow?: string;
  /** Mirror on the floor below the device, 0–1 opacity (0.12–0.2 reads as a polished stage). */
  reflection?: number;
  /** Keep turning slowly after the tilt move (degrees of sway). Default 2.5; 0 = rest still. */
  sway?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

const FINISH = {
  "space-black": { body: ["#2e2e32", "#1b1b1e", "#0f0f11"], edge: "#6a6a70", base: ["#3c3c41", "#25252a", "#151518"] },
  silver: { body: ["#e6e7e9", "#cbccd0", "#aaacb0"], edge: "#ffffff", base: ["#dcdde0", "#c1c2c6", "#9b9da1"] },
  titanium: { body: ["#9a958e", "#66625d", "#3e3c39"], edge: "#d9d4cc", base: ["#9a958e", "#66625d", "#3e3c39"] },
  black: { body: ["#3c3c3f", "#1e1e20", "#0c0c0d"], edge: "#6a6a6e", base: ["#3c3c3f", "#1e1e20", "#0c0c0d"] },
} as const;

const Screen: React.FC<{ screen?: string; background: string; radius: number; children?: React.ReactNode }> = ({
  screen,
  background,
  radius,
  children,
}) => (
  <div style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden", background }}>
    {screen ? (
      /\.(mp4|webm|mov|m4v)(\?|$)/i.test(screen) ? (
        <Video src={screen} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <Img src={screen} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )
    ) : (
      children
    )}
  </div>
);

/** Glass: a fixed reflection, a soft inner vignette, and a light band that sweeps across now and then. */
const Glass: React.FC<{ radius: number; frame: number; glare: boolean }> = ({ radius, frame, glare }) => {
  const cycle = 165;
  const t = ((frame % cycle) / cycle) * 1.8 - 0.4;
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(122deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 24%, transparent 36%, transparent 72%, rgba(255,255,255,0.03) 100%)",
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.35)",
        }}
      />
      {glare ? (
        <div
          style={{
            position: "absolute",
            top: "-25%",
            bottom: "-25%",
            width: "18%",
            left: `${t * 100}%`,
            transform: "skewX(-20deg)",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)",
          }}
        />
      ) : null}
    </div>
  );
};

type BodyProps = {
  W: number;
  frame: number;
  glare: boolean;
  screen?: string;
  screenBackground: string;
  lit: number;
  children?: React.ReactNode;
};

/** How far the keyboard deck reaches toward the viewer, as a fraction of the width. */
const DECK_DEPTH = 0.69;
/** How far the open lid leans back from vertical, in degrees. */
const LID_LEAN = 6;

const KEY_ROWS: { y: number; h: number; keys: number[] }[] = (() => {
  const rows: { y: number; h: number; keys: number[] }[] = [];
  rows.push({ y: 44, h: 30, keys: Array(14).fill(1) });
  rows.push({ y: 82, h: 54, keys: [...Array(13).fill(1), 1.5] });
  rows.push({ y: 142, h: 54, keys: [1.5, ...Array(13).fill(1)] });
  rows.push({ y: 202, h: 54, keys: [1.8, ...Array(11).fill(1), 1.8] });
  rows.push({ y: 262, h: 54, keys: [2.3, ...Array(10).fill(1), 2.3] });
  rows.push({ y: 322, h: 54, keys: [1, 1, 1, 1.25, 5.2, 1.25, 1, 1, 1] });
  return rows;
})();

type Projector = (x: number, y: number, z: number) => [number, number];

/**
 * The same projection the browser applies to the device body (its rotate X/Y/Z about the hinge,
 * then the container's perspective), so 2D shapes can be drawn exactly where 3D planes would be.
 */
const makeProjector = (W: number, H: number, rx: number, ry: number, rz: number, perspective: number): Projector => {
  const a = (rx * Math.PI) / 180;
  const b = (ry * Math.PI) / 180;
  const c = (rz * Math.PI) / 180;
  return (x, y, z) => {
    // Around the transform origin (the hinge: bottom center of the body).
    let px = x - W / 2;
    let py = y - H;
    let pz = z;
    // rotateZ, then rotateY, then rotateX (CSS applies the rightmost function first).
    [px, py] = [px * Math.cos(c) - py * Math.sin(c), px * Math.sin(c) + py * Math.cos(c)];
    [px, pz] = [px * Math.cos(b) + pz * Math.sin(b), -px * Math.sin(b) + pz * Math.cos(b)];
    [py, pz] = [py * Math.cos(a) - pz * Math.sin(a), py * Math.sin(a) + pz * Math.cos(a)];
    px += W / 2;
    py += H;
    const k = perspective / (perspective - pz);
    return [W / 2 + (px - W / 2) * k, H / 2 + (py - H / 2) * k];
  };
};

/** A rounded rectangle on the deck plane (u across, v toward the viewer), projected to a 2D path. */
const deckPath = (project: Projector, hingeY: number, u0: number, v0: number, w: number, h: number, r: number) => {
  const pts: [number, number][] = [];
  const corner = (cu: number, cv: number, from: number) => {
    for (let i = 0; i <= 4; i++) {
      const t = from + (i / 4) * (Math.PI / 2);
      pts.push(project(cu + Math.cos(t) * r, hingeY, cv + Math.sin(t) * r));
    }
  };
  corner(u0 + w - r, v0 + r, -Math.PI / 2);
  corner(u0 + w - r, v0 + h - r, 0);
  corner(u0 + r, v0 + h - r, Math.PI / 2);
  corner(u0 + r, v0 + r, Math.PI);
  return `M ${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")} Z`;
};

/**
 * The keyboard deck, lying flat from the hinge toward the viewer so a camera above sees the keys
 * and trackpad. Drawn as projected 2D shapes rather than a CSS 3D plane: under a strong camera
 * zoom, Chrome can drop the whole 3D context when a plane reaches toward the viewer.
 */
const Deck: React.FC<{
  W: number;
  H: number;
  D: number;
  hingeY: number;
  project: Projector;
  finish: keyof typeof FINISH;
  lit: number;
  sheen: number;
}> = ({ W, D, hingeY, project, finish, lit, sheen }) => {
  const f = FINISH[finish];
  const well = finish === "silver" ? "#2b2c30" : "#0b0b0d";
  const keyFill = finish === "silver" ? "#1d1e22" : "#151518";
  const su = W / 1000;
  const sv = D / 690;
  const [bx, by] = project(W / 2, hingeY, 0);
  const [fx, fy] = project(W / 2, hingeY, D);
  const id = `deck-${Math.round(W)}-${finish}`;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "visible", pointerEvents: "none" }}>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={bx} y1={by} x2={fx} y2={fy}>
          <stop offset="0%" stopColor={f.base[2]} />
          <stop offset="18%" stopColor={f.base[1]} />
          <stop offset="70%" stopColor={f.base[0]} />
          <stop offset="100%" stopColor={f.base[1]} />
        </linearGradient>
      </defs>
      <path
        d={deckPath(project, hingeY, 0, 0, W, D, W * 0.022)}
        fill={`url(#${id})`}
        stroke={rgba("#ffffff", 0.3 * lit)}
        strokeWidth={Math.max(1, W * 0.0012)}
      />
      {/* Brushed-metal sheen: a soft band of light across the deck that slides as the laptop turns. */}
      <defs>
        <linearGradient
          id={`${id}-sheen`}
          gradientUnits="userSpaceOnUse"
          x1={project(0, hingeY, D * 0.6)[0]}
          y1={0}
          x2={project(W, hingeY, D * 0.6)[0]}
          y2={0}
        >
          <stop offset={0.38 + sheen} stopColor="#ffffff" stopOpacity={0} />
          <stop offset={0.5 + sheen} stopColor="#ffffff" stopOpacity={0.16 * lit} />
          <stop offset={0.62 + sheen} stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={deckPath(project, hingeY, 0, 0, W, D, W * 0.022)} fill={`url(#${id}-sheen)`} />
      <path d={deckPath(project, hingeY, 86 * su, 34 * sv, 828 * su, 352 * sv, 10 * su)} fill={well} opacity={0.85} />
      {KEY_ROWS.flatMap((row, r) => {
        const unit = (812 - (row.keys.length - 1) * 6) / row.keys.reduce((a, b) => a + b, 0);
        let x = 94;
        return row.keys.map((k, i) => {
          const w = k * unit;
          const el = (
            <path
              // biome-ignore lint/suspicious/noArrayIndexKey: generated in a fixed, seeded order
              key={`${r}-${i}`}
              d={deckPath(project, hingeY, x * su, row.y * sv, w * su, row.h * sv, Math.min(6 * su, (row.h * sv) / 3))}
              fill={keyFill}
              stroke={rgba("#ffffff", 0.07)}
              strokeWidth={1}
            />
          );
          x += w + 6;
          return el;
        });
      })}
      <path
        d={deckPath(project, hingeY, 318 * su, 414 * sv, 364 * su, 238 * sv, 18 * su)}
        fill={rgba("#000000", 0.12)}
        stroke={rgba("#ffffff", 0.18 * lit)}
        strokeWidth={1.5}
      />
    </svg>
  );
};

const MacBookBody: React.FC<BodyProps & { finish: keyof typeof FINISH }> = ({
  W,
  frame,
  glare,
  screen,
  screenBackground,
  lit,
  finish,
  children,
}) => {
  const D = W * DECK_DEPTH;
  const f = FINISH[finish];
  const lidH = W * 0.645;
  const lidR = W * 0.021;
  const side = W * 0.021;
  const top = W * 0.024;
  const chin = W * 0.031;
  const baseH = W * 0.027;
  return (
    <>
      {/* Lid shell: anodised metal with a bevel catching the light along the top and sides; it leans
          back a few degrees on its hinge like an open laptop */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: lidH,
          transformOrigin: "50% 100%",
          transform: `rotateX(${LID_LEAN}deg)`,
          borderRadius: `${lidR}px ${lidR}px ${W * 0.006}px ${W * 0.006}px`,
          background: `linear-gradient(180deg, ${f.edge} 0%, ${f.body[0]} 1.6%, ${f.body[1]} 48%, ${f.body[2]} 100%)`,
          boxShadow: [
            `inset 0 ${Math.max(1, W * 0.0012)}px 0 ${rgba("#ffffff", 0.55 * lit)}`,
            `inset ${Math.max(1, W * 0.001)}px 0 0 ${rgba("#ffffff", 0.14 * lit)}`,
            `inset -${Math.max(1, W * 0.001)}px 0 0 ${rgba("#ffffff", 0.14 * lit)}`,
            `0 ${W * 0.02}px ${W * 0.07}px rgba(0,0,0,0.55)`,
          ].join(", "),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: Math.max(2, W * 0.0028),
            borderRadius: `${lidR - 1.5}px ${lidR - 1.5}px ${W * 0.005}px ${W * 0.005}px`,
            background: "#050506",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ position: "absolute", left: side, right: side, top, bottom: chin }}>
            <Screen screen={screen} background={screenBackground} radius={W * 0.01}>
              {children}
            </Screen>
            <div
              style={{
                position: "absolute",
                top: -top * 0.5,
                left: "50%",
                width: W * 0.085,
                height: top * 0.5 + W * 0.012,
                transform: "translateX(-50%)",
                borderRadius: `0 0 ${W * 0.008}px ${W * 0.008}px`,
                background: "#050506",
              }}
            />
            <Glass radius={W * 0.01} frame={frame} glare={glare} />
          </div>
        </div>
      </div>
      {/* Front lip of the base: a thin edge at the front of the deck, with the opening scoop */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: lidH - 1,
          width: W,
          height: baseH,
          transform: `translateZ(${D}px)`,
          borderRadius: `${W * 0.004}px ${W * 0.004}px ${baseH}px ${baseH}px`,
          background: `linear-gradient(180deg, ${f.edge} 0%, ${f.base[0]} 12%, ${f.base[1]} 55%, ${f.base[2]} 88%, #08080a 100%)`,
          boxShadow: `inset 0 ${Math.max(1, W * 0.0012)}px 0 ${rgba("#ffffff", 0.6 * lit)}, 0 ${W * 0.006}px ${W * 0.012}px rgba(0,0,0,0.6)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: W * 0.15,
            height: baseH * 0.34,
            transform: "translateX(-50%)",
            borderRadius: `0 0 ${W * 0.012}px ${W * 0.012}px`,
            background: `linear-gradient(180deg, ${f.base[2]}, ${f.base[1]})`,
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
          }}
        />
      </div>
    </>
  );
};

const PhoneBody: React.FC<BodyProps & { finish: keyof typeof FINISH; ry: number }> = ({
  W,
  frame,
  glare,
  screen,
  screenBackground,
  lit,
  finish,
  ry,
  children,
}) => {
  const f = FINISH[finish];
  const H = W * 2.06;
  const R = W * 0.17;
  const frameT = W * 0.016;
  const bezel = W * 0.032;
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: R,
          background: `linear-gradient(${120 + ry * 1.5}deg, ${f.edge} 0%, ${f.body[0]} 14%, ${f.body[1]} 46%, ${f.body[2]} 80%, ${f.edge} 100%)`,
          boxShadow: [
            `inset 0 0 0 ${Math.max(1, W * 0.003)}px ${rgba("#ffffff", 0.32 * lit)}`,
            `inset 0 ${Math.max(1, W * 0.006)}px ${W * 0.01}px ${rgba("#ffffff", 0.25 * lit)}`,
            `0 ${W * 0.05}px ${W * 0.14}px rgba(0,0,0,0.5)`,
          ].join(", "),
        }}
      />
      {[0.2, 0.29, 0.38].map((y, i) => (
        <div
          key={y}
          style={{
            position: "absolute",
            left: -W * 0.012,
            top: H * y,
            width: W * 0.015,
            height: i === 0 ? H * 0.045 : H * 0.075,
            borderRadius: W * 0.01,
            background: `linear-gradient(90deg, ${f.body[2]}, ${f.edge})`,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          right: -W * 0.012,
          top: H * 0.29,
          width: W * 0.015,
          height: H * 0.11,
          borderRadius: W * 0.01,
          background: `linear-gradient(270deg, ${f.body[2]}, ${f.edge})`,
        }}
      />
      <div style={{ position: "absolute", inset: frameT, borderRadius: R - frameT, background: "#030303" }}>
        <div style={{ position: "absolute", inset: bezel - frameT, borderRadius: R - bezel }}>
          <Screen screen={screen} background={screenBackground} radius={R - bezel}>
            {children}
          </Screen>
          <div
            style={{
              position: "absolute",
              top: W * 0.034,
              left: "50%",
              width: W * 0.3,
              height: W * 0.088,
              transform: "translateX(-50%)",
              borderRadius: W,
              background: "#000",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.05)",
            }}
          />
          <Glass radius={R - bezel} frame={frame} glare={glare} />
        </div>
      </div>
    </>
  );
};

/**
 * A studio product shot of a MacBook or iPhone: real proportions, bezels, notch / Dynamic Island,
 * metal bevels catching the light, glass reflections, the screen's bloom and light pool, a contact
 * shadow, an optional floor reflection, and an eased 3D angle that keeps swaying. Put the product's
 * real UI (or a screen recording) on its screen.
 */
export const Device: React.FC<DeviceProps> = ({
  kind = "macbook",
  finish,
  width: W,
  tilt,
  start = 0,
  duration,
  ease = "ease",
  glare = true,
  shadow = true,
  screen,
  screenBackground = "#000",
  glow,
  reflection = 0,
  sway = 2.5,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const clip = useClipDuration();
  const p = ramp(frame, start, duration ?? Math.max(1, clip - start), ease);
  const from = { x: tilt?.from?.x ?? 0, y: tilt?.from?.y ?? 0, z: tilt?.from?.z ?? 0 };
  const to = { x: tilt?.to?.x ?? from.x, y: tilt?.to?.y ?? from.y, z: tilt?.to?.z ?? from.z };
  // After (and during) the move, a slow sway keeps the product alive.
  const swayY = Math.sin(frame / 75) * sway;
  const swayX = Math.cos(frame / 95) * sway * 0.4;
  const rx = from.x + (to.x - from.x) * p + swayX;
  const ry = from.y + (to.y - from.y) * p + swayY;
  const rz = from.z + (to.z - from.z) * p;
  const lit = clamp(0.7 + ry / 50, 0.35, 1); // the bevel catches more light as the device turns

  const phone = kind === "iphone";
  const finishKey: keyof typeof FINISH = phone
    ? finish === "black"
      ? "black"
      : "titanium"
    : finish === "silver"
      ? "silver"
      : "space-black";
  const H = phone ? W * 2.06 : W * 0.645 + W * 0.027;
  // MacBook: tilt.x is the camera's height (positive looks down onto the keyboard deck).
  const rotate = `rotateX(${phone ? rx : -rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
  // Where the front of the deck lands on screen, for the shadow, light pool and reflection.
  const drop = (deg: number) => (phone ? 0 : W * DECK_DEPTH * Math.sin((Math.max(0, deg) * Math.PI) / 180));
  const deckDrop = drop(rx);
  // The layout box includes the deck at its steepest angle in this move, so a centered laptop stays
  // centered (and doesn't drift as the angle eases).
  const layoutDrop = drop(Math.max(from.x, to.x) + sway * 0.4);
  const body = (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: W,
        height: H,
        transformStyle: "preserve-3d",
        transformOrigin: phone ? "50% 50%" : "50% 100%",
        transform: rotate,
      }}
    >
      {phone ? (
        <PhoneBody
          W={W}
          frame={frame}
          glare={glare}
          screen={screen}
          screenBackground={screenBackground}
          lit={lit}
          finish={finishKey}
          ry={ry}
        >
          {children}
        </PhoneBody>
      ) : (
        <MacBookBody W={W} frame={frame} glare={glare} screen={screen} screenBackground={screenBackground} lit={lit} finish={finishKey}>
          {children}
        </MacBookBody>
      )}
    </div>
  );

  return (
    <div
      style={{
        position: "relative",
        width: W,
        height: H + layoutDrop,
        perspective: W * (phone ? 9 : 4.5),
        perspectiveOrigin: `50% ${(H / 2 / (H + layoutDrop)) * 100}%`,
        ...style,
      }}
    >
      {glow ? (
        // Screen bloom: the display lights the space around and behind the device.
        <div
          style={{
            position: "absolute",
            left: "-18%",
            right: "-18%",
            top: phone ? "-8%" : "-14%",
            bottom: phone ? "-8%" : "10%",
            background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${rgba(glow, 0.32)} 0%, ${rgba(glow, 0.1)} 45%, transparent 72%)`,
            filter: `blur(${W * 0.04}px)`,
          }}
        />
      ) : null}
      {shadow ? (
        <div
          style={{
            position: "absolute",
            left: phone ? "10%" : "-6%",
            right: phone ? "10%" : "-6%",
            top: H - W * (phone ? 0.04 : 0.01) + deckDrop,
            height: W * (phone ? 0.1 : 0.05),
            borderRadius: "50%",
            background: `radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 40%, transparent 70%)`,
            filter: `blur(${W * 0.012}px)`,
          }}
        />
      ) : null}
      {glow ? (
        <div
          style={{
            position: "absolute",
            left: "5%",
            right: "5%",
            top: H - W * 0.01 + deckDrop,
            height: W * 0.14,
            background: `radial-gradient(ellipse 50% 45% at 50% 20%, ${rgba(glow, 0.28)} 0%, transparent 70%)`,
            filter: `blur(${W * 0.02}px)`,
          }}
        />
      ) : null}
      {!phone && rx > 0.5 ? (
        <Deck
          W={W}
          H={H}
          D={W * DECK_DEPTH}
          hingeY={W * 0.645}
          project={makeProjector(W, H, -rx, ry, rz, W * 4.5)}
          finish={finishKey}
          lit={lit}
          sheen={Math.max(-0.3, Math.min(0.3, ry / 60))}
        />
      ) : null}
      {body}
      {reflection > 0 ? (
        // Floor mirror: the same body flipped below the base, fading out with distance.
        <div
          style={{
            position: "absolute",
            left: 0,
            width: W,
            top: deckDrop,
            height: H,
            // Flipped about the device's base line (the front of the deck), so the mirror hangs below it.
            transform: "scaleY(-1)",
            transformOrigin: "50% 100%",
            opacity: reflection,
            WebkitMaskImage: "linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.25) 22%, transparent 45%)",
            maskImage: "linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.25) 22%, transparent 45%)",
            filter: `blur(${W * 0.002}px)`,
            pointerEvents: "none",
          }}
        >
          <div style={{ position: "relative", width: W, height: H, perspective: W * (phone ? 9 : 4.5) }}>{body}</div>
        </div>
      ) : null}
    </div>
  );
};
