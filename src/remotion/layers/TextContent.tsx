import type React from "react";
import { useVideoConfig } from "remotion";
import type { AnimState } from "../../core/animation";
import { evaluateAny, evaluateNumber } from "../../core/keyframes";
import type { TextClip, TextStyle } from "../../core/schema";
import { evaluateTextUnit, splitTextUnits } from "../../core/text-animation";
import { fontStack, useFonts } from "../fonts";
import { fillToCss } from "./BackgroundContent";

const stateToCss = (s: AnimState): React.CSSProperties => {
  const transforms: string[] = [];
  if (s.dx || s.dy) transforms.push(`translate(${s.dx}px, ${s.dy}px)`);
  if (s.rotate) transforms.push(`rotate(${s.rotate}deg)`);
  if (s.rotateX) transforms.push(`perspective(800px) rotateX(${s.rotateX}deg)`);
  if (s.skewX) transforms.push(`skewX(${s.skewX}deg)`);
  const sx = s.scale * s.scaleX;
  const sy = s.scale * s.scaleY;
  if (sx !== 1 || sy !== 1) transforms.push(`scale(${sx}, ${sy})`);
  return {
    transform: transforms.length ? transforms.join(" ") : undefined,
    opacity: s.opacity === 1 ? undefined : Math.max(0, Math.min(1, s.opacity)),
    filter: s.blur > 0.05 ? `blur(${s.blur.toFixed(2)}px)` : undefined,
  };
};

/** Typography shared by text clips and motion components. */
export const textStyleToCss = (
  style: TextStyle,
  overrides: { color?: string; fontSize?: number; letterSpacing?: number } = {},
): React.CSSProperties => {
  const color = overrides.color ?? style.color;
  const gradient = style.gradient ? fillToCss(style.gradient) : undefined;
  return {
    fontFamily: fontStack(style.fontFamily),
    fontWeight: style.fontWeight,
    fontStyle: style.italic ? "italic" : "normal",
    fontSize: overrides.fontSize ?? style.fontSize,
    lineHeight: style.lineHeight,
    letterSpacing: `${overrides.letterSpacing ?? style.letterSpacing}em`,
    textTransform: style.textTransform,
    textAlign: style.align,
    color: gradient ? "transparent" : color,
    backgroundImage: gradient,
    WebkitBackgroundClip: gradient ? "text" : undefined,
    backgroundClip: gradient ? "text" : undefined,
    WebkitTextFillColor: gradient ? "transparent" : undefined,
    WebkitTextStroke: style.stroke && style.stroke.width > 0 ? `${style.stroke.width}px ${style.stroke.color}` : undefined,
    paintOrder: style.stroke ? "stroke fill" : undefined,
    textShadow: style.shadow ? `${style.shadow.x}px ${style.shadow.y}px ${style.shadow.blur}px ${style.shadow.color}` : undefined,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    fontKerning: "normal",
    textRendering: "geometricPrecision",
  };
};

export const TextContent: React.FC<{ clip: TextClip; frame: number }> = ({ clip, frame }) => {
  const { width: W, height: H } = useVideoConfig();
  const unit = Math.min(W, H) / 1080;
  const { style } = clip;
  useFonts([{ family: style.fontFamily, weight: style.fontWeight, italic: style.italic }]);

  const color = evaluateAny(clip.keyframes, "style.color", frame, style.color);
  const fontSize = evaluateNumber(clip.keyframes, "style.fontSize", frame, style.fontSize);
  const letterSpacing = evaluateNumber(clip.keyframes, "style.letterSpacing", frame, style.letterSpacing);
  const css = textStyleToCss(style, { color, fontSize, letterSpacing });

  const bg = style.background;
  const wrapBackground = (children: React.ReactNode) =>
    bg ? (
      <span
        style={{
          backgroundColor: bg.color,
          padding: `${bg.paddingY}px ${bg.paddingX}px`,
          borderRadius: bg.radius,
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
        }}
      >
        {children}
      </span>
    ) : (
      children
    );

  const anim = clip.textAnimation;
  if (!anim || anim.type === "none") {
    return <div style={{ ...css, width: "100%" }}>{wrapBackground(clip.text)}</div>;
  }

  const ctx = { unit, canvasWidth: W, canvasHeight: H, seedFrame: clip.start + frame };
  const lines = splitTextUnits(clip.text, anim.unit);
  const total = lines.reduce((n, l) => n + l.filter((u) => !u.isSpace).length, 0);
  const typed = anim.type === "typewriter" ? Math.min(total, anim.stagger > 0 ? Math.floor(frame / anim.stagger) + 1 : total) : total;
  const typing = anim.type === "typewriter" && typed < total;
  const showCursor = anim.type === "typewriter" && frame < (total - 1) * anim.stagger + anim.duration + 45;
  const cursorOn = typing || Math.floor(frame / 15) % 2 === 0;
  const cursor = (
    <span
      key="cursor"
      style={{
        display: "inline-block",
        width: "0.07em",
        height: "0.95em",
        marginLeft: "0.04em",
        verticalAlign: "-0.1em",
        backgroundColor: color,
        opacity: cursorOn ? 1 : 0,
      }}
    />
  );
  let index = 0;
  const rendered = lines.map((units, lineIndex) => {
    const lineKey = `l${lineIndex}`;
    const children = units.map((u, ui) => {
      const key = `${lineKey}-${ui}`;
      if (u.isSpace) return <span key={key}>{u.text}</span>;
      const i = index++;
      const r = evaluateTextUnit(anim, frame, i, u.text, ctx);
      if (anim.type === "typewriter") {
        const visible = i < typed;
        return (
          <span key={key}>
            <span style={{ visibility: visible ? "visible" : "hidden" }}>{u.text}</span>
            {showCursor && i === Math.max(0, typed - 1) ? cursor : null}
          </span>
        );
      }
      if (anim.type === "mask-up") {
        return (
          <span key={key} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.08em" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(r.state.innerDy * 100).toFixed(2)}%)` }}>{u.text}</span>
          </span>
        );
      }
      if (anim.type === "highlight") {
        return (
          <span key={key} style={{ position: "relative", display: "inline-block" }}>
            <span
              style={{
                position: "absolute",
                left: "-0.08em",
                right: "-0.08em",
                bottom: "0.08em",
                height: "0.42em",
                backgroundColor: anim.accentColor ?? "rgba(255, 214, 10, 0.85)",
                transformOrigin: "0% 50%",
                transform: `scaleX(${(r.highlight ?? 0).toFixed(3)})`,
                borderRadius: "0.08em",
              }}
            />
            <span style={{ position: "relative" }}>{u.text}</span>
          </span>
        );
      }
      return (
        <span key={key} style={{ display: "inline-block", whiteSpace: "pre", ...stateToCss(r.state) }}>
          {r.displayText ?? u.text}
        </span>
      );
    });
    return (
      <span key={lineKey} style={{ display: "block" }}>
        {children}
      </span>
    );
  });

  return <div style={{ ...css, width: "100%" }}>{wrapBackground(rendered)}</div>;
};
