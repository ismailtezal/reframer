import type React from "react";
import type { PropField } from "../../core/schema";

export const MOTION_CATEGORIES = ["text", "background", "data", "device", "social", "annotation", "brand", "overlay"] as const;
export type MotionCategory = (typeof MOTION_CATEGORIES)[number];

/**
 * Every motion component receives its box size in canvas px and the clip's
 * duration (note: `useVideoConfig().durationInFrames` is the whole video).
 */
export type BoxProps = { width: number; height: number; durationInFrames: number };

export type MotionComponentDef<P extends object = Record<string, unknown>> = {
  /** Stable id used in projects and by agents, kebab-case. */
  id: string;
  name: string;
  category: MotionCategory;
  /** One or two sentences: what it looks like and when to use it (agents read this). */
  description: string;
  /** Drives the auto-generated inspector controls and agent tool docs. */
  schema: Record<keyof P & string, PropField>;
  defaults: P;
  /** Seconds */
  defaultDuration: number;
  /** Default box as fractions of the canvas (center x/y + size). Omit for full frame. */
  defaultBox?: { x: number; y: number; width: number; height: number };
  Component: React.FC<P & BoxProps>;
  tags?: string[];
};

// biome-ignore lint/suspicious/noExplicitAny: registry stores heterogeneous prop types
export type AnyMotionComponent = MotionComponentDef<any>;

export const defineMotionComponent = <P extends object>(def: MotionComponentDef<P>): MotionComponentDef<P> => def;
