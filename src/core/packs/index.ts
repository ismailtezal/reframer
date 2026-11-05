import { PACK_ID_PATTERN, PAGE_FILM_ENTRY, type PackBeat, type PackEngineKind, type PackInput, type PackManifest } from "./schema";

export * from "./schema";

/** What a template gallery needs to know about a pack (the app's `GET /api/packs`). */
export type PackCard = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  engine: PackEngineKind;
  /** A page film's own size: its clip box keeps this aspect. */
  size?: { width: number; height: number };
  durationSec: number;
  /** URL paths the app serves. */
  poster?: string;
  preview?: string;
  inputs: PackInput[];
  beats: PackBeat[];
};

/** How long a pack's film runs: a page film's own length, else the pack's typical length. */
export const packDurationSec = (m: Pick<PackManifest, "engine" | "durationSec">) =>
  m.engine.kind === "page" && m.engine.durationSec ? m.engine.durationSec : m.durationSec.typical;

/** Inputs a beat says: narration lines for the voice, never drawn by the film. */
export const spokenInputs = (m: Pick<PackManifest, "beats">) => new Set(m.beats.flatMap((b) => (b.say ? [b.say] : [])));

/** The inputs a page film is given: every value but the narration lines. */
export const filmInputs = (m: Pick<PackManifest, "beats">, values: Record<string, unknown>) => {
  const spoken = spokenInputs(m);
  return Object.fromEntries(Object.entries(values).filter(([k]) => !spoken.has(k)));
};

/** URL path of a pack folder (served from `public/`). */
export const packPath = (id: string) => `/packs/${id}`;

/** URL path of a page-engine pack's film. */
export const packFilmPath = (id: string) => `${packPath(id)}/${PAGE_FILM_ENTRY}`;

/** Ids are folder names: anything else (dots, slashes) is refused before it reaches a URL. */
export const isPackId = (id: string) => PACK_ID_PATTERN.test(id);

/**
 * The page a film plays from, with its inputs in the query (`window.PACK_INPUTS` in the page).
 * Inputs equal to their defaults are left out so URLs stay short and stable.
 */
export const filmUrl = (base: string, inputs: Record<string, unknown> | undefined) => {
  const given = Object.entries(inputs ?? {}).filter(([, v]) => v !== undefined);
  if (!given.length) return base;
  return `${base}${base.includes("?") ? "&" : "?"}inputs=${encodeURIComponent(JSON.stringify(Object.fromEntries(given)))}`;
};

export type InputProblem = { key: string; message: string };

const checkOne = (input: PackInput, value: unknown): string | null => {
  switch (input.type) {
    case "string":
    case "text":
    case "color":
      if (typeof value !== "string") return "expected text";
      if (input.maxLength && value.length > input.maxLength) return `longer than ${input.maxLength} characters`;
      if (input.type === "color" && !/^#[0-9a-f]{3,8}$/i.test(value)) return "expected a #hex color";
      return null;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return "expected a number";
      if (input.min !== undefined && value < input.min) return `below ${input.min}`;
      if (input.max !== undefined && value > input.max) return `above ${input.max}`;
      return null;
    case "boolean":
      return typeof value === "boolean" ? null : "expected true or false";
    case "enum":
      return typeof value === "string" && input.options?.includes(value) ? null : `expected one of ${input.options?.join(", ")}`;
    case "list": {
      if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) return "expected a list of texts";
      if (input.maxItems && value.length > input.maxItems) return `more than ${input.maxItems} items`;
      const max = input.maxLength;
      const long = max ? value.find((v) => (v as string).length > max) : undefined;
      return long !== undefined ? `an item is longer than ${max} characters` : null;
    }
  }
};

/**
 * The inputs a film gets: the given values checked against the manifest, defaults for the rest.
 * Unknown keys are reported (a typo would otherwise silently show the default).
 */
export const resolvePackInputs = (
  manifest: Pick<PackManifest, "inputs">,
  given: Record<string, unknown> = {},
): { values: Record<string, unknown>; problems: InputProblem[] } => {
  const problems: InputProblem[] = [];
  const values: Record<string, unknown> = {};
  const known = new Set(manifest.inputs.map((i) => i.key));
  for (const key of Object.keys(given)) if (!known.has(key)) problems.push({ key, message: "not an input of this pack" });
  for (const input of manifest.inputs) {
    const value = given[input.key];
    if (value === undefined || value === null || value === "") {
      if (input.required) problems.push({ key: input.key, message: "required" });
      values[input.key] = input.default;
      continue;
    }
    const problem = checkOne(input, value);
    if (problem) problems.push({ key: input.key, message: problem });
    values[input.key] = problem ? input.default : value;
  }
  return { values, problems };
};
