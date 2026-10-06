import type React from "react";
import type { TransitionFx } from "./transitions";

/**
 * Transition optics for DOM layers (text, shapes, components), which can't take
 * GPU effects: directional blur via feGaussianBlur's per-axis deviation and an
 * RGB split from per-channel offsets. Exposure is applied as CSS brightness by
 * the caller; zoom blur falls back to a soft uniform blur.
 */
export const TransitionFilter: React.FC<{ id: string; fx: TransitionFx; unit: number }> = ({ id, fx, unit }) => {
  // feGaussianBlur's deviation is ~1/2 of a box radius; the GPU blur uses radius.
  const bx = ((fx.motionBlur?.x ?? 0) + (fx.zoomBlur ?? 0) * 0.15) * unit * 0.5;
  const by = ((fx.motionBlur?.y ?? 0) + (fx.zoomBlur ?? 0) * 0.15) * unit * 0.5;
  const split = fx.rgbSplit && fx.rgbSplit.amount * unit > 0.3 ? fx.rgbSplit : undefined;
  const dx = split ? Math.cos((split.angle * Math.PI) / 180) * split.amount * unit * 0.5 : 0;
  const dy = split ? Math.sin((split.angle * Math.PI) / 180) * split.amount * unit * 0.5 : 0;
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation={`${bx.toFixed(2)} ${by.toFixed(2)}`} result="moved" />
        {split ? (
          <>
            <feColorMatrix in="moved" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
            <feOffset in="red" dx={dx} dy={dy} result="redShift" />
            <feColorMatrix in="moved" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
            <feColorMatrix in="moved" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
            <feOffset in="blue" dx={-dx} dy={-dy} result="blueShift" />
            <feBlend in="redShift" in2="green" mode="screen" result="redGreen" />
            <feBlend in="redGreen" in2="blueShift" mode="screen" />
          </>
        ) : null}
      </filter>
    </svg>
  );
};

/** Whether the optics need the SVG filter at all for a DOM layer. */
export const needsSvgFilter = (fx: TransitionFx | undefined, unit: number) =>
  !!fx &&
  ((fx.motionBlur?.x ?? 0) * unit > 0.5 ||
    (fx.motionBlur?.y ?? 0) * unit > 0.5 ||
    (fx.zoomBlur ?? 0) * unit > 3 ||
    (fx.rgbSplit?.amount ?? 0) * unit > 0.3);
