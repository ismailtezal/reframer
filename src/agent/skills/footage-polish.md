---
name: footage-polish
description: Load when editing real footage such as talking-head, vlog, screencast, tutorial, interview or podcast video to remove silences and fillers and add punch-ins, captions, b-roll, chapters and clean audio.
---

# Footage polish

For most people the real problem is editing, not generating. Work in the order below, and keep the speaker's meaning intact.

## Order of operations
1. Transcribe at word level and read it end to end.
2. Cut silences, fillers and retakes.
3. Structure it: hook first, then chapters.
4. Add punch-ins and zooms.
5. Add b-roll and overlays.
6. Add captions bound to the source clip.
7. Clean up the audio, add music, set loudness.
8. Grade.
9. Run the self-review skill.

## Silences, fillers, retakes
- Remove gaps longer than:
  - 200–300ms for energetic shorts;
  - 350–500ms for a YouTube talking head;
  - 500–700ms for calm educational content and interviews.
- Leave 80–120ms of padding before and after words so consonants and breaths aren't clipped, and add 1–2f audio fades at every cut.
- Remove fillers (um, uh, filler "like", "you know") and false starts. When a sentence is repeated, keep the last complete take.
- Keep pauses that carry meaning (jokes, emphasis, emotion). Never cut mid-word.
- Expect the runtime to shrink by 10–30%. If it shrinks more, you are probably cutting content, so check with the user.

## Hiding jump cuts
- Alternate the framing on consecutive cuts (scale 1.00 → 1.08–1.15), keeping the eyes at the same height in the upper third.
- Hard-cut punch-ins feel energetic; animated ones (6–10f, smooth) feel calmer.

## Punch-ins and emphasis
- An emphasis zoom of 1.15–1.3 on key lines.
- 2–4 per minute for educational content, 6–10 per minute for shorts. Never on every sentence.

## Screencasts and tutorials
- Zoom into the action (1.5–2.0× over 18–24f, smooth), hold while the viewer reads, then zoom out over 12–18f.
- Put a cursor-click highlight on clicks.
- Speed up idle stretches, loading and long typing 2–4×, with a small "4×" label. Cut dead waits entirely.
- After zooming, UI text should be at least 28px at 1080p.
- Blur or cover personal data, keys and email addresses.

## B-roll and overlays
- Frequency: a b-roll shot, graphic or overlay every 15–30s in educational talking-head videos, every 5–8s in shorts.
- Overlays to use:
  - a lower-third with the name and role at the speaker's first appearance (4–6s);
  - a chapter-card at the start of each section;
  - an arrow-callout to point at things;
  - a social-post for posts that are mentioned;
  - a quote-card for quotes;
  - an emoji-pop, sparingly.
- Chapter markers at real topic changes: the first at 0:00, each at least 10s apart.

## Captions
- Word level, corrected (names, brands, numbers), and bound to the source clip so they follow trims.
- Landscape: at most 2 lines, 42–56px, inset about 10% from the bottom.
- Vertical: follow the shorts-captions skill.

## Podcasts and interviews
- Switch to the angle of whoever is speaking, holding each for 4–12s.
- Split-screen during cross-talk; use reaction shots sparingly.
- For audio-only clips, make an audiogram (see the music-visualizer skill).

## Audio
- Voice first: high-pass at about 80Hz, light noise reduction, gentle compression.
- Loudness: −14 LUFS for YouTube and social, −16 LUFS for podcasts; true peak ≤ −1 dBTP.
- Duck music 15–20 dB under the voice.
- Fill gaps with room tone rather than digital silence.

## Grade
- Fix white balance and exposure first, then contrast 1.05–1.1.
- Keep skin tones natural.
- Add a look or LUT only when the style calls for it.

## Respect the human
- Never overwrite clips marked as human-edited; propose changes instead.
- Explain any non-obvious cuts in clip notes.

## Banned
- Removing every breath, which sounds robotic.
- Cuts mid-word.
- Captions over faces or UI.
- Constant zoom pulsing; an emoji on every line.
- Music louder than the voice.
- Over-sharpening or heavy beauty filters.
- Changing what the speaker meant.

## Self-check before finishing
- [ ] Listened to every cut boundary (±2 frames): no clipped words, no pops.
- [ ] Runtime reduced by 10–30%, unless agreed otherwise.
- [ ] Captions are in sync and spelled correctly.
- [ ] Loudness is on target, and the voice stays clear over the music.
- [ ] Ran the self-review skill.
