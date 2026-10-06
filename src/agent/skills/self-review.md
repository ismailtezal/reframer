---
name: self-review
description: Load before declaring any video finished, after each major build pass, or whenever the user says something looks off, to run the contact-sheet critique loop that scores 1 to 10 and fixes the worst three issues.
---

# Self-review: the critique loop

You can't watch the video, and "it renders" does not mean "it's good". The best AI-made videos came out of a loop: render frames, look hard, score honestly, fix the worst problems, and repeat. Run this loop every time.

## 1. Look
- **Contact sheet:** one frame every 0.5s (every 15f at 30fps) in a 6-column grid. Check the rhythm, repetition and dead stretches.
- **Key stills:**
  - frame 0 and the last frame;
  - each cut at −2, 0 and +2 frames;
  - the midpoint of each transition;
  - the frame where each text finishes animating.
- **Vertical video:** overlay the safe-zone guides (top 220px, bottom 420px, right 140px).

## 2. Measure
- **Timing:**
  - duration versus the brief;
  - time to first motion (≤3f);
  - subject or product on screen within 3s for promos.
- **Shots:**
  - average and longest shot;
  - longest static stretch, ≤3s unless it is a deliberate hold of ≤4s.
- **Sync:** cuts on beat markers (±1f); captions against speech (±2f).
- **Text:** for each text, check:
  - size against the minimums, and contrast;
  - time on screen ≥ 0.3s per word + 0.6s;
  - that it sits inside the safe zones;
  - no overlaps, and no orphan words or characters alone on a line.
- **Style:** ≤2 fonts, ≤1 accent, ≥90% plain cuts, ≤2 transition types.
- **Rhythm:** median/mean shot length 0.45–0.85, no run of 5+ equal-length shots, at least one 1.5s+ hold per 30s.
- **Audio:**
  - integrated loudness about −14 LUFS, true peak ≤ −1 dBTP;
  - music ducked under the voice;
  - a clean ending.

## 3. Score each dimension 1–10
| Dimension | A 3 looks like | A 9 looks like |
|---|---|---|
| Hook | a static or slow first 2s | frame 0 grabs attention; the promise is clear by 1.5s |
| Message | unclear, several ideas per shot | one idea per shot; an obvious story |
| Readability | small, fast or low-contrast text | legible on a phone and timed for reading |
| Motion | linear, simultaneous, janky | eased, staggered, settles, purposeful |
| Composition & type | everything centered, weak hierarchy | a strong grid, scale contrast, tight spacing |
| Pacing & rhythm | a slideshow, dead beats | a change every 2–4s, cuts on the beat |
| Authenticity | invented UI, data or reviews | real assets, true to the brand |
| Sound & sync | off-beat, too loud, an abrupt end | hits on events, balanced, resolves |
| Distinctiveness | the default AI look | clearly this brief's style |

Score from evidence (the frames and the numbers), not hope.

## 4. Fix the worst three
1. Take the three lowest scores. Break ties by fixing the most visible issue first.
2. Make concrete edits, for example:
   - move a cut onto the beat;
   - enlarge text;
   - replace a fade with mask-reveal;
   - delete a particle layer;
   - extend a hold.
3. Re-render only the affected range.
4. Never touch clips marked as human-edited; propose a change instead.
5. Note what changed, and why, in the clip notes.

## 5. Repeat
Loop until every dimension scores 8 or more. If issues remain after 3 loops, report them honestly with suggested next steps.

## Defects to hunt
- **Timing:**
  - elements appearing on the exact cut frame;
  - 1-frame gaps or flashes at cuts;
  - dead beats;
  - loop seams, where the last frame doesn't match the first.
- **Text:**
  - overlapping text during transitions;
  - text swapping mid-morph;
  - blurry upscaled text or images.
- **Motion:** sliding instead of easing; idle wiggles.
- **Captions:** under platform UI or over faces.
- **Audio:** clicks at cuts; music ending mid-phrase.
- **Image:** washed-out or clipped colors.
- **Spelling:** typos, especially in names and numbers.

## Report to the user
Send a short scorecard:
- the scores;
- the three fixes you made;
- known limitations;
- any facts or assets that need their confirmation.

## Banned
- Declaring the video done without looking at frames.
- Inflated scores.
- Changing everything at once.
- Re-rendering the whole video for a one-second fix.
- Hiding known problems.

## Self-check before finishing
- [ ] Reviewed the contact sheet and key stills in this loop.
- [ ] Every dimension scores 8 or more, or the remaining issues are reported.
- [ ] No human-edited clip was changed.
- [ ] Sent the scorecard.
