## The look

Found camcorder footage of a place that should have people in it and doesn't. The camera is held upright and recording at 3 a.m. It drifts through a space that is slightly too big and too long: fluorescent light, yellowed walls, endless empty desks. The tape itself carries the story: REC, a ticking clock, a date stamp, a title generator, tracking noise, head-switching at the bottom and dropouts.

It is uncanny but never gory. There are no monsters; the joke or the dread is in the ordinary (a note about tomorrow's meeting).

- **Colour:** a dominant sick-yellow/green fluorescent cast, plus exactly **one saturated signal colour** on the one object that matters (here the monitor's blue). Nothing else may use that hue.
- **Light:** only about 30 % of the light banks are on (night mode), with the aisle row lit. Every light on reads clinical.
- **Camera:** a handheld drift with small breathing, a slow pan, a walk down the corridor, a turn toward a sound, a push-in with an autofocus hunt. No cuts inside the tape. The tape tearing is the only "transition".
- **OSD:** two layers. The camcorder OSD (REC, clock, date, title) is burned into the signal, so it picks up the tape blur and the tracking tear. The VCR's blue screen and "PLAY ▶" sit after the tape pass and stay clean.
- **Sound:** fluorescent hum gated by the same light curve as the picture (it dies with the lights), room tone, camcorder handling, one distant diegetic sound (an elevator ding) that turns the camera. About 0.3 s of silence comes before the static hits. Whisper, don't narrate.

## This template (9:16, 15 s)

1. Blue VCR screen, PLAY ▶, and the tape rolls in on an empty chair still turning by itself, under the title generator.
2. Pan across endless empty desks, then a walk down a corridor that goes on too long.
3. A distant ding turns the camera to the one monitor left on. It zooms and refocuses until the sticky note reads.
4. The punchline whisper; the lights flicker three times and die; the tape tears into static.

The inputs are the title, the camcorder clock and date, and the note's two lines. The note is handwritten (Caveat), and its first word on line 2 gets the double underline. Whisper three short lines on the beats; the last line is the punchline about the note.

**Layout (1080×1920):**
- Labels sit at y 170–300; REC and PLAY at y ≈ 420.
- Captions are VT323 on a solid black box at y ≈ 1380.
- The clock and date sit bottom-right at y 1470–1600.

## Making a new film in this style

`film/world.js` builds the space in three.js: wall, desks, light banks and a corridor whose length is a parameter. `film/tex.js` paints textures in canvas, including the sticky note. `film/vhs.js` is the camcorder and VCR pass, and `film/osd.js` draws both OSD layers. `film/story.js` holds the timeline and the camera route, and `film/core/three/post.js` adds GTAO, autofocus depth of field and bloom.

- Render the 3D at 540×960 and let the VHS pass scale it 2× to 1080×1920. Tape effects run on a fixed 480-line grid; lens barrel and vignette use the portrait aspect.
- Light only what is in front of the screen plane: a screen-glow light placed in front of the glass blows out the note stuck on it.
- Use an integer-style hash for the snow (the sine hash makes diagonal moiré).
- Fonts: VT323 (alias `VCR`) for the OSD, Caveat 700 (alias `Hand`) for handwriting. `await window.packFonts()` before painting textures, so İ, ş and ğ never fall back.

Adapted from lemo-opuscar's Liminal Found Footage style (MIT, © LemoLab).
