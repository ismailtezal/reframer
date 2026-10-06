import { describe, expect, it } from "vitest";
import { makeProject, text, trackId, video, videoAsset } from "@/test/fixtures";
import {
  EditError,
  insertClip,
  moveClip,
  removeClips,
  rippleDeleteRange,
  splitClip,
  trimClip,
  updateClip,
  updateSettings,
  updateTrack,
} from "./ops";
import { getClipEnd, getProjectDuration } from "./project-utils";

const agent = { kind: "agent" as const, name: "Test agent" };
const user = { kind: "user" as const, name: "You" };

describe("insertClip", () => {
  it("places a clip on its track when the range is free", () => {
    const p = makeProject();
    const id = insertClip(p, text(p, "Overlay", 0, 60), "exact");
    expect(p.clips[id].trackId).toBe(trackId(p, "Overlay"));
  });

  it("rejects overlaps in exact mode", () => {
    const p = makeProject();
    insertClip(p, text(p, "Overlay", 0, 60), "exact");
    expect(() => insertClip(p, text(p, "Overlay", 30, 60), "exact")).toThrowError(EditError);
  });

  it("moves an overlapping clip to a free track in auto-track mode", () => {
    const p = makeProject();
    const a = insertClip(p, text(p, "Overlay", 0, 60));
    const b = insertClip(p, text(p, "Overlay", 30, 60));
    expect(p.clips[b].trackId).not.toBe(p.clips[a].trackId);
    expect(p.tracks.find((t) => t.id === p.clips[b].trackId)?.kind).toBe("visual");
  });

  it("keeps audio and visual clips on matching tracks", () => {
    const p = makeProject();
    const clip = text(p, "Overlay", 0, 30);
    clip.trackId = trackId(p, "Audio");
    expect(() => insertClip(p, clip)).toThrowError(/audio track/);
  });

  it("ripple insert pushes later clips right", () => {
    const p = makeProject();
    const later = insertClip(p, text(p, "Main", 100, 50), "exact");
    insertClip(p, text(p, "Main", 40, 30), "ripple");
    expect(p.clips[later].start).toBe(130);
  });

  it("records who made the clip", () => {
    const p = makeProject();
    const id = insertClip(p, text(p, "Overlay", 0, 30), "auto-track", { actor: agent });
    expect(p.clips[id].meta?.createdBy).toBe("agent");
    expect(p.clips[id].meta?.agent).toBe("Test agent");
  });
});

describe("move, trim and split", () => {
  it("moves a clip in time and between tracks", () => {
    const p = makeProject();
    const id = insertClip(p, text(p, "Overlay", 0, 30));
    moveClip(p, id, { start: 90, trackId: trackId(p, "Main") });
    expect(p.clips[id].start).toBe(90);
    expect(p.clips[id].trackId).toBe(trackId(p, "Main"));
  });

  it("trimming a video's start advances its source in-point", () => {
    const p = makeProject();
    const id = insertClip(p, video(p, "Main", 0, 300));
    trimClip(p, id, { start: 60 });
    const clip = p.clips[id];
    expect(clip.start).toBe(60);
    expect(clip.duration).toBe(240);
    expect(clip.type === "video" && clip.trimStart).toBe(60);
  });

  it("splitting keeps both halves contiguous and continues the source", () => {
    const p = makeProject();
    const id = insertClip(p, video(p, "Main", 30, 300));
    const [left, right] = splitClip(p, id, 130);
    expect(getClipEnd(p.clips[left])).toBe(130);
    expect(p.clips[right].start).toBe(130);
    expect(p.clips[left].duration + p.clips[right].duration).toBe(300);
    const r = p.clips[right];
    expect(r.type === "video" && r.trimStart).toBe(100);
  });

  it("refuses to split outside the clip", () => {
    const p = makeProject();
    const id = insertClip(p, text(p, "Overlay", 0, 30));
    expect(() => splitClip(p, id, 30)).toThrowError(EditError);
  });
});

describe("delete and ripple", () => {
  it("ripple delete closes the gap on the track", () => {
    const p = makeProject();
    const a = insertClip(p, text(p, "Main", 0, 60), "exact");
    const b = insertClip(p, text(p, "Main", 60, 60), "exact");
    removeClips(p, [a], { ripple: true });
    expect(p.clips[b].start).toBe(0);
  });

  it("rippleDeleteRange cuts a time range across tracks and shifts markers", () => {
    const p = makeProject();
    const a = insertClip(p, text(p, "Main", 0, 120), "exact");
    const b = insertClip(p, text(p, "Overlay", 150, 30), "exact");
    p.markers.push({ id: "m1", frame: 200, label: "end", kind: "note" });
    rippleDeleteRange(p, { start: 30, end: 60 });
    expect(p.clips[a].duration + (Object.values(p.clips).find((c) => c.id !== a && c.trackId === p.clips[a].trackId)?.duration ?? 0)).toBe(
      90,
    );
    expect(p.clips[b].start).toBe(120);
    expect(p.markers[0].frame).toBe(170);
    expect(getProjectDuration(p)).toBe(150);
  });
});

describe("guards", () => {
  it("agents can't change their clips once a human edited them, unless forced", () => {
    const p = makeProject();
    const id = insertClip(p, text(p, "Overlay", 0, 30), "auto-track", { actor: agent });
    updateClip(p, id, { name: "Agent draft" }, { actor: agent });
    expect(p.clips[id].meta?.humanEdited).toBeUndefined();
    updateClip(p, id, { name: "Mine" }, { actor: user });
    expect(p.clips[id].meta?.humanEdited).toBe(true);
    expect(() => updateClip(p, id, { name: "Agent's" }, { actor: agent })).toThrowError(EditError);
    updateClip(p, id, { name: "Agent's" }, { actor: agent, force: true });
    expect(p.clips[id].name).toBe("Agent's");
  });

  it("locked tracks reject edits", () => {
    const p = makeProject();
    const id = insertClip(p, text(p, "Overlay", 0, 30));
    updateTrack(p, trackId(p, "Overlay"), { locked: true });
    expect(() => moveClip(p, id, { start: 10 })).toThrowError(EditError);
  });
});

describe("updateClip", () => {
  it("merges transform and deletes keys set to null", () => {
    const p = makeProject();
    const id = insertClip(p, text(p, "Overlay", 0, 30));
    const before = p.clips[id].transform;
    updateClip(p, id, { transform: { x: 100 }, name: "Named" });
    expect(p.clips[id].transform.x).toBe(100);
    expect(p.clips[id].transform.y).toBe(before.y);
    updateClip(p, id, { name: null });
    expect(p.clips[id].name).toBeUndefined();
  });
});

describe("updateSettings", () => {
  it("re-times clips when the frame rate changes", () => {
    const p = makeProject();
    const id = insertClip(p, text(p, "Overlay", 30, 60));
    updateSettings(p, { fps: 60 });
    expect(p.clips[id].start).toBe(60);
    expect(p.clips[id].duration).toBe(120);
  });

  it("re-flows full-frame media when the canvas changes shape", () => {
    const p = makeProject();
    const id = insertClip(p, video(p, "Main", 0, 90, videoAsset(p, "asset_v2")));
    updateSettings(p, { width: 1080, height: 1920 });
    const t = p.clips[id].transform;
    expect(t.x).toBe(540);
    expect(t.y).toBe(960);
  });
});
