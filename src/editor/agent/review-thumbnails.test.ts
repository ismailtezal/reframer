import { describe, expect, it } from "vitest";
import { reviewToContent } from "@/server/agent/tools";
import { reviewThumbnails } from "./review-thumbnails";

describe("saved frame review thumbnails", () => {
  it("can reopen a CLI result whose frame images were stripped", () => {
    const result = reviewToContent({
      frames: [
        { timeSec: 0, dataUrl: "data:image/jpeg;base64,YQ==" },
        { timeSec: 3.5, dataUrl: "data:image/jpeg;base64,Yg==" },
      ],
    });
    const savedOutput = JSON.parse(result.text);
    expect(savedOutput.frames).toEqual([0, 3.5]);
    expect(reviewThumbnails(savedOutput)).toEqual([]);
  });

  it("keeps real thumbnails and ignores metadata-only frames in the same result", () => {
    const image = { timeSec: 0, dataUrl: "data:image/jpeg;base64,YQ==" };
    expect(
      reviewThumbnails({ frames: [0, "contact sheet", null, { timeSec: 2 }, image, { timeSec: 3, dataUrl: "(image omitted)" }] }),
    ).toEqual([image]);
  });

  it("handles missing or malformed review payloads without crashing the editor", () => {
    for (const output of [null, undefined, "review", {}, { frames: null }, { frames: {} }, { frames: [undefined] }]) {
      expect(reviewThumbnails(output)).toEqual([]);
    }
    expect(reviewThumbnails({ frames: [{ timeSec: Number.NaN, dataUrl: "data:image/jpeg;base64,YQ==" }] })).toEqual([]);
  });
});
