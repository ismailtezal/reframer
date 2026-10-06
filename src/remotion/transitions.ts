import { type AnimState, hash01, identityAnim } from "../core/animation";
import { resolveEasing } from "../core/easing";
import type { Direction, Transition } from "../core/schema";

/**
 * Transitions are evaluated on both sides of a cut:
 * - the incoming clip ("entering") during its first `duration` frames,
 * - the outgoing clip ("exiting") during the extra tail frames it borrows.
 * Both get an AnimState plus optional overlay info (flash / dip color).
 */

export type TransitionSide = "entering" | "exiting";

export type TransitionVisual = {
  state: AnimState;
  /** Solid overlay color + opacity drawn over this side (dips, flashes). */
  overlay?: { color: string; opacity: number };
  /** Draw a light leak over the cut (handled by the composition). */
  lightLeak?: number;
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

export const transitionVisual = (
  t: Transition,
  side: TransitionSide,
  rawProgress: number,
  canvas: { width: number; height: number },
  seedFrame: number,
): TransitionVisual => {
  const p = resolveEasing(
    t.easing,
    t.type === "fade" || t.type.startsWith("dip") ? "ease-in-out" : "smooth",
  )(Math.min(1, Math.max(0, rawProgress)));
  const s = identityAnim();
  const entering = side === "entering";
  // `v` is how "present" this side is: entering 0→1, exiting 1→0.
  const v = entering ? p : 1 - p;
  // "content travels in direction d": entering comes from the opposite side.
  const [dx, dy] = dirVec(t.direction);

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
    case "slide":
      if (entering) {
        s.dx = -dx * (1 - p) * canvas.width;
        s.dy = -dy * (1 - p) * canvas.height;
      }
      return { state: s };
    case "push":
      s.dx = entering ? -dx * (1 - p) * canvas.width : dx * p * canvas.width;
      s.dy = entering ? -dy * (1 - p) * canvas.height : dy * p * canvas.height;
      return { state: s };
    case "wipe": {
      if (!entering) return { state: s };
      const amt = 1 - p;
      const d = t.direction ?? "right";
      s.inset =
        d === "right"
          ? { top: 0, right: amt, bottom: 0, left: 0 }
          : d === "left"
            ? { top: 0, right: 0, bottom: 0, left: amt }
            : d === "down"
              ? { top: 0, right: 0, bottom: amt, left: 0 }
              : { top: amt, right: 0, bottom: 0, left: 0 };
      return { state: s };
    }
    case "zoom-in":
      if (entering) {
        s.scale = 0.8 + 0.2 * p;
        s.opacity = p;
      } else {
        s.scale = 1 + 0.6 * p;
        s.opacity = 1 - p * 0.6;
        s.blur = p * 18;
      }
      return { state: s };
    case "zoom-out":
      if (entering) {
        s.scale = 1.6 - 0.6 * p;
        s.opacity = p;
        s.blur = (1 - p) * 18;
      } else {
        s.scale = 1 - 0.25 * p;
        s.opacity = 1 - p * 0.5;
      }
      return { state: s };
    case "whip": {
      // Fast push with motion blur peaking at the cut.
      const blurAmt = Math.sin(Math.PI * p) * 40;
      s.dx = entering ? -dx * (1 - p) * canvas.width : dx * p * canvas.width;
      s.dy = entering ? -dy * (1 - p) * canvas.height : dy * p * canvas.height;
      s.blur = blurAmt;
      return { state: s };
    }
    case "blur":
      s.blur = (1 - v) * 30;
      s.opacity = entering ? p : 1;
      return { state: s };
    case "flash": {
      const flash = 1 - Math.abs(p - 0.5) * 2;
      if (entering) s.opacity = p >= 0.5 ? 1 : 0;
      return { state: s, overlay: { color: "#ffffff", opacity: entering ? Math.max(0, flash) : Math.max(0, flash) } };
    }
    case "glitch": {
      const active = Math.sin(Math.PI * p);
      s.dx = (hash01(seedFrame * 3.7) - 0.5) * 80 * active;
      s.skewX = (hash01(seedFrame * 1.9 + 2) - 0.5) * 24 * active;
      if (entering) s.opacity = hash01(seedFrame + 11) < p ? 1 : 0;
      return { state: s };
    }
    case "iris":
      if (entering) s.circle = p;
      return { state: s };
    case "clock-wipe":
      // Approximated with an iris + slight rotation for broad renderer support.
      if (entering) {
        s.circle = p;
        s.rotate = (1 - p) * -30;
      }
      return { state: s };
    case "spin":
      if (entering) {
        s.rotate = (1 - p) * -180;
        s.scale = 0.5 + 0.5 * p;
        s.opacity = p;
      } else {
        s.rotate = p * 180;
        s.scale = 1 - 0.5 * p;
        s.opacity = 1 - p;
      }
      return { state: s };
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
      s.opacity = entering ? p : 1;
      return { state: s, lightLeak: p };
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
  blur: "Blur",
  flash: "Flash",
  glitch: "Glitch",
  iris: "Iris",
  "clock-wipe": "Clock wipe",
  spin: "Spin",
  flip: "Flip",
  "light-leak": "Light leak",
};
