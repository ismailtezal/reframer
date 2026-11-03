import { createContext, useContext } from "react";

/** One scene's light (see <SceneLight>): what shadows fall into, the key light's color and side. */
export type SceneLightValue = { ambient: string; light: string; strength: number; side: "left" | "right" };

export const SceneLightContext = createContext<SceneLightValue | null>(null);

/** The nearest <SceneLight>, or null outside one. */
export const useSceneLight = () => useContext(SceneLightContext);

/** Where the key light comes from as a direction (up-left by default, up-right for a light on the right). */
export const sceneLightDir = (s: SceneLightValue | null) => ({ x: s?.side === "right" ? 0.6 : -0.6, y: -0.8 });
