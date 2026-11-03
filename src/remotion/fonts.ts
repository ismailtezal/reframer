import { useState } from "react";
import { useDelayRender } from "remotion";

/**
 * Loads any Google Fonts family at runtime (preview + server render) via the
 * CSS2 API. Only latin + latin-ext subsets are fetched. Rendering is held with
 * delayRender until the faces are ready so text never falls back to Times.
 */

export type FontRequest = { family: string; weight?: number; italic?: boolean };
/** A family name ("Inter": every weight it has) or a specific face. */
export type FontInput = string | FontRequest;

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
/** Key for a whole family (every weight, upright and italic) loaded at once. */
const familyKey = (family: string) => `${family}|*`;

export const isFontReady = (req: FontRequest) =>
  SYSTEM_FONTS.has(req.family) || loaded.has(fontKey(req)) || loaded.has(familyKey(req.family));

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

const fetchCss = async (family: string, weight: number | "all", italic: boolean): Promise<string> => {
  const attempts =
    weight === "all"
      ? [
          "ital,wght@0,100..900;1,100..900", // variable families: every weight, both styles
          "wght@100..900",
          "ital,wght@0,400;0,700;1,400;1,700", // static families with the common faces
          "wght@400;700",
          null,
        ]
      : [
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

/** Loads one face, or with `weight: "all"` every face the family has. */
export const loadFont = (req: FontRequest | { family: string; weight: "all" }): Promise<void> => {
  const all = req.weight === "all";
  const weight = all ? 400 : (req.weight ?? 400);
  const italic = (!all && (req as FontRequest).italic) ?? false;
  if (typeof document === "undefined") return Promise.resolve();
  if (all ? SYSTEM_FONTS.has(req.family) || loaded.has(familyKey(req.family)) : isFontReady({ family: req.family, weight, italic }))
    return Promise.resolve();
  const key = all ? familyKey(req.family) : fontKey({ family: req.family, weight, italic });
  const existing = pending.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const css = await fetchCss(req.family, all ? "all" : weight, italic);
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

/**
 * Loads fonts and holds the render until they are available. Takes family names and/or faces, as
 * separate arguments or arrays: useFonts("Inter"), useFonts(["Inter", "Roboto Mono"]),
 * useFonts({ family: "Inter", weight: 800 }). A bare name loads every weight the family has.
 */
export const useFonts = (...inputs: (FontInput | readonly FontInput[] | null | undefined)[]) => {
  const { delayRender, continueRender } = useDelayRender();
  // Handles are tracked per component instance; keys that change trigger new loads.
  const [handles] = useState(() => new Map<string, number>());
  const requests = inputs.flat().filter((x): x is FontInput => Boolean(x));
  for (const input of requests) {
    const req = typeof input === "string" ? { family: input.trim(), weight: "all" as const } : input;
    if (!req.family) continue;
    const key = req.weight === "all" ? familyKey(req.family) : fontKey(req);
    if (handles.has(key) || (req.weight === "all" ? SYSTEM_FONTS.has(req.family) || loaded.has(key) : isFontReady(req))) continue;
    const handle = delayRender(`Loading font "${req.family}"`, { timeoutInMilliseconds: 20000 });
    handles.set(key, handle);
    loadFont(req).finally(() => continueRender(handle));
  }
};

/** CSS font-family value with sensible fallbacks. */
export const fontStack = (family: string) => (SYSTEM_FONTS.has(family) ? family : `"${family}", Inter, system-ui, sans-serif`);
