## The look

An 80s TV-anime opening as it looked on videotape. Characters are **flat cels**: one base, a hard shadow, a highlight crescent, coloured lines, and a ~3 px magenta or cyan rim on screen. Backgrounds are **airbrushed plates painted once**, each a colour layer plus an emissive layer for neon and windows, with light bands swept over held cels.

The tape adds bloom, halation, chroma bleed, scanlines and a power-on.

- **Colour:** night indigo and violet with hot magenta, cyan and amber neon. Faces are lit by the screen. Red for the alarm moments.
- **Type:** Kanit 900 with a synthetic italic for the chrome title, Dela Gothic One for katakana and neon signs, Barlow Semi Condensed 700 for captions. Never draw a glyph the font lacks (`↵` fell back and the whole text draw vanished), so draw icons as paths.
- **Motion:**
  - Characters animate on twos (12 fps). Blinks and the 3-drawing eye opening run on threes (8 fps).
  - The camera, light bands and flares run on ones.
  - Impact frames are 2 frames of a white silhouette on red focus lines, with a shake.
- **Cuts:** every cut sits on a beat. Transitions are cuts, white flashes, impact frames or tracking noise, never dissolves.
- **9:16 grammar:** a vertical crane, an eye strip (a horizontal band with focus lines above and below), a stacked title.
- **Sound:** city pop, an intense narrator, impacts and glints on the picture's hits.

## This template (9:16, 16 s)

1. Crane down from a big moon over a neon city to one lit window.
2. Over the monitor: the desk clock reads two minutes before the deadline.
3. On the word for the minute, an impact frame slams it to one minute before.
4. Speed-line close-ups, then the eye strip: her eyes snap open with a glint.
5. The chrome title, with its katakana line and the red LED deadline, lands on the big hit.
6. Her finger slams the big key on the final hit; a burst of light resolves back to the city.

The inputs are the two title lines, the katakana line, the tagline, the deadline (the clocks count to it) and the key label. Titles shrink to fit the frame. Write the narration so the minute lands on the impact frame, and spell the time out for the voice.

**Layout (1080×1920):**
- Keep y 0–300 dark for labels.
- Faces, the clock and the title sit in y ≈ 380–1380.
- Captions sit at y ≈ 1421, so two lines end above the bottom 22 % of the frame (platform UI).

## Making a new film in this style

`film/demo/cel.js` is the cel engine: `cel`, `path`, `poly`, `ribbon`, `flutter`, `line`, `airbrush` and `vgrad`. `film/demo/post.js` is the videotape pass. `film/kit.js` adds layers, speed lines, flares, lamps and the LED digits. `film/plates.js` holds the painted city, `film/dev80.js` the heroine, and `film/shots.js` one function per shot.

- Headless Chrome can silently drop draw calls on the main canvas after clipped cels. Draw characters through `celLayer` (CPU canvases), and `flush()` after clipped cels drawn on the scene.
- Never set `ctx.filter` blur per frame; pre-blur once at load.
- `await window.packFonts()`, and load the katakana face with its sample text.

Adapted from lemo-opuscar's 80s Cel Anime style (MIT, © LemoLab).
