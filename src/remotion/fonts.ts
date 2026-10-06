import { useState } from "react";
import { useDelayRender } from "remotion";

/**
 * Loads any Google Fonts family at runtime (preview + server render) via the
 * CSS2 API. Only latin + latin-ext subsets are fetched. Rendering is held with
 * delayRender until the faces are ready so text never falls back to Times.
 */

export type FontRequest = { family: string; weight?: number; italic?: boolean };

const SYSTEM_FONTS = new Set([
  "system-ui",
  "sans-serif",
  "serif",
  "monospace",
  "Arial",
  "Helvetica",
  "Helvetica Neue",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
]);

const WANTED_SUBSETS = new Set(["latin", "latin-ext"]);

const loaded = new Set<string>();
const pending = new Map<string, Promise<void>>();

export const fontKey = ({ family, weight = 400, italic = false }: FontRequest) => `${family}|${weight}|${italic ? "i" : "n"}`;

export const isFontReady = (req: FontRequest) => SYSTEM_FONTS.has(req.family) || loaded.has(fontKey(req));

type Face = { url: string; weight: string; style: string; unicodeRange?: string; subset?: string };

const parseFaces = (css: string): Face[] => {
  const faces: Face[] = [];
  const re = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*{([^}]*)}/g;
  let m: RegExpExecArray | null = re.exec(css);
  while (m) {
    const body = m[2];
    const url = body.match(/url\(([^)]+)\)/)?.[1]?.replace(/["']/g, "");
    if (url) {
      faces.push({
        url,
        subset: m[1],
        weight: body.match(/font-weight:\s*([^;]+);/)?.[1]?.trim() ?? "400",
        style: body.match(/font-style:\s*([^;]+);/)?.[1]?.trim() ?? "normal",
        unicodeRange: body.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim(),
      });
    }
    m = re.exec(css);
  }
  return faces;
};

const cssUrl = (family: string, axis: string | null) => {
  const name = encodeURIComponent(family).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${name}${axis ? `:${axis}` : ""}&display=block`;
};

const fetchCss = async (family: string, weight: number, italic: boolean): Promise<string> => {
  const attempts = [
    italic ? `ital,wght@1,${weight}` : `wght@${weight}`,
    italic ? "ital@1" : null,
    null, // family default (static fonts that only ship one weight)
  ];
  let lastError: unknown;
  for (const axis of attempts) {
    try {
      const res = await fetch(cssUrl(family, axis));
      if (res.ok) return await res.text();
      lastError = new Error(`Google Fonts returned ${res.status} for ${family}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
};

export const loadFont = (req: FontRequest): Promise<void> => {
  const weight = req.weight ?? 400;
  const italic = req.italic ?? false;
  if (typeof document === "undefined" || isFontReady({ ...req, weight, italic })) return Promise.resolve();
  const key = fontKey({ family: req.family, weight, italic });
  const existing = pending.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const css = await fetchCss(req.family, weight, italic);
    const faces = parseFaces(css).filter((f) => !f.subset || WANTED_SUBSETS.has(f.subset));
    await Promise.all(
      faces.map(async (f) => {
        const face = new FontFace(req.family, `url(${f.url}) format("woff2")`, {
          weight: f.weight,
          style: f.style,
          unicodeRange: f.unicodeRange,
          display: "block",
        });
        await face.load();
        document.fonts.add(face);
      }),
    );
    loaded.add(key);
  })().catch((err) => {
    // Never block a render forever on a font — fall back gracefully.
    console.warn(`[reframer] Could not load font "${req.family}" (${weight}).`, err);
    loaded.add(key);
  });
  pending.set(key, promise);
  return promise;
};

/** Loads fonts and holds the render until they are available. */
export const useFonts = (requests: readonly FontRequest[]) => {
  const { delayRender, continueRender } = useDelayRender();
  // Handles are tracked per component instance; keys that change trigger new loads.
  const [handles] = useState(() => new Map<string, number>());
  for (const req of requests) {
    if (!req.family || isFontReady(req)) continue;
    const key = fontKey(req);
    if (handles.has(key)) continue;
    const handle = delayRender(`Loading font "${req.family}"`, { timeoutInMilliseconds: 20000 });
    handles.set(key, handle);
    loadFont(req).finally(() => continueRender(handle));
  }
};

/** CSS font-family value with sensible fallbacks. */
export const fontStack = (family: string) => (SYSTEM_FONTS.has(family) ? family : `"${family}", Inter, system-ui, sans-serif`);
