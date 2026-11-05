import { describe, expect, it } from "vitest";
import { createProject, createTextClip } from "@/core/defaults";
import { insertClip } from "@/core/ops";
import { defaultFormValues, formSections, formToInputs, templatePrompt } from "@/editor/components/templates/template-form";
import { getPack, packCard } from "@/server/packs";
import type { PackCard } from ".";
import { insertPackFilm } from "./insert";

const artDeco = async (): Promise<PackCard> => {
  const pack = await getPack("art-deco");
  if (!pack) throw new Error("public/packs/art-deco is missing");
  return packCard(pack);
};

describe("packCard", () => {
  it("serves the gallery's files as URL paths and the film's own size and length", async () => {
    const card = await artDeco();
    expect(card.poster).toBe("/packs/art-deco/poster.jpg");
    expect(card.preview).toBe("/packs/art-deco/preview.mp4");
    expect(card.size).toEqual({ width: 1080, height: 1920 });
    expect(card.durationSec).toBe(16);
    expect(card.inputs.length).toBeGreaterThan(0);
  });
});

describe("insertPackFilm", () => {
  it("starts an empty project on the film's canvas, its narration lines as markers on their beats", async () => {
    const card = await artDeco();
    const d = createProject({ width: 1920, height: 1080, fps: 30 });
    const { values } = formToInputs(card, defaultFormValues(card));
    const id = insertPackFilm(d, card, values, 90);
    const clip = d.clips[id];
    expect(d.settings).toMatchObject({ width: 1080, height: 1920 });
    expect(clip).toMatchObject({ type: "component", component: "page-film", start: 0, duration: 16 * 30 });
    if (clip.type !== "component") throw new Error("not a component clip");
    expect(clip.transform).toMatchObject({ x: 540, y: 960, width: 1080, height: 1920 });
    const inputs = JSON.parse(String(clip.props.inputs));
    expect(inputs.title).toBe(values.title);
    // the film never draws the narration: those inputs stay out of its props
    for (const key of ["line1", "line2", "line3", "line4"]) expect(inputs).not.toHaveProperty(key);
    const lines = card.beats.filter((b) => b.say);
    expect(d.markers.map((m) => m.label)).toEqual(lines.map((b) => String(values[b.say as string])));
    expect(d.markers.map((m) => m.frame)).toEqual(lines.map((b) => Math.round(b.atSec * 30)));
  });

  it("goes in at the playhead on another canvas, letterboxed in the film's aspect", async () => {
    const card = await artDeco();
    const d = createProject({ width: 1920, height: 1080, fps: 30 });
    insertClip(d, createTextClip(d.settings, { trackId: d.tracks[0].id, start: 0, duration: 90, text: "Hello" }), "exact");
    const id = insertPackFilm(d, card, {}, 60);
    expect(d.settings).toMatchObject({ width: 1920, height: 1080 });
    expect(d.clips[id]).toMatchObject({ start: 60, transform: { x: 960, y: 540, height: 1080 } });
    expect(d.clips[id].transform.width).toBeCloseTo(1080 * (9 / 16));
    // no lines given, no markers
    expect(d.markers).toHaveLength(0);
  });
});

describe("template form", () => {
  it("round-trips the defaults without problems and splits the narration from what is on screen", async () => {
    const card = await artDeco();
    const { values, problems } = formToInputs(card, defaultFormValues(card));
    expect(problems).toEqual([]);
    for (const input of card.inputs) expect(values[input.key]).toEqual(input.default);
    const { onScreen, narration } = formSections(card);
    expect(narration.map((i) => i.key)).toEqual(["line1", "line2", "line3", "line4"]);
    expect(onScreen.length + narration.length).toBe(card.inputs.length);
  });

  it("turns lines into lists, keeps defaults for empty fields and reports what doesn't fit", () => {
    const card = {
      inputs: [
        { key: "items", type: "list", label: "Items", default: ["a"], maxItems: 2 },
        { key: "count", type: "number", label: "Count", default: 3, min: 1, max: 5 },
        { key: "title", type: "string", label: "Title", default: "T", maxLength: 4 },
      ],
    } as unknown as PackCard;
    expect(formToInputs(card, { items: " x \n\n y ", count: "", title: "" }).values).toEqual({ items: ["x", "y"], count: 3, title: "T" });
    const bad = formToInputs(card, { items: "1\n2\n3", count: 9, title: "TOO LONG" });
    expect(bad.problems.map((p) => p.key).sort()).toEqual(["count", "items", "title"]);
  });

  it("asks the agent to load the pack's skill and write in the topic's language", () => {
    const prompt = templatePrompt({ id: "art-deco", name: "Art Deco", engine: "page" }, "  Yılbaşı galası  ");
    expect(prompt).toContain('load_skill("art-deco")');
    expect(prompt).toContain("language the topic is written in");
    expect(prompt.endsWith("Topic: Yılbaşı galası")).toBe(true);
  });
});
