import type { StyleArchetype, StyleDNA } from "../schema";
import { ARCHETYPE_BASES } from "./archetypes";
import { BRAND_STYLES } from "./brands";
import { CREATOR_STYLES } from "./creators";
import { GENRE_STYLES } from "./genres";

export { ARCHETYPE_BASES, BRAND_STYLES, CREATOR_STYLES, GENRE_STYLES };

/** Every named style (creators, brands, genres). Archetype bases are separate. */
export const STYLE_PRESETS: StyleDNA[] = [...CREATOR_STYLES, ...BRAND_STYLES, ...GENRE_STYLES];

const PRESETS_BY_ID = new Map<string, StyleDNA>([...STYLE_PRESETS, ...Object.values(ARCHETYPE_BASES)].map((dna) => [dna.id, dna]));

/** Look up a named preset or an archetype base ("base-<archetype>") by id. */
export const getStylePreset = (id: string): StyleDNA | undefined => PRESETS_BY_ID.get(id);

/** The base DNA to start from when synthesizing a style for an unlisted creator. */
export const getArchetypeBase = (archetype: StyleArchetype): StyleDNA => ARCHETYPE_BASES[archetype];
