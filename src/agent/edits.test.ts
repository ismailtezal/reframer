import { describe, expect, it } from "vitest";
import { createProject } from "@/core/defaults";
import { projectLanguage } from "@/core/language";
import type { Project } from "@/core/schema";
import { videoAsset } from "@/test/fixtures";
import { type EditContext, runEdit } from "./edits";
import { lintText } from "./text-checks";

const ctx: EditContext = { actor: { kind: "agent", name: "Test agent" }, meta: { createdBy: "agent", agent: "Test agent" } };

const vertical = (): Project => createProject({ name: "Reel", width: 1080, height: 1920, fps: 30 });

const add = (p: Project, clips: unknown[]) =>
  (runEdit(p, "add_clips", { clips } as never, ctx) as { created: { id: string; trackId: string }[] }).created;

/** Index of a clip's track in the stack (0 is drawn in front). */
const layer = (p: Project, clipId: string) => p.tracks.findIndex((t) => t.id === p.clips[clipId].trackId);
const trackName = (p: Project, clipId: string) => p.tracks.find((t) => t.id === p.clips[clipId].trackId)?.name;

const bg = { type: "background", fill: "#101830", startSec: 0, durationSec: 6 };
const title = (startSec = 0) => ({ type: "text", text: "Title", startSec, durationSec: 3 });

describe("add_clips placement by layer", () => {
  it("keeps titles in front of a background added before them", () => {
    const p = vertical();
    const [b] = add(p, [bg]);
    const [t, c] = add(p, [title(), { type: "component", component: "counter", startSec: 3, durationSec: 3 }]);
    expect(layer(p, t.id)).toBeLessThan(layer(p, b.id));
    expect(layer(p, c.id)).toBeLessThan(layer(p, b.id));
    expect(trackName(p, b.id)).toBe("Background");
  });

  it("puts a background added last behind everything", () => {
    const p = vertical();
    const [t] = add(p, [title()]);
    const [b] = add(p, [bg]);
    expect(layer(p, b.id)).toBeGreaterThan(layer(p, t.id));
  });

  it("lays b-roll over a-roll but under the titles over both", () => {
    const p = vertical();
    const asset = videoAsset(p);
    const [aroll] = add(p, [{ type: "video", assetId: asset.id, startSec: 0, durationSec: 6 }]);
    const [t] = add(p, [title(1)]);
    const [broll] = add(p, [{ type: "video", assetId: asset.id, startSec: 2, durationSec: 2 }]);
    expect(layer(p, broll.id)).toBeLessThan(layer(p, aroll.id));
    expect(layer(p, broll.id)).toBeGreaterThan(layer(p, t.id));
  });

  it("puts footage on the main track, not the background's, when the time is free", () => {
    const p = vertical();
    add(p, [bg]);
    const [v] = add(p, [{ type: "video", assetId: videoAsset(p).id, startSec: 8, durationSec: 2 }]);
    expect(trackName(p, v.id)).toBe("Main");
  });

  it("honors an explicit track", () => {
    const p = vertical();
    const main = p.tracks.find((t) => t.name === "Main");
    const [t] = add(p, [{ ...title(), trackId: main?.id }]);
    expect(p.clips[t.id].trackId).toBe(main?.id);
  });
});

describe("projectLanguage", () => {
  it("reads transcription services' codes", () => {
    const p = vertical();
    p.assets.a = { ...videoAsset(p, "a"), transcript: { language: "tur", words: [], text: "" } };
    expect(projectLanguage(p)).toBe("tr");
  });

  it("tells Turkish from its letters when nothing was transcribed", () => {
    const p = vertical();
    add(p, [{ ...title(), text: "Şimdi izle" }]);
    expect(projectLanguage(p)).toBe("tr");
  });

  it("stays unknown for text that could be any Latin language", () => {
    const p = vertical();
    add(p, [{ ...title(), text: "Watch now" }]);
    expect(projectLanguage(p)).toBeUndefined();
  });
});

describe("lintText", () => {
  it("flags text that went through a wrong encoding", () => {
    const p = vertical();
    const [t] = add(p, [{ ...title(), text: "BugÃ¼n neler oldu" }]);
    const issue = lintText(p).find((i) => i.code === "broken-encoding");
    expect(issue?.clipId).toBe(t.id);
    expect(issue?.severity).toBe("error");
  });

  it("leaves correct Turkish alone", () => {
    const p = vertical();
    add(p, [{ ...title(), text: "Bugün İstanbul'da ığdırlı çocuklar şarkı söyledi" }]);
    expect(lintText(p)).toEqual([]);
  });

  it("flags a component still showing its sample copy, and not one with real copy", () => {
    const p = vertical();
    const [sample, real] = add(p, [
      { type: "component", component: "counter", props: { to: 42 }, startSec: 0, durationSec: 3 },
      { type: "component", component: "counter", props: { to: 42, label: "kullanıcı" }, startSec: 3, durationSec: 3 },
    ]);
    const flagged = lintText(p)
      .filter((i) => i.code === "sample-text")
      .map((i) => i.clipId);
    expect(flagged).toContain(sample.id);
    expect(flagged).not.toContain(real.id);
  });
});
