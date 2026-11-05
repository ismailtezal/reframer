## The look

An early-1930s cartoon on a worn sepia print. The characters are rubber-hose:
- pie-cut eyes and white four-finger gloves;
- noodle arms and legs with no elbows or knees;
- big shoes and a bouncy walk.

Everything is alive and moves on the band's beat: props breathe, the hero bobs, objects have faces and opinions. The print is part of the look: gate weave, flicker, scratches, dust, grain, a rounded gate, and line boil at 10 fps.

- **Colour:** monochrome sepia (or cool silver), flat greys with soft watercolour washes on the background. No colour accents.
- **Type:** Shrikhand for fat bouncy titles, Limelight for deco caps (title-card tagline, banners, signs), Old Standard TT for captions. The style's own IM Fell English SC has no ı, ş or ğ, so don't use it for Turkish.
- **Motion:**
  - Characters animate on twos (15 drawings a second at 30 fps). The camera moves every frame.
  - Squash and stretch, anticipation, and impossible stretches (an arm up the whole wall).
  - Gags escalate in threes: the setup, a hit or dodge, then a bigger try.
- **Timing:** measure the music's beat first and put every cue on a beat index, so the whole film is Mickey-moused to the band.
- **Transitions:** a window-shade roll-up for the title and an iris-out to the end card. Nothing else.
- **Sound:** a hot-jazz or ragtime cartoon band, a cheerful radio announcer through an old-radio filter, and effects on every action (ring, boing, slide whistle, bonk, sad trombone). The effects are dense on purpose.

## This template (9:16, 16 s)

1. The title card with sunburst rays bounces on the beat.
2. The shade rolls up on a bedroom: the hero snores, and the alarm clock on the nightstand hops on every beat.
3. On the downbeat the clock rings. The hero's noodle arm swats it, and it dodges; a second swat stretches all the way up the wall, and it dodges again.
4. The hero gives up, nightcap in hand, and the film irises out to the end card.

The inputs are the two title lines, the tagline, the calendar page on the wall, the end-card word and the three narration lines. The end card's subtitle repeats the title. Long titles shrink to fit.

**Layout (1080×1920):**
- The picture is a portrait gate 1020×1260 at y 336 inside black bands.
- The top band holds the labels.
- Captions sit on a dark plate at y ≈ 1444, over the foot of the bed, never on the gag.

## Making a new film in this style

`film/demo/toon.js` and `film/demo/chars.js` draw the rubber-hose parts (`pieEye`, `brow`, `mouth`, `glove`, `shoe`, `hose`, `ribbon`), and `film/demo/bg.js` paints the watercolour backgrounds. `film/hero.js` and `film/clock.js` are the two actors, `film/room.js` is the set, and `film/main.js` holds the beat-indexed timeline and the camera (`B(k)` is beat k).

- At zoom 1 the faces are too small for a phone: shoot wide at z 1.22–1.32, push in to about 1.55, and go to about 2.2 for close-ups. Keep leaps inside the gate at the current zoom.
- Never uppercase Turkish with CSS or `toUpperCase()`: i becomes I instead of İ.
- `await window.packFonts()` before drawing, so every Turkish letter is in the title font.

Adapted from lemo-opuscar's 1930s Rubber Hose style (MIT, © LemoLab).
