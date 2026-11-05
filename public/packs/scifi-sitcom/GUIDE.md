## The look

A retro-future animated sitcom with original characters only. The lines are thick ink at a constant width at every zoom, with a 3-drawing line boil at 12 fps. Fills are flat with one hard shadow tone. The set is a 60s space-age home: rounded appliances, portholes, a starfield, and a planet hanging in the window.

The comedy is the format's: a proud machine, a deadpan human, hardware as junk, and silence as the punchline.

- **Colour:** a warm cream interior with teal cabinets and a tomato-red robot against the indigo of space. **Exactly one device glows** (here the toaster, cyan), and nothing else uses that colour.
- **Staging:** a dollhouse cutaway (the apartment on a tiny asteroid), so the tall frame is never empty wall. The two leads stand far apart, so a two-shot still works, and every line of dialogue gets its own close-up.
- **Motion:** characters on twos (12 fps), camera and effects on ones. Anticipation, a snap, overshoot and settle. The signature move here is the crane up through the ceiling hatch that pulls out to show the home in orbit.
- **Comic timing:** the music hard-cuts on the deadpan close-up and leaves room tone only. The punchline comes a beat late, and the band plus the laugh track return for the button.
- **Never:** characters resembling an existing show's, or a generic sci-fi HUD.

## This template (9:16, 16 s)

1. The space-age title (starburst + ribbon) pops on three beats.
2. The narrator sets up the scene in a two-shot.
3. Insert: the robot's mitt turns the toaster dial past every setting to the last one.
4. The toast launches on the downbeat through the ceiling hatch; the crane goes up to orbit.
5. Dead-silent close-up of the roommate.
6. The robot's two lines, the second a beat late, and the toast drifts past the window.

The inputs are the title, the ribbon, the four dial settings (the last one sets up the punchline) and the three spoken lines. Titles shrink to fit and are uppercased with Turkish rules.

**Layout (1080×1920):**
- Labels go in y 0–320, white on the indigo sky.
- The title is centred at y ≈ 570, and key action sits in y 350–1350.
- Captions (Baloo 2 800, white with an ink stroke) sit at y ≈ 1490, above the platform buttons.

## Making a new film in this style

`film/demo/toon.js` is the ink engine: `shape`, `stroke`, `ell`, `arc`, `spline`, `rr`, `noodle`, `text`, `zoom`, constant-width lines and line boil. `film/demo/chars.js` draws eyes, mouths and hands. `film/cast.js` holds the robot and the roommate, and `film/main.js` has the set, shots and timeline (one source of truth for times). `lips.json` holds mouth shapes timed to the voice.

- Don't use the library's `screenRect` or `bands` at 9:16: its W/H are fixed at 1920×1080.
- With constant line width, small details become ink blobs on far shots. Skip rivets below zoom 0.45 and draw key props larger in wide shots.
- Spell numbers out for the voice ("üç bin yirmi beş") and merge them back to digits in the captions.

Adapted from lemo-opuscar's Sci-Fi Sitcom Toon style (MIT, © LemoLab).
