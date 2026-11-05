## The look

A 1930s poster that moves. **Engraved gold line on warm lacquer black**, airbrushed hard-edged volumes, and everything organised around **one vertical axis**. Ornament is the picture: sunbursts are backgrounds, stepped arches are frames, a dial is a progress bar, a bulb marquee is a reveal. Motion is mechanical and symmetrical: things unfold from the centre, doors split along the seam, lights switch on in counted order. Its register is glamour with a clock ticking: an event, a deadline, a launch.

It is not a gold-foil slideshow (things move and have volume), not Art Nouveau (no whiplash curves or flowers), and not a flat vector poster.

- **Colour:** three constants (warm black, gold, ivory) plus **one saturated accent** for the one object the story follows (burgundy here: the seal and the sleeve). A cooler jewel tone (emerald) may carry the sky or the card's fan, never competing in area.
- **Type:** Limelight for titles, Poiret One for plaques and numbers, Josefin Sans for labels and captions. Titles are architecture: a stepped gold bar that unfolds from a hairline, then a sheen sweeps across it.
- **Motion:** everything unfolds from the centre (a point, a hairline, bars open, text rises). Dials and doors move like machinery, with firm ease-in-out and a small settle. Bulbs ignite with a short overshoot. The centre axis never drifts.
- **Transitions:** door splits, arch openings, shape matches (a circle into a circle). Never a generic dissolve or slide.
- **Sound:** Gershwin-era symphonic jazz (piano, clarinet, muted trumpet, strings, brushes), not a 60s big band. Foley by material: brass clicks, an elevator ding, paper, a relay "chunk" as lights switch on. Duck the music about 9 dB under the voice.

## This template (9:16, 16 s)

Four shots on one centre axis:
1. A low-angle crane up a stepped tower whose windows light floor by floor, until the crown ignites.
2. A sunburst title card: brand plaque → title bar → year badge.
3. The title splits like doors onto an elevator. The floor dial sweeps and dings, and the bronze doors part.
4. A gloved hand presents a sealed envelope. The seal cracks and the invitation card rises out, ending on the headline, date and details under a bulb border.

Every word on screen is an input. Titles shrink to fit whatever is typed, and inputs are uppercased with Turkish rules (i → İ), so "gala gecesi" still reads GALA GECESİ.

**Voice on the beats.** The film's timing is fixed, so voice each narration line as its own clip, starting on its beat (see Beats), and keep each line short enough to finish before the next one. Generate all four lines in one take, then cut the take at the gaps between words; one take keeps the voice's tone consistent.

**Layout bands (1080×1920):**
- The film's own type sits between y 380 and y 1440.
- Captions go at about y 1460 (the band 1410–1510).
- Keep y 0–330 free for any label.
- Never lay text clips over the film's typography; change the inputs instead.

## Making a new film in this style

The engine in `film/engine/` (deco.js: gold line, airbrush, sunburst, arches, chevrons, glow; type.js: gold text, title bars, badges, dials; cam.js: a pinhole camera for real perspective) and `film/chars.js` (deco characters, gloved hands) draw anything in this look. Copy `film/` into a new pack folder, keep `main.js` and the page contract, and write new shots in `film.js` as pure functions of `t`.

- **Load fonts with Turkish sample text.** `document.fonts.load('80px Limelight', 'ŞİĞÜÖÇ şığüöç')` loads the latin-ext subset. Without it, Ş İ Ğ silently fall back to a system serif.
- **Never uppercase Turkish with `toUpperCase()`**, which turns i into I. Use `toLocaleUpperCase('tr-TR')`, or type the capitals. Italiana has no Ş, Ğ or İ, so use it for numerals only.
- **9:16 means stacking, not widening.** A title bar with wings and stepped ends is wider than 1080: use `wings: false, pad: 70`. Replace wide establishing shots with low-angle tilts, stacked dials and portrait cards.
- **Engine quirks:**
  - A door split that scales a leaf negatively makes it invisible.
  - `stepArchPts` draws a back-jump line, so draw arches on as two mirrored halves.
  - `gloveHand` lights its sleeve with white, which turns burgundy pink, so airbrush the sleeve separately.
  - Draw the fingers behind what the hand holds and the thumb in front.

Adapted from lemo-opuscar's Art Deco style guide (MIT, © LemoLab).
