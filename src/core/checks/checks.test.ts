import { describe, expect, it } from "vitest";
import { fingerprint, isEnergetic } from "./frames";
import { caseFindings, contrastFindings, glyphFindings, type LayoutFound, safeAreaFindings, type TextBlock, tallyLayout } from "./layout";
import { type Pixels, resample } from "./pixels";

/** A w×h frame filled with one color, with an optional rectangle in another. */
const frame = (w: number, h: number, rgb: number[], rect?: { x: number; y: number; w: number; h: number; rgb: number[] }): Pixels => {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const inside = rect && x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      const [r, g, b] = inside ? rect.rgb : rgb;
      px.set([r, g, b, 255], (y * w + x) * 4);
    }
  return { px, w, h };
};

const block = (over: Partial<TextBlock> = {}): TextBlock => ({
  text: "Hello",
  box: { x: 20, y: 20, w: 40, h: 20 },
  lineH: 120,
  rgb: [255, 255, 255],
  ...over,
});

describe("resample", () => {
  it("averages the pixels each target pixel covers", () => {
    // Left half black, right half white → one pixel of mid grey.
    const src = frame(4, 2, [0, 0, 0], { x: 2, y: 0, w: 2, h: 2, rgb: [255, 255, 255] });
    const { px } = resample(src, 1, 1);
    expect(px[0]).toBeCloseTo(127.5);
  });

  it("gives a 32×18 grayscale fingerprint for any frame size", () => {
    expect(fingerprint(frame(480, 853, [10, 20, 30]))).toHaveLength(32 * 18);
  });
});

describe("contrastFindings", () => {
  // Letters are where the probe (letters painted magenta) differs from the frame.
  const letters = { x: 30, y: 25, w: 10, h: 8, rgb: [255, 0, 255] };

  it("flags white text on a near-white picture", () => {
    const W = 100;
    const H = 100;
    const shown = frame(W, H, [235, 235, 235], { ...letters, rgb: [255, 255, 255] });
    const probe = frame(W, H, [235, 235, 235], letters);
    const found = contrastFindings([block()], shown, probe, W, H);
    expect(found.map((f) => f.kind)).toEqual(["contrast"]);
  });

  it("passes white text on black", () => {
    const W = 100;
    const H = 100;
    const shown = frame(W, H, [0, 0, 0], { ...letters, rgb: [255, 255, 255] });
    const probe = frame(W, H, [0, 0, 0], letters);
    expect(contrastFindings([block()], shown, probe, W, H)).toEqual([]);
  });
});

describe("text findings", () => {
  it("reports letters a font can't draw", () => {
    expect(glyphFindings([block({ font: "Permanent Marker", missing: "Şğ" })])[0]?.detail).toBe("Permanent Marker|Şğ");
    expect(glyphFindings([block({ font: "Inter" })])).toEqual([]);
  });

  it("flags CSS uppercase on Turkish text not marked as Turkish", () => {
    const upper = block({ text: "istanbul", caseTransform: "uppercase" });
    expect(caseFindings([upper], "tr")).toHaveLength(1);
    expect(caseFindings([{ ...upper, lang: "tr" }], "tr")).toEqual([]);
    expect(caseFindings([upper], "en")).toEqual([]);
  });

  it("finds text under the app interface on vertical video only", () => {
    const low = block({ box: { x: 200, y: 1700, w: 600, h: 80 } });
    const mid = block({ box: { x: 200, y: 900, w: 600, h: 80 } });
    expect(safeAreaFindings([low, mid], 1080, 1920).map((f) => f.detail)).toEqual(["caption area"]);
    expect(safeAreaFindings([low], 1920, 1080)).toEqual([]);
  });
});

describe("tallyLayout", () => {
  const edge: LayoutFound = { kind: "edge", key: "edge:A", text: "A" };
  const glyphs: LayoutFound = { kind: "glyphs", key: "glyphs:X", text: "B", detail: "Font|ş" };

  it("counts a layout problem once it holds for two samples in a row", () => {
    expect(
      tallyLayout(
        [
          { frame: 15, layout: [edge] },
          { frame: 45, layout: [] },
        ],
        30,
      ),
    ).toEqual([]);
    const held = tallyLayout(
      [
        { frame: 15, layout: [edge] },
        { frame: 45, layout: [edge] },
      ],
      30,
    );
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ kind: "edge", firstFrame: 15, lastFrame: 45 });
  });

  it("counts missing letters from one sample", () => {
    expect(tallyLayout([{ frame: 15, layout: [glyphs] }], 30)).toHaveLength(1);
  });
});

describe("isEnergetic", () => {
  it("reads energy words in English and Turkish, and calm overrides", () => {
    expect(isEnergetic("enerjik bir tanıtım")).toBe(true);
    expect(isEnergetic("fast but calm")).toBe(false);
    expect(isEnergetic("a product demo")).toBe(false);
  });
});
