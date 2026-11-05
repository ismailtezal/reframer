## The look

An editorial explainer made of **hand-cut paper**. Every image is a set of printed cut-outs: scissor- or torn-edged pieces with a cream sticker rim and a paper drop shadow, halftone dots instead of smooth gradients, tape, newspaper clippings and paper grain. It is not 3D and not CGI. Each beat has **one bold flat background colour**. Maps carry the story: coarse coastlines, a highlighted country, and **red dashed routes** that wipe in.

- **Colour:** one accent only (vermilion `#E2412B` by default) for routes, the hero word and the active caption box. Backgrounds change per beat (coffee brown → ochre → İznik teal → newsprint cream → dark coffee). Changing colours between beats is intended.
- **Type:** headlines are live text on scissor-cut strips (Playfair Display 900), in cream, ink or red boxes tilted ±2–3°, popping in with overshoot. A four-digit year can be a ransom note: one digit per paper and font, landing with a stamp sound. Captions are Archivo 800 on a cream card, with the active word on the accent box.
- **Never bake Turkish text into generated images:** image models misspell it. Keep the top third of each image calm and put headlines on top as live text.

## Making a film (any topic)

1. **Voice first.** Write the narration and generate it; the word timings decide where each beat starts.
2. **Pictures:** one set of cut-out pieces per beat (a hero object, a map, a few scraps), as transparent PNGs. With an image model, use vox-director's five-part prompt:
   1. The same style block on every beat: "mixed-media hand-cut paper collage, editorial zine; torn and scissor-cut edges, tape, halftone dots, newspaper clippings, paper drop shadows; printed cut-outs, NOT 3D/CGI, keep grain".
   2. The scene as separate cut-out pieces, each with its edge and shadow.
   3. One bold flat background colour.
   4. No text in the image, and a calm top third.
   5. "9:16, 2k".

   Without an image model, `kit/draw.mjs` and `kit/geo.mjs` draw the pieces procedurally as SVG and rasterize them with headless Chrome to transparent PNGs:
   - sticker filter, real variable-size halftone and paper grain;
   - seeded torn polygons;
   - an orthographic globe and maps from coarse coastlines.

   They are a reference implementation from the preview; the pieces are coffee-themed.
3. **Motion, in the timeline:**
   - Each beat is a 1160×2140 paper sheet with a torn top edge. It slides up over the previous beat (y +2160 → 960, rotation 6° → 0.4°, expo-out, 0.42 s, with a paper swish), then pushes in slowly (scale 1 → 1.035).
   - Cut-outs are separate image clips. Each enters with overshoot (an off-screen slide or a scale pop plus rotation), then drifts linearly for parallax.
   - Route overlays wipe in and follow the map's drift.
   - Put each beat on new tracks (`trackId: "new"`), so the next sheet covers everything before it. Then `set_keyframes` per clip; easing applies to the segment that starts at a keyframe.

   `kit/build.mjs` is the preview's timeline builder (clip order, keyframes, headline strips) to copy patterns from.
4. **Sound:** a light documentary bed ducked about 7 dB under the voice, a paper swish on each sheet, and a stamp on the ransom-note year.

**Layout (1080×1920):**
- Headlines go in the top third (y ≈ 380–720).
- The hero cut-outs sit in the middle.
- Captions go at y ≈ 1444.
- Light sheets (ochre, newsprint) need a darker top band behind white labels.

Look rules and prompt structure from vox-director by Alisa Qian (MIT).
