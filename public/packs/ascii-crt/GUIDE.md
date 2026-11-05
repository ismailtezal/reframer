## The look

A single monochrome terminal: **green P1 phosphor** (or amber P3) glowing on dark curved glass with scanlines. Every image is made of **real glyphs on a character grid**, picked by ink density: titles, pictures, gauges and log lines alike. The only camera is the size of the grid. Bigger cells push in; smaller cells pull out.

The mood is cold, patient and machine-calm: typed text, a blinking cursor as suspense, and **one warm surprise**.

Never fake it with an image run through an "ASCII filter". It isn't hacker-movie green rain, pixel art or a sci-fi HUD.

- **One phosphor carries everything**, in its own brightness ramp (dim, normal, bold, inverse video).
  - **At most one second colour**, used for one thing only and switched on once, on a downbeat (here, warm coffee amber at the confirmation).
- **Type:** VT323, one monospace font for everything. It covers Turkish (ŞİĞÜÖÇ şığüöç) but has no ☕ and no `…`, so write `c[_]` and `...`.
- **Motion:**
  - Characters never move off the grid. Typing, counters and scrolling jump cell to cell.
  - Only three things move continuously: the grid scale (the camera), the CRT physics, and particles in a declared transformation.
  - Typing speed is performance: machine output is fast and even, and human typing is uneven, timed to the voice.
- **Sound:** a cold analog synth drone, key clicks, terminal beeps, a relay "chunk", a modem handshake. Use silence before the payoff, then one warm chord when the colour changes.

## This template (9:16, 15 s)

1. The tube powers on to a blinking alert.
2. Pull out to the terminal: an ASCII glass mug, used as a gauge, drains to its last percent while the gauge line types out.
3. The diagnosis types in four "LABEL ....... VALUE" lines. The last value is the punchline, flashed in inverse video.
4. The command types in sync with the voice, followed by the modem and a progress bar.
5. On the confirmation, the warm colour switches on, the cup refills with coffee made of the letters of `fillWord`, steam rises, and the log closes on the callbacks (`after1`, `after4`).

Every word on the terminal is an input. Inputs are uppercased with Turkish rules. Diagnosis lines are written `LABEL: VALUE`, and the dot leaders are drawn for you. Keep labels to 18 characters or fewer, so values line up at column 20.

**Voice on the beats.** Generate each line as its own take (a single take runs "iki." into "Verimlilik" with no pause). Start each line on its beat. A system voice with a light robotic treatment fits best.

**Layout (1080×1920):**
- y 0–330 is free for labels; the status header is at y 372 and the sub line at y 446.
- The picture grid sits at y 460–1150 and the log pane at y 1092–1330.
- Captions go at about y 1440, in the band left free between the LOG strip and the function-key bar.
- All terminal text stays inside x 86–950, clear of the platform buttons.

## Making a new film in this style

`film/term.js` holds the glyph atlas (VT323, with the Turkish letters added and glyph tops unclipped), `text`, `inverse`, `cursor`, `makeRamp(word)` (a density ramp made from a word's letters) and `glyph`. `film/crt.js` is the WebGL CRT pass: phosphor ramp, bloom, scanlines, curvature and a rounded mask computed in aspect-corrected space. Paint any subject in grayscale into an offscreen "negative" aligned to the grid, pick a glyph per cell, and draw the grid at the camera's cell size.

- Use readable grids on a phone: 24–34 px cells (36 columns at most) for text. Bigger cells for alarms and titles.
- The inverse-video block must start above the dot of İ (−0.12 to 1.9 cell heights), or "SİSTEM" reads as "SISTEM".
- Text that disappears decays over about 0.1 s of afterglow, computed from `t`, so every frame stays deterministic.
- `?sheet=t1,t2,…` tiles up to 16 frames over the page for review, and `?frame=glyphs` shows the Turkish glyph test.

Adapted from lemo-opuscar's ASCII / CRT Terminal style guide (MIT, © LemoLab).
