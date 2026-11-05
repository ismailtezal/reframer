import "server-only";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  filmInputs,
  type PackCard,
  type PackInput,
  type PackManifest,
  PackManifestSchema,
  packDurationSec,
  packFilmPath,
} from "@/core/packs";

/**
 * Style packs ship in `public/packs/<id>/` (see core/packs/schema.ts): public, because page films are
 * served to the composition as they are, by the app in the editor and by the media server in renders.
 * Folders starting with "_" hold what packs share (the bridge, vendored libraries).
 */
export const PACKS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "packs");

export type Pack = { manifest: PackManifest; dir: string; guide: string };
export type PackProblem = { id: string; error: string };

let cache: { at: number; packs: Pack[]; problems: PackProblem[] } | null = null;

const readPack = async (dir: string, folder: string): Promise<Pack | PackProblem> => {
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(path.join(dir, "pack.json"), "utf8"));
  } catch (err) {
    return { id: folder, error: `pack.json: ${err instanceof Error ? err.message : String(err)}` };
  }
  const parsed = PackManifestSchema.safeParse(raw);
  if (!parsed.success)
    return { id: folder, error: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ") };
  const manifest = parsed.data;
  if (manifest.id !== folder) return { id: folder, error: `its id "${manifest.id}" differs from its folder name` };
  const guidePath = path.join(dir, manifest.guide);
  const guide = existsSync(guidePath) ? (await fs.readFile(guidePath, "utf8")).trim() : "";
  return { manifest, dir, guide };
};

/** Every pack that loads, and why the others don't. */
export const loadPacks = async (): Promise<{ packs: Pack[]; problems: PackProblem[] }> => {
  if (cache && Date.now() - cache.at < 10_000) return cache;
  const packs: Pack[] = [];
  const problems: PackProblem[] = [];
  if (existsSync(PACKS_DIR)) {
    for (const entry of await fs.readdir(PACKS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
      const result = await readPack(path.join(PACKS_DIR, entry.name), entry.name);
      if ("manifest" in result) packs.push(result);
      else problems.push(result);
    }
  }
  packs.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  cache = { at: Date.now(), packs, problems };
  return cache;
};

export const getPack = async (id: string): Promise<Pack | undefined> =>
  (await loadPacks()).packs.find((p) => p.manifest.id === id.trim().toLowerCase());

const inputRow = (i: PackInput) => {
  const limit = [
    i.maxLength ? `≤${i.maxLength} chars` : "",
    i.maxItems ? `≤${i.maxItems} items` : "",
    i.options ? i.options.join(" | ") : "",
    i.min !== undefined || i.max !== undefined ? `${i.min ?? ""}…${i.max ?? ""}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return `| \`${i.key}\` | ${i.type}${i.required ? " (required)" : ""} | ${i.labelEn ?? i.label} | ${JSON.stringify(i.default)} | ${limit} |`;
};

/** The add_clips op that puts a page pack's film on the timeline. */
export const packClipOp = (manifest: PackManifest, inputs?: Record<string, unknown>) => {
  // Narration lines (inputs a beat says) are for the voice, not the picture.
  const sample = filmInputs(manifest, inputs ?? Object.fromEntries(manifest.inputs.map((i) => [i.key, i.default])));
  const durationSec = packDurationSec(manifest);
  return {
    op: "add_clips",
    clips: [
      {
        type: "component",
        component: "page-film",
        name: manifest.name,
        props: { pack: manifest.id, inputs: JSON.stringify(sample) },
        startSec: 0,
        durationSec,
      },
    ],
  };
};

const howToUse = (m: PackManifest): string[] => {
  switch (m.engine.kind) {
    case "page":
      return [
        `The picture is a page film (${m.engine.size.width}×${m.engine.size.height}${m.engine.durationSec ? `, ${m.engine.durationSec} s` : ""}): it draws every frame itself in this style. Put it on the timeline as a \`page-film\` clip, and lay the voice, music and captions over it:`,
        "```json",
        JSON.stringify(packClipOp(m)),
        "```",
        "`inputs` is a JSON string of the template inputs below; leave a key out to keep its default. To change words on screen, change the inputs (never cover the film's own type with text clips). `offsetSec` starts it later; split and trim it like footage.",
      ];
    case "remotion-kit":
      return [`Write a code component (create_component) that imports \`${m.engine.module}\`, following the guide below.`];
    case "ai-keyframes":
      return [
        `The picture is made of stills from an image model${m.engine.imageModel ? ` (tuned on ${m.engine.imageModel})` : ""}, placed as image clips with slow keyframed moves and cut to the voice. The prompt recipe is in the guide below.`,
      ];
    case "blender":
      return ["The picture is rendered by Blender scripts; the guide below says how to run them and import the shots."];
  }
};

/** What the agent reads with load_skill(<pack id>): how to use the pack here, then the pack's own guide. */
export const packSkillBody = (pack: Pack): string => {
  const m = pack.manifest;
  const e = m.edit;
  const lines: string[] = [`# ${m.name} (style pack \`${m.id}\`)`, "", m.description, "", "## Using it here", "", ...howToUse(m)];
  if (m.inputs.length) {
    lines.push(
      "",
      "### Inputs",
      "",
      "| key | type | what | default | limits |",
      "| --- | --- | --- | --- | --- |",
      ...m.inputs.map(inputRow),
    );
  }
  if (m.beats.length) {
    lines.push(
      "",
      "### Beats",
      "",
      "The film's timeline is fixed: start each narration line on its beat (as its own voice clip) and keep it under its length.",
      "",
      "| at | on screen | line | max | sound |",
      "| --- | --- | --- | --- | --- |",
      ...m.beats.map(
        (b) =>
          `| ${b.atSec.toFixed(2)} s | ${b.label} | ${b.say ? `\`${b.say}\`` : ""} | ${b.maxSec ? `${b.maxSec} s` : ""} | ${b.sfx ?? ""} |`,
      ),
    );
  }
  const edit: string[] = [];
  if (e.voice) {
    const v = [e.voice.direction, e.voice.voiceId ? `voice id \`${e.voice.voiceId}\`` : "", e.voice.model ? `model ${e.voice.model}` : ""];
    edit.push(`- Voice: ${v.filter(Boolean).join("; ")}`);
  }
  if (e.music) edit.push(`- Music (generate or find): ${e.music.prompt}`);
  if (e.sfx?.length) edit.push(`- Sound effects that belong: ${e.sfx.join("; ")}`);
  if (e.captions)
    edit.push(`- Captions: \`${JSON.stringify(e.captions.style)}\`${e.captions.y !== undefined ? `, centred at y=${e.captions.y}` : ""}`);
  if (e.styleId) edit.push(`- Style DNA on top: \`${e.styleId}\` (apply_style)`);
  if (edit.length) lines.push("", "### The edit over it", "", ...edit);
  if (m.credits.length)
    lines.push(
      "",
      "### Credits",
      "",
      ...m.credits.map((c) => `- ${c.name}${c.url ? ` (${c.url})` : ""}: ${c.license}${c.note ? ` (${c.note})` : ""}`),
    );
  if (pack.guide) lines.push("", "---", "", pack.guide);
  return lines.join("\n");
};

/** Folder-relative manifest paths as URLs the app serves. */
export const packUrls = (m: PackManifest) => {
  const rel = (p?: string) => (!p ? undefined : /^https?:\/\//.test(p) ? p : `/packs/${m.id}/${p.replace(/^\.?\//, "")}`);
  return { poster: rel(m.poster), preview: rel(m.preview), film: m.engine.kind === "page" ? packFilmPath(m.id) : undefined };
};

/** A pack as the template galleries show it (dashboard, the editor's Templates tab). */
export const packCard = ({ manifest: m }: Pack): PackCard => {
  const urls = packUrls(m);
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    tags: m.tags,
    engine: m.engine.kind,
    size: m.engine.kind === "page" ? m.engine.size : undefined,
    durationSec: packDurationSec(m),
    poster: urls.poster,
    preview: urls.preview,
    inputs: m.inputs,
    beats: m.beats,
  };
};
