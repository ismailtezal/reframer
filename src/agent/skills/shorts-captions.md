---
name: shorts-captions
description: Load when producing vertical 9:16 short-form video for TikTok, Reels or YouTube Shorts, or when adding animated word-by-word captions, hooks and safe-zone layouts to any video.
---

# Vertical shorts and captions

Short-form video is won or lost in the first second. It is mostly watched muted and partly covered by platform UI. The norm is word-by-word captions, a hook on frame 0 and constant visual change.

## Format
1080×1920, 30fps, 20–45s (≤60s). Plan for a loop: the last line should flow back into the first.

## Safe zones (1080×1920)
- Keep text and faces inside x 90–940 and y 220–1500.
- Keep clear:
  - the top 220px (status bar, search);
  - the bottom 420px (caption, username, music ticker);
  - the right 140px (like, comment and share buttons).
- For Instagram Reels ads, also keep critical text out of the bottom 35% (above y 1250).
- Center the caption block at y 1100–1230, or just under the speaker's chin. It never goes in the bottom 420px or over the eyes or mouth.

## Hook (0–1.5s)
- Words on screen by frame 3: a 3–7 word hook, 80–110px, heavy weight, slamming or popping in by word (stagger 2–3f).
- A visual change by 1.5s: a punch-in, b-roll or a cut.
- No logo, no intro card, no warm-up greeting.

## Captions
- Start from a word-level transcript, and correct names, brands and numbers before styling. Bind the caption clip to its source clip so the captions follow trims and speed changes.
- **Style:** bold sans (Montserrat or Inter, 800–900), 64–84px, white with a 5–7px black stroke or a strong shadow. The active word is yellow #FFE14D or the brand accent.
- **Grouping:** 2–3 words per page (1–2 for fast talkers), with a combine window of 400–700ms.
- **Animation:** pop, highlight-box or karaoke. Pick one per video.
- **Emphasis:** the emphasis color on at most one keyword per sentence; an emoji on at most one word every 5–8s.

## Pacing (30s)
| Time | Beat |
|---|---|
| 0–1.5s | Hook |
| 1.5–5s | Promise or setup |
| 5–25s | 3 value beats of ~6s each |
| 25–30s | Payoff and CTA; the last line loops back to the start |

- A visual change every 1.5–3s: a cut, punch-in, b-roll or overlay.
- Cut silences longer than 250–350ms (see the footage-polish skill).
- Punch-ins alternate between 1.0 and 1.12–1.2 every 4–8s, as a hard cut or a 6f smooth move.
- An overlay every 5–8s: emoji-pop, arrow-callout, social-post, or kinetic-title step numbers ("1/3") above the head at y 300–500.
- Optionally, a thin progress-bar at y ≥220 to help retention.

## Talking-head overlay pattern
Keep the original footage full-frame. Titles, step numbers and progress go above the head; captions go under the chin.

To reframe a 16:9 source into 9:16:
- crop on the face (cover fit, with the x position keyframed to follow it);
- or use a stacked layout, with the video on top and captions or visuals below.

Don't default to blurred letterbox bars.

## Sound
- Voice at −14 LUFS (true peak ≤ −1 dBTP); music ducked 18 dB under the voice.
- SFX ≤6 per minute: a pop on emphasis, a whoosh on a punch-in.

## Banned
- Captions in the bottom 420px or over faces.
- More than 3 words per page; full sentences on screen.
- Captions without a stroke or shadow; 3 or more caption colors.
- An emoji on every line.
- Blurred-bar letterboxing by default.
- Slow intros; logos in the first 2s.
- Other platforms' watermarks; misspelled names.

## Self-check before finishing
- [ ] Words on screen by frame 3; a visual change by 1.5s.
- [ ] Everything inside the safe zones.
- [ ] Captions within ±2 frames of speech, with spelling checked.
- [ ] ≤3 words per page and one caption animation style.
- [ ] The ending loops; ran the self-review skill.
