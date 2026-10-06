---
name: music-visualizer
description: Load when the audio is the star, such as lyric videos, music videos, audiograms or podcast clips with waveforms, beat-synced montages, or single and album promos.
---

# Music visualizers, lyric videos and audiograms

You can't hear the track, so treat the music analysis (beats, BPM, loudness) and the transcript as the score. Time everything that moves from that data so it stays deterministic and in sync.

## Beat math (30fps)
- Frames per beat = 1800 ÷ BPM (120 BPM → 15f, 90 BPM → 20f). A bar is 4 beats.
- Add beat markers on the downbeats.
- Section energy sets the cut rate: verses every 2–4 beats, choruses every 1–2 beats, the drop on the beat.

## Lyric video
- **Timing:** get word-level timing from the vocals, and check every word against the official lyrics. Never guess lyrics.
- **Pages:** one line per page. A line enters 6–10f before it is sung and leaves 4–6f after. Highlight the current word (karaoke or highlight), or slam in the stressed words.
- **Size and placement:** 72–110px on 16:9, 90–130px on 9:16, centered in the lower-middle third. Put a 30–50% black scrim or a blur behind text on busy backgrounds.
- **Vary by section:**
  - verses calm (rise-blur by word, stagger 3–4f, smooth);
  - choruses bigger and bolder (slam or stretch, the accent color, scale 1.15);
  - the bridge gets a new palette or layout.
- **Background:**
  - cover art with a ken-burns loop, 20–40px of blur and a grade;
  - or a gradient-mesh built from the cover's palette.
  - Optionally add glow-orbs pulsing on the kick (a pulse loop with period = frames per beat, intensity ≤0.5).

## Audiogram / podcast clip
- **Format:** 1:1 or 9:16, 30–90s.
- **Elements:**
  - cover art, show name and episode title;
  - a lower-third with the speaker's name;
  - word-by-word captions (shorts-captions rules);
  - a progress-bar.
- **Waveform:** a line or 24–64 bars driven by the audio amplitude, with an attack of 1–2f and a release of 6–10f so it doesn't jitter. Use log-scaled heights.
- **Choosing the clip:** a complete thought, with a hook in the first 3s.

## Beat-synced montage
- Cut on beats, with hits on downbeats.
- Speed ramps into the drop; a zoom-blur or whip on 1–2 big moments.
- Flash transitions ≤3 per minute.

## Audio-reactive mapping (write a custom code component if needed)
- Kick → a scale pulse of 2–5%.
- Snare → brightness +5–10%.
- Loudness → glow intensity.
- Sections → palette changes.
- Always derive these from the analysis data, never from real-time randomness.

## Sound
- Don't remix or re-level the master.
- Fade only at the very start and end (0.5–1s).
- Keep the artist's loudness unless it clips.

## Accessibility
- No more than 3 flashes per second; avoid large saturated red flashes.
- Keep lyrics readable (contrast ≥4.5:1).

## Rights
Use only music the user owns or has licensed, and credit the artist and track in the end card or description.

## Banned
- Generic spectrum bars over a stock gradient.
- Pulsing on every frame; flashing more than 3 times per second.
- Lyric typos or desync.
- Lyrics over faces or busy highlights without a scrim.
- Copyrighted songs without the rights.
- Cutting the song mid-phrase.

## Self-check before finishing
- [ ] Cuts and hits are within ±1 frame of the beat markers, and words within ±2 frames.
- [ ] Every lyric has been checked against the official text.
- [ ] The flash rate is ≤3 per second and text contrast is ≥4.5:1.
- [ ] The clip starts and ends on musical phrases.
- [ ] Ran the self-review skill.
