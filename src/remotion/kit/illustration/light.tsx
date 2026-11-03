import type React from "react";
import { useMemo } from "react";
import { SceneLightContext, useSceneLight } from "./light-context";
import { mix } from "./shade";

/**
 * One light for a whole scene. Illustrators paint every object in the same light: its shadows lean
 * toward the ambient color (the sky's blue at night, warm in a sunset), its lit edges toward the light,
 * and everything is lit from the same side. Without it each kit object keeps its own default colors,
 * which read as clip-art pasted onto the scene.
 */
export type SceneLightProps = {
  /** The color the shadows fall into: usually the sky's (or the room's) dominant tone. */
  ambient?: string;
  /** The key light's color (sun, lamp, glow). */
  light?: string;
  /** 0–1.5: how strongly the scene's colors pull on its objects (1 = a clear, natural unity). */
  strength?: number;
  /** Which side the key light comes from. */
  side?: "left" | "right";
  children?: React.ReactNode;
};

export const SceneLight: React.FC<SceneLightProps> = ({
  ambient = "#1d2a6b",
  light = "#ffe2b0",
  strength = 1,
  side = "left",
  children,
}) => {
  const value = useMemo(() => ({ ambient, light, strength, side }), [ambient, light, strength, side]);
  return <SceneLightContext.Provider value={value}>{children}</SceneLightContext.Provider>;
};

export type ScenePaint = {
  /** An object's own color in the scene's light. */
  base: (color: string) => string;
  /** Its shadow side, pulled toward the ambient color. */
  shadow: (color: string) => string;
  /** Its lit side, tinted by the light. */
  lit: (color: string) => string;
  /** -1 when the light comes from the right (mirror light-dependent drawing). */
  flip: 1 | -1;
};

const identity: ScenePaint = { base: (c) => c, shadow: (c) => c, lit: (c) => c, flip: 1 };

/** Colors for an object under the nearest <SceneLight> (unchanged without one). */
export const useScenePaint = (): ScenePaint => {
  const s = useSceneLight();
  return useMemo(() => {
    if (!s) return identity;
    const k = Math.max(0, Math.min(1.5, s.strength));
    return {
      base: (c) => mix(c, s.ambient, 0.14 * k),
      shadow: (c) => mix(c, s.ambient, 0.34 * k),
      lit: (c) => mix(c, s.light, 0.24 * k),
      flip: s.side === "right" ? -1 : 1,
    };
  }, [s]);
};
