import * as RemotionLayoutUtils from "@remotion/layout-utils";
import * as RemotionMedia from "@remotion/media";
import * as RemotionNoise from "@remotion/noise";
import * as RemotionPaths from "@remotion/paths";
import * as RemotionRoughNotation from "@remotion/rough-notation";
import * as RemotionShapes from "@remotion/shapes";
import * as React from "react";
import * as Remotion from "remotion";
import { transform } from "sucrase";
import { resolveEasing } from "../../core/easing";
import { EASING_PRESETS } from "../../core/schema";
import { formatNumber, lerp, progress, random01 } from "../components/helpers";
import { useClipBox } from "../context";
import { fontStack, loadFont, useFonts } from "../fonts";

/**
 * Runtime for AI-written "code components" — TSX compiled in the browser (and
 * in the render server) with sucrase. Imports are resolved against a fixed
 * allow-list. This is a convenience boundary, not a security sandbox: code runs
 * with the page's privileges, so only use models you trust.
 */

const reframerModule = {
  useFonts,
  loadFont,
  fontStack,
  useClipBox,
  progress,
  lerp,
  formatNumber,
  random01,
  ease: resolveEasing,
  EASING_PRESETS,
};

const MODULES: Record<string, unknown> = {
  react: React,
  remotion: Remotion,
  "@remotion/shapes": RemotionShapes,
  "@remotion/paths": RemotionPaths,
  "@remotion/noise": RemotionNoise,
  "@remotion/layout-utils": RemotionLayoutUtils,
  "@remotion/media": RemotionMedia,
  "@remotion/rough-notation": RemotionRoughNotation,
  reframer: reframerModule,
};

export const ALLOWED_IMPORTS = Object.keys(MODULES);

const requireShim = (name: string) => {
  if (name in MODULES) return MODULES[name];
  throw new Error(`Import "${name}" is not available in code components. Allowed: ${ALLOWED_IMPORTS.join(", ")}`);
};

// Names hidden from component code (convenience guard, see note above).
const SHADOWED = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "localStorage", "sessionStorage", "indexedDB"];

export type CompileResult = { ok: true; Component: React.ComponentType<Record<string, unknown>> } | { ok: false; error: string };

const cache = new Map<string, CompileResult>();

export const compileCodeComponent = (source: string): CompileResult => {
  const cached = cache.get(source);
  if (cached) return cached;
  let result: CompileResult;
  try {
    const { code } = transform(source, {
      transforms: ["typescript", "jsx", "imports"],
      jsxRuntime: "classic",
      production: true,
      filePath: "component.tsx",
    });
    const module: { exports: Record<string, unknown> } = { exports: {} };
    // Compiling agent-written components is the feature; imports go through the allow-listed require shim.
    const factory = new Function("require", "module", "exports", "React", ...SHADOWED, code);
    factory(requireShim, module, module.exports, React, ...SHADOWED.map(() => undefined));
    const exported = module.exports.default ?? Object.values(module.exports).find((v) => typeof v === "function");
    if (typeof exported !== "function") {
      result = { ok: false, error: "The component must `export default` a React component function." };
    } else {
      result = { ok: true, Component: exported as React.ComponentType<Record<string, unknown>> };
    }
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  cache.set(source, result);
  return result;
};

/** Runtime errors thrown while rendering code components (read by the editor & agent). */
export type ComponentRuntimeError = { clipId: string; componentId: string; message: string; at: number };

const runtimeErrors = new Map<string, ComponentRuntimeError>();
const listeners = new Set<() => void>();
// Cached snapshot: useSyncExternalStore requires a stable reference between changes.
let snapshot: ComponentRuntimeError[] = [];

const emit = () => {
  snapshot = [...runtimeErrors.values()];
  for (const l of listeners) l();
};

export const reportComponentError = (e: ComponentRuntimeError) => {
  const prev = runtimeErrors.get(e.clipId);
  if (prev && prev.message === e.message) return;
  runtimeErrors.set(e.clipId, e);
  emit();
};

export const clearComponentError = (clipId: string) => {
  if (runtimeErrors.delete(clipId)) emit();
};

export const getComponentErrors = () => snapshot;

export const subscribeComponentErrors = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
