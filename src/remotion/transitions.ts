import { type AnimState, hash01, identityAnim } from "../core/animation";
import { resolveEasing } from "../core/easing";
import type { Direction, Easing, Transition } from "../core/schema";

/**
 * Transitions are evaluated on both sides of a cut:
 * - the incoming clip ("entering") during its first `duration` frames,
 * - the outgoing clip ("exiting") during the extra tail frames it borrows.
 * Both get an AnimState plus optional overlay info (flash / dip color).
 *
 * What separates plugin transitions (FilmImpact, Premiere Composer) from CSS
 * slides is camera optics: motion blur that follows the speed of the move,
 * radial blur on zooms and spins, exposure blow-outs, lens bends and channel
 * splits, all peaking exactly at the cut. Those come back in `fx`.
 */

export type TransitionSide = "entering" | "exiting";

export type TransitionVisual = {
  state: AnimState;
  /** Solid overlay color + opacity drawn over this side (dips, flashes). */
  overlay?: { color: string; opacity: number };
  /** Draw a light leak over the cut (handled by the composition). */
  lightLeak?: number;
  /**
   * Camera-style optics, the difference between a CSS slide and a plugin transition.
   * Media clips get them as GPU effects; text, shapes and components get SVG/CSS equivalents.
   */
  fx?: TransitionFx;
  /** CSS mask-image for feathered reveals (wipes, iris, clock wipe). */
  mask?: string;
};

export type TransitionFx = {
  /** Directional motion blur along the move, in px at 1080p. */
  motionBlur?: { x: number; y: number };
  /** Radial (zoom) blur from the frame center, in px at 1080p. */
  zoomBlur?: number;
  /** RGB channel split in px at 1080p, along `angle` degrees. */
  rgbSplit?: { amount: number; angle: number };
  /** Exposure boost in stops (flash / blow-out transitions). */
  exposure?: number;
  /** Barrel lens bend, 0..1. */
  lens?: number;
  /** CRT scanline strength 0..1 (glitch); media only. */
  scanlines?: number;
};

const dirVec = (d: Direction | undefined): [number, number] => {
  switch (d ?? "left") {
    case "left":
      return [-1, 0];
    case "right":
      return [1, 0];
    case "up":
      return [0, -1];
    case "down":
      return [0, 1];
  }
};

/** The curve plugin transitions use: slow off the mark, fastest at the cut, landing softly (easeInOutQuint). */
const IN_OUT: Easing = { type: "bezier", x1: 0.83, y1: 0, x2: 0.17, y2: 1 };
/** An even sharper curve for whip pans. */
const WHIP: Easing = { type: "bezier", x1: 0.9, y1: 0, x2: 0.1, y2: 1 };
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Cubic legs for midpoint-swap transitions: accelerate into the cut, decelerate out of it. */
const accel = (x: number) => x ** 3;
const decel = (x: number) => 1 - (1 - x) ** 3;

/** 180° shutter: the blur is half the distance travelled per frame. */
const SHUTTER = 0.5;
const MAX_MOTION_BLUR = 110;

export const transitionVisual = (
  t: Transition,
  side: TransitionSide,
  rawProgress: number,
  canvas: { width: number; height: number },
  seedFrame: number,
  fps = 30,
): TransitionVisual => {
  const raw = clamp01(rawProgress);
  // Dissolves and graphic reveals move evenly (in-out); everything else uses its own curve below.
  const evenly = ["fade", "dip-to-black", "dip-to-white", "blur", "light-leak", "wipe", "iris", "clock-wipe"].includes(t.type);
  const p = resolveEasing(t.easing, evenly ? "ease-in-out" : "smooth")(raw);
  const s = identityAnim();
  const entering = side === "entering";
  // "content travels in direction d": entering comes from the opposite side.
  const [dx, dy] = dirVec(t.direction);
  const unit = Math.min(canvas.width, canvas.height) / 1080;
  const frames = Math.max(1, t.duration);

  /** Both pictures travel together on an in-out curve, blurred by their speed. */
  const travel = (easing: Easing) => {
    const curve = resolveEasing(t.easing ?? easing);
    const e = curve(raw);
    const speed = Math.abs(curve(Math.min(1, raw + 0.01)) - curve(Math.max(0, raw - 0.01))) / 0.02;
    const distance = (dx !== 0 ? canvas.width : canvas.height) / unit;
    const blurPx = Math.min(MAX_MOTION_BLUR, ((speed * distance) / frames) * SHUTTER);
    // Blurred edges fade out; the incoming picture overlaps the outgoing one by the blur width so no seam shows.
    const overlap = entering ? blurPx * unit : 0;
    return { e, overlap, blur: { x: Math.abs(dx) * blurPx, y: Math.abs(dy) * blurPx } };
  };
  // Midpoint-swap transitions (zoom, spin, stretch, warp, flash): each side's leg runs over half the transition.
  const half = entering ? clamp01(raw * 2 - 1) : clamp01(raw * 2);
  const leg = entering ? 1 - decel(half) : accel(half);
  /** Speed of the leg, 0..1, peaking at the cut. */
  const legSpeed = entering ? (1 - half) ** 2 : half ** 2;
  const hidden = entering && raw < 0.5;

  switch (t.type) {
    case "fade":
      s.opacity = entering ? p : 1;
      return { state: s };
    case "dip-to-black":
    case "dip-to-white": {
      const color = t.type === "dip-to-black" ? "#000000" : "#ffffff";
      // First half: outgoing dips to color. Second half: incoming rises from color.
      if (entering) {
        s.opacity = p >= 0.5 ? 1 : 0;
        return { state: s, overlay: { color, opacity: p >= 0.5 ? 1 - (p - 0.5) * 2 : 1 } };
      }
      return { state: s, overlay: { color, opacity: Math.min(1, p * 2) } };
    }
    case "slide": {
      if (!entering) return { state: s };
      const { e, blur } = travel(IN_OUT);
      s.dx = -dx * (1 - e) * canvas.width;
      s.dy = -dy * (1 - e) * canvas.height;
      return { state: s, fx: { motionBlur: blur } };
    }
    case "push": {
      const { e, blur, overlap } = travel(IN_OUT);
      s.dx = entering ? -dx * ((1 - e) * canvas.width - overlap) : dx * e * canvas.width;
      s.dy = entering ? -dy * ((1 - e) * canvas.height - overlap) : dy * e * canvas.height;
      return { state: s, fx: { motionBlur: blur } };
    }
    case "whip": {
      // A camera whip: a push so fast the picture smears, with a slight lens punch at the cut.
      const { e, blur, overlap } = travel(WHIP);
      s.dx = entering ? -dx * ((1 - e) * canvas.width - overlap * 1.4) : dx * e * canvas.width;
      s.dy = entering ? -dy * ((1 - e) * canvas.height - overlap * 1.4) : dy * e * canvas.height;
      const peak = Math.sin(Math.PI * raw);
      s.scale = 1 + 0.06 * peak;
      return {
        state: s,
        fx: { motionBlur: { x: blur.x * 1.4, y: blur.y * 1.4 }, rgbSplit: { amount: 3 * peak, angle: dx !== 0 ? 0 : 90 } },
      };
    }
    case "stretch": {
      // Squash-and-stretch along the move: the outgoing shot streaks away, the new one snaps back into shape.
      const along = dx !== 0;
      const k = 1 + 2.2 * leg;
      if (along) s.scaleX = k;
      else s.scaleY = k;
      const offset = (entering ? -1 : 1) * leg * 0.35;
      s.dx = dx * offset * canvas.width;
      s.dy = dy * offset * canvas.height;
      if (hidden) s.opacity = 0;
      const blurPx = MAX_MOTION_BLUR * 0.8 * legSpeed;
      return { state: s, fx: { motionBlur: { x: along ? blurPx : 0, y: along ? 0 : blurPx } } };
    }
    case "zoom-in":
    case "zoom-out": {
      // Zoom through the cut, scaled exponentially (linear scale reads fast-then-slow); speed and radial blur
      // peak exactly where the picture swaps.
      const into = t.type === "zoom-in";
      const z = entering ? (into ? 1.8 : 2.4) : into ? 2.0 : 1.15;
      s.scale = Math.exp(Math.log(z) * leg);
      if (hidden) s.opacity = 0;
      return { state: s, fx: { zoomBlur: 75 * legSpeed, exposure: 0.3 * legSpeed } };
    }
    case "spin": {
      // Rotate through the cut with radial blur hiding the corners at peak speed.
      const turn = dx < 0 || dy < 0 ? -90 : 90;
      s.rotate = entering ? -turn * leg : turn * leg;
      // Scale just enough that the rotated picture always covers the frame (no black corners).
      const theta = (Math.abs(s.rotate) * Math.PI) / 180;
      const aspect = Math.max(canvas.width, canvas.height) / Math.min(canvas.width, canvas.height);
      s.scale = Math.max(1 + 0.2 * leg, Math.cos(theta) + aspect * Math.sin(theta));
      if (hidden) s.opacity = 0;
      return { state: s, fx: { zoomBlur: 90 * legSpeed } };
    }
    case "warp": {
      // Lens warp: the picture bulges toward the camera into the cut and relaxes after it.
      // The lens pulls the edges inward, so the picture is overscanned to keep the corners covered.
      s.scale = 1 + 0.65 * leg;
      if (hidden) s.opacity = 0;
      return { state: s, fx: { lens: 0.5 * leg, zoomBlur: 40 * legSpeed, rgbSplit: { amount: 4 * leg, angle: 0 } } };
    }
    case "blur": {
      // Blur dissolve: both pictures defocus toward the middle while crossfading. A blurred full frame pulls
      // dark edges in, so it is overscanned by the blur radius.
      const blurPx = Math.sin(Math.PI * p) * 22 * unit;
      s.blur = blurPx;
      s.scale = 1 + (3 * blurPx) / Math.min(canvas.width, canvas.height);
      s.opacity = entering ? p : 1;
      return { state: s };
    }
    case "flash": {
      // Exposure flash: the outgoing shot blows out, the incoming one comes back down from white.
      const peak = 1 - Math.abs(raw - 0.5) * 2;
      if (hidden) s.opacity = 0;
      return {
        state: s,
        fx: { exposure: 3.2 * accel(peak) },
        overlay: { color: "#ffffff", opacity: Math.max(0, peak - 0.55) * 1.6 },
      };
    }
    case "glitch": {
      // Digital glitch: channel split, horizontal tearing and scanlines that burst around the cut. States hold for
      // ~12 Hz steps (per-frame noise reads as crude), and the reveal flicks back to the old shot at least once.
      const step = Math.floor(seedFrame / Math.max(1, Math.round(fps / 12)));
      const burst = Math.sin(Math.PI * raw) ** 0.42;
      const r = (k: number) => hash01(step * 7.31 + k);
      s.dx = (r(1) - 0.5) * 110 * burst * unit;
      s.skewX = (r(2) - 0.5) * 14 * burst;
      // Oversized so the jitter and skew never reveal the frame edge.
      s.scale = 1 + 0.14 * burst;
      if (entering) s.opacity = r(3) < raw * 1.25 - 0.12 ? 1 : 0;
      return {
        state: s,
        fx: {
          rgbSplit: { amount: (8 + 30 * r(4)) * burst, angle: r(5) > 0.5 ? 0 : 180 },
          motionBlur: { x: 24 * burst * r(6), y: 0 },
          scanlines: 0.35 * burst,
          exposure: r(7) > 0.75 ? 0.6 * burst : 0,
        },
      };
    }
    case "wipe": {
      // Soft wipe: a feathered edge travelling across the frame.
      if (!entering) return { state: s };
      const to = { right: "right", left: "left", down: "bottom", up: "top" }[t.direction ?? "right"];
      const feather = 8;
      const edge = p * (100 + feather);
      return { state: s, mask: `linear-gradient(to ${to}, #000 ${(edge - feather).toFixed(2)}%, transparent ${edge.toFixed(2)}%)` };
    }
    case "iris": {
      if (!entering) return { state: s };
      const r = p * 106;
      return {
        state: s,
        mask: `radial-gradient(circle farthest-corner at 50% 50%, #000 ${Math.max(0, r - 6).toFixed(2)}%, transparent ${r.toFixed(2)}%)`,
      };
    }
    case "clock-wipe": {
      // A true radial sweep with a slightly soft leading edge.
      if (!entering) return { state: s };
      const deg = p * 364;
      return {
        state: s,
        mask: `conic-gradient(from 0deg at 50% 50%, #000 ${Math.max(0, deg - 4).toFixed(2)}deg, transparent ${deg.toFixed(2)}deg)`,
      };
    }
    case "flip":
      if (entering) {
        s.rotateY = (1 - p) * -90;
        s.opacity = p > 0.5 ? 1 : 0;
      } else {
        s.rotateY = p * 90;
        s.opacity = p < 0.5 ? 1 : 0;
      }
      return { state: s };
    case "light-leak":
      // The swap hides under the leak's brightest frames instead of a long ghosting crossfade.
      s.opacity = entering ? clamp01((p - 0.38) / 0.24) : 1;
      return { state: s, lightLeak: p, fx: { exposure: 0.6 * Math.sin(Math.PI * p) } };
  }
};

export const TRANSITION_LABELS: Record<Transition["type"], string> = {
  fade: "Cross dissolve",
  "dip-to-black": "Dip to black",
  "dip-to-white": "Dip to white",
  slide: "Slide",
  push: "Push",
  wipe: "Wipe",
  "zoom-in": "Zoom in",
  "zoom-out": "Zoom out",
  whip: "Whip pan",
  blur: "Blur dissolve",
  flash: "Flash",
  glitch: "Glitch",
  iris: "Iris",
  "clock-wipe": "Clock wipe",
  spin: "Spin",
  flip: "Flip",
  "light-leak": "Light leak",
  stretch: "Stretch",
  warp: "Lens warp",
};
