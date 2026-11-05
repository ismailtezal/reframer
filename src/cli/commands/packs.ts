import { resolvePackInputs } from "@/core/packs";
import { getPack, loadPacks, packClipOp, packSkillBody, packUrls } from "@/server/packs";
import { type Command, RAW_OUTPUT } from "../command";
import { invalid, notFound } from "../errors";
import { readJsonArg } from "../ops";

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const packsCommand: Command = {
  name: "packs",
  summary:
    "Style packs: whole looks a film is made in (Art Deco, rubber-hose cartoon, CRT terminal…), with their template inputs and guide",
  usage: "reframer packs [<pack>] [--search <words>] [--guide | --raw] [--inputs <json | file>]",
  flags: {
    search: { type: "string", description: "Only packs whose name, tags or description have these words" },
    guide: { type: "boolean", description: "With a pack: include its whole guide (what load_skill gives the agent)" },
    raw: { type: "boolean", description: "With a pack: print its guide as markdown instead of JSON" },
    inputs: {
      type: "string",
      description: "With a pack: check these template inputs (JSON or a .json file) and print the clip op that uses them",
    },
  },
  examples: [
    "reframer packs",
    "reframer packs --search cartoon",
    "reframer packs art-deco --guide",
    `reframer packs art-deco --inputs '{"title":"Gala Gecesi"}'`,
  ],
  run: async (ctx, { positionals, flags }) => {
    const { packs, problems } = await loadPacks();
    const id = positionals[0];
    if (!id) {
      const words = flags.search ? norm(String(flags.search)).split(" ").filter(Boolean) : [];
      const hits = packs.filter((p) => {
        if (!words.length) return true;
        const m = p.manifest;
        const hay = norm(`${m.id} ${m.name} ${m.description} ${m.tags.join(" ")} ${m.engine.kind}`);
        return words.every((w) => hay.includes(w));
      });
      return {
        packs: hits.map(({ manifest: m }) => ({
          id: m.id,
          name: m.name,
          engine: m.engine.kind,
          description: m.description,
          formats: m.formats,
          durationSec: m.durationSec.typical,
          inputs: m.inputs.map((i) => i.key),
          tags: m.tags,
        })),
        ...(problems.length ? { problems } : {}),
        next: "reframer packs <id> --guide",
      };
    }
    const pack = await getPack(id);
    if (!pack) {
      const broken = problems.find((p) => p.id === id);
      if (broken) throw invalid(`The pack "${id}" doesn't load: ${broken.error}`);
      throw notFound(`No style pack named "${id}"`, `Packs: ${packs.map((p) => p.manifest.id).join(", ") || "none"}`);
    }
    if (flags.raw) return { [RAW_OUTPUT]: `${packSkillBody(pack)}\n` };
    const m = pack.manifest;
    let clip: ReturnType<typeof packClipOp> | undefined = m.engine.kind === "page" ? packClipOp(m) : undefined;
    let inputsChecked = false;
    if (flags.inputs !== undefined) {
      const given = await readJsonArg(ctx, String(flags.inputs), "inputs");
      if (!given || typeof given !== "object" || Array.isArray(given)) throw invalid("--inputs must be a JSON object");
      const { values, problems: found } = resolvePackInputs(m, given as Record<string, unknown>);
      if (found.length) throw invalid(`Some inputs don't fit the pack "${m.id}"`, { problems: found }, `reframer packs ${m.id} lists them`);
      inputsChecked = true;
      if (m.engine.kind === "page") clip = packClipOp(m, values);
    }
    return {
      pack: m,
      folder: pack.dir,
      urls: packUrls(m),
      ...(clip ? { clip } : {}),
      ...(inputsChecked ? { inputsOk: true } : {}),
      ...(flags.guide ? { guide: packSkillBody(pack) } : { more: `reframer packs ${m.id} --guide` }),
    };
  },
};
