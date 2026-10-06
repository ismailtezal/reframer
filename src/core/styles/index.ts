import { STYLE_PRESETS } from "./presets";
import type { StyleDNA } from "./schema";

export * from "./apply";
export { ARCHETYPE_BASES, getArchetypeBase, getStylePreset, STYLE_PRESETS } from "./presets";
export * from "./schema";

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Fuzzy search over names, ids, tags and inspirations ("mr beast", "apple", "trailer"). */
export const searchStyles = (query: string, presets: StyleDNA[] = STYLE_PRESETS): StyleDNA[] => {
  const q = norm(query);
  if (!q) return presets;
  const words = q.split(" ");
  return presets
    .map((s) => {
      const hay = norm(`${s.id} ${s.name} ${s.inspiredBy ?? ""} ${s.tags.join(" ")} ${s.archetype} ${s.description}`);
      const compact = hay.replace(/\s/g, "");
      let score = 0;
      for (const w of words) {
        if (norm(s.name).includes(w) || s.id.includes(w)) score += 3;
        else if (hay.includes(w) || compact.includes(w)) score += 1;
      }
      if (compact.includes(q.replace(/\s/g, ""))) score += 4;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
};

/** One-line catalog entries for prompts / tool results. */
export const styleCatalog = (presets: StyleDNA[] = STYLE_PRESETS) =>
  presets.map((s) => ({ id: s.id, name: s.name, category: s.category, description: s.description }));
