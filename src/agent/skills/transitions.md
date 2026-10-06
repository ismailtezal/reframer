---
name: transitions
description: Load before adding any transition (set_transition) or when a cut feels abrupt, for when a professional editor uses a transition at all, which one carries which meaning, plugin-quality lengths, direction and sound pairing.
---

# Transitions: punctuation, not decoration

Over 99% of edit points in modern films are straight cuts. The plain cut is invisible and keeps the story moving; a transition is punctuation that says "something changed". A transition on many cuts is the most recognizable template and AI tell.

## When
- Make ≥ 90% of edit points hard cuts (≥ 95% for documentary, talking head and premium brand work).
- Every transition needs a reason; write it in the clip note:
  - change of time or place (dissolve, dip);
  - change of energy or section, usually on a music drop (whip, zoom, flash);
  - a continuous move you can extend (whip with a real camera pan, zoom into a detail or a screen);
  - a chapter or the ending (dip to black).
- Use at most 2 transition types per piece (plus one accent at the biggest moment). Never repeat the same transition on consecutive cuts.
- Prefer, in this order: a cut on action → a J/L cut → a match cut → a soft cut (4–8 f dissolve to smooth a jump) → an optical transition.
- Put the transition's midpoint on a beat or downbeat (detect_beats); that is where the picture swaps.

## Which one means what
| Transition | Meaning / use | Length @30fps | Cap |
|---|---|---|---|
| Hard cut | the default; rhythm and clarity | — | — |
| Soft cut (`fade`, 4–8 f) | smooth a jump cut without calling attention | 4–8 f | — |
| Cross dissolve (`fade`) | time passing, memory, gentle montage | 15–30 f | — |
| Blur dissolve (`blur`) | dream, flashback, soft emotional shift | 15–24 f | — |
| Dip to black | chapter end, ending, big time jump | 20–30 f | 3 per piece |
| Dip to white / `flash` | a burst of energy, a camera flash, a drop | 6–10 f | 1 per 30 s |
| Whip pan (`whip`) | energy, "meanwhile", travel; continue a real camera pan | 8–12 f | 1 per 20 s |
| Push / slide | next step, next item, a card arriving | 10–16 f | 1 per 20 s |
| Zoom in / out | going deeper into a detail or screen / stepping back | 10–14 f | 1 per 30 s |
| Spin, stretch, lens warp | high energy, playful, music hits (style must call for it) | 12–18 f | 1 per 30 s |
| Glitch | tech, digital, error, gaming | 6–12 f | 1 per 30 s |
| Light leak | warm, nostalgic, summer, wedding | 24–36 f | once per film |
| Wipe, iris, clock wipe | graphic or retro styles only | 12–20 f | rare |
| Flip | dated; ironic or kids content only | — | avoid |

## Palette by style
| Style | Use |
|---|---|
| Documentary, interview, corporate | cuts, J/L cuts, cut on action, 12–24 f dissolves for time, dip to black between acts |
| Trailer / promo | hard cuts on beats, dips to black, flash frames, music stop-downs; glitch for tech |
| Travel / vlog | zoom-throughs, whips, match cuts, a light leak |
| Wedding / lifestyle | dissolves, blur dissolves, light leaks |
| Music video / hype | flash, glitch, stretch, spin on the beat |
| Tech / product / SaaS | push or slide into UI, zoom into the screen, clean soft wipes |
| Short-form social | punch-in zooms, whips and flashes on beats, but still mostly cuts |
| Kids / comedy | spins, stretches, pops |

## Direction and continuity
- Match the motion inside the shots: camera pans left → whip left; subject moves up → push up.
- Keep one direction for "forward" through the video (left = next).
- Seamless transitions hide the swap inside fast motion: cut on a pass-by, a fast move or a dark frame.
- Match cuts beat every transition: a similar shape, color or action in both shots needs no effect at all.

## Mechanics in Reframer
- `set_transition` on the incoming clip; the previous clip on the same track must reach the cut.
- Pass `withSound: true` for optical transitions (whip, push, zoom, spin, stretch, warp, flash, glitch, light leak): the matching built-in sound is placed with its peak exactly on the swap frame. Dissolves and dips stay silent.
- Transitions render like plugin transitions: speed peaks on the cut, motion blur follows the velocity, zooms are exponential with radial blur, flashes blow out exposure, glitches step at ~12 Hz with RGB split. Don't add extra blur or shake on top.
- Don't put picture transitions on text layers; give text its own entrance and exit.

## Checklist
- [ ] ≥ 90% of edit points are plain cuts; every transition has a written reason.
- [ ] ≤ 2 types plus one accent; caps respected; nothing repeated on consecutive cuts.
- [ ] Midpoints on beats; direction matches the motion; lengths in range.
- [ ] Optical transitions have their sound (withSound), peaking on the cut.
