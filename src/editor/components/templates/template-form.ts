import { type InputProblem, type PackCard, type PackInput, resolvePackInputs, spokenInputs } from "@/core/packs";

/**
 * A template's form: one field per pack input. Lists are edited as one item per line, so the form keeps
 * every value as it is typed and turns it into the pack's input types only when the film is made.
 */
export type FormValue = string | number | boolean;
export type FormValues = Record<string, FormValue>;

const formValue = (input: PackInput): FormValue => {
  const d = input.default;
  switch (input.type) {
    case "number":
      return typeof d === "number" ? d : "";
    case "boolean":
      return d === true;
    case "list":
      return Array.isArray(d) ? d.map(String).join("\n") : "";
    default:
      return d === undefined || d === null ? "" : String(d);
  }
};

export const defaultFormValues = (pack: Pick<PackCard, "inputs">): FormValues =>
  Object.fromEntries(pack.inputs.map((i) => [i.key, formValue(i)]));

const inputValue = (input: PackInput, v: FormValue | undefined): unknown => {
  if (v === undefined) return undefined;
  switch (input.type) {
    case "number":
      return v === "" ? undefined : Number(v);
    case "boolean":
      return v === true;
    case "list":
      return String(v)
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    default:
      return String(v).trim();
  }
};

/** The film's inputs from the form, checked against the pack (an empty field keeps the pack's default). */
export const formToInputs = (
  pack: Pick<PackCard, "inputs">,
  form: FormValues,
): { values: Record<string, unknown>; problems: InputProblem[] } =>
  resolvePackInputs(pack, Object.fromEntries(pack.inputs.map((i) => [i.key, inputValue(i, form[i.key])])));

/** The form's fields split into what the film shows and the narration lines (which the voice says). */
export const formSections = (pack: Pick<PackCard, "inputs" | "beats">) => {
  const spoken = spokenInputs(pack);
  return {
    onScreen: pack.inputs.filter((i) => !spoken.has(i.key)),
    narration: pack.inputs.filter((i) => spoken.has(i.key)),
  };
};

/** What the agent is asked to do when a template is made from a topic. */
export const templatePrompt = (pack: Pick<PackCard, "id" | "name" | "engine">, topic: string) =>
  [
    `Make this video with the "${pack.name}" template (style pack \`${pack.id}\`). Start with load_skill("${pack.id}") and follow it.`,
    pack.engine === "page"
      ? "Put its film on the timeline, fill its inputs for the topic below, write the narration lines to fit its beats, then add the voice, music, sound effects and captions it asks for."
      : "Build the picture the way its guide says, then add the voice, music, sound effects and captions it asks for.",
    "Write every word in the language the topic is written in.",
    "",
    `Topic: ${topic.trim()}`,
  ].join("\n");
