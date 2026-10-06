---
name: sound-design
description: Load for any video that needs music or sound effects (almost all of them) and whenever audio feels wrong, to pick real music with search_audio, cut to its structure with detect_beats, place sound effects on real events, and set levels like a sound editor.
---

# Sound design: what a sound editor would do

Viewers forgive soft footage long before they forgive bad sound. The AI tell is sound that is generic, missing, or everywhere: a synthesized bleep for a camera, a whoosh on every cut, music chopped off mid-bar. Your job is to make every sound feel caused by the picture.

## Sources (in this order)
- **Music: always a real track from `search_audio` (kind "music").** Never synthesize music, build a "music" component, or fake a bed out of sound effects. Search with mood + genre + instrument words ("uplifting electronic", "tense cinematic pulse", "warm acoustic", "lofi hip hop", "corporate piano").
- **Real-world sounds: `search_audio` (kind "sfx").** Anything that exists in the real world should be a recording: camera shutter, keyboard typing, mouse clicks, cash register, crowd, applause, door, footsteps, ocean, city, rain.
- **Built-in library (`add_clips` type "sfx"):** designed motion sounds where speed matters: whooshes, swooshes, whips, risers, impacts, sub drops, pops, ticks, UI clicks. Each has a described peak time.
- Import with `import_media({ url, name, license, credit })` so the credit line is kept (CC BY needs it in the description; the export panel lists it).
- Kevin MacLeod tracks can get YouTube Content ID claims on monetized uploads even with credit; the claim is released after a dispute citing the license. Mention it once when you use one.

## Music
1. **Choose by role before searching.** Write down the emotion (uplifting, tense, playful, epic, calm, nostalgic), the energy curve (steady, build to a drop, quiet → big), and whether a voice speaks. Under a voice: instrumental only, sparse mids, nothing with lyrics.
2. **Check fit.** Length ≥ the video or clear sections you can cut together; tempo that matches the edit (hype 120–150 BPM, explainer 90–115, emotional 60–90).
3. **Map the track: `detect_beats` on the asset.** It returns bpm, beats, downbeats, sections (intro/build/drop/high/mid/low/outro with energy) and hits.
4. **Edit to the music, not on top of it:**
   - Cut on beats; change scenes on downbeats or section starts. Hype edits cut every 1–2 beats, launches every bar, explainers every 2–4 bars.
   - Land the hook on a strong downbeat in the first 2 s (trim a slow intro or start inside the track).
   - Put the main reveal or product shot on the first drop/high section; risers end on it.
   - Use quiet sections for setup and talking, high sections for montage and payoff.
   - End where the music resolves: on the track's final hit or the outro's last downbeat (cut the track's middle so its real ending lands on your end card). A fade-out only from a phrase end, and only when the track can't resolve in time. Never stop mid-bar or mid-word.
   - Cut picture to bars during builds and to beats only for payoffs; never cut on every beat for more than about 4 bars.
5. **Pull music out for impact:** dropping music for 1–2 beats before a key line or reveal makes it land harder than any SFX.

## Sound effects: map picture → sound
Only add a sound when something happens on screen.

| On screen | Sound | Placement / level |
|---|---|---|
| Hard cut between scenes | usually nothing (or let the music carry it) | — |
| Whip / push transition | whoosh or whip (built-in) | peak exactly on the cut; 0.5–0.7 |
| Zoom transition | swoosh into the cut, soft low hit after | peak on the cut; hit 0.4–0.6 |
| Flash / exposure hit | impact or camera flash | on the white frame; 0.6–0.8 |
| Glitch transition | glitch / static burst (search "glitch") | the glitch frames; 0.4–0.6 |
| Title or word slams in | impact, bass hit or boom | the frame it lands; 0.6–0.9 |
| Small UI element / sticker / card pops in | pop, tick or click | on the pop; 0.25–0.4 |
| Text typing on | keyboard typing (recorded) | trimmed to the typing; 0.3–0.5 |
| Photo, screenshot or "snapshot" appears | camera shutter (recorded) | on the frame it appears or flashes; 0.5–0.7 |
| Number counts up | soft ticks or one rising tone; cash register for money | ends on the final number; 0.3–0.5 |
| Success / done | ding or chime | 0.4–0.6 |
| Mouse clicks / taps in a UI demo | mouse click (recorded) | each visible click; 0.3–0.5 |
| Notification / message | notification sound | on appearance; 0.4 |
| Reveal after a build | riser ending on the reveal + impact on it | riser 1–2 s; impact 0.7–0.9 |
| Silent stock footage of a place | ambience bed: ocean, city, forest, crowd, rain | whole shot, fades 6–10 f; 0.15–0.3 |
| Slow motion moment | low whoosh into it, muffled music | 0.4 |
| Logo / end card | logo sting or impact on the lock-up, music resolves | 0.7 |
| Comedic beat (playful styles only) | record scratch, vine boom, boing | once or twice per video |

Stock footage is silent; a quiet ambience bed under location shots is the single biggest jump in realism.

## Timing
- Align the sound's transient or described peak with the event frame. Viewers notice sound more than 45 ms early or 125 ms late (ITU-R BT.1359): at 30 fps land it on the frame, at most 1 frame early or 2 late.
- A new scene's ambience or sound leads the picture cut by 0.5–1 s (J-cut); the old scene's sound can trail it (L-cut).
- Risers end exactly on the hit; whooshes peak exactly on the cut (check the built-in's peak time).
- Trim recorded SFX to the action (typing as long as the text types), with 2–4 f fades so nothing clicks.

## Restraint
- Polished brand, launch and short-form: ≤ 6–8 SFX per minute. Explainers and long-form: ≤ 12. High-energy meme edits: ≤ 20, and still one per real event.
- No whoosh on a hard cut, no ding on every text, no riser before every beat.
- At most voice + music + two effect or ambience layers at once (Murch's "2.5" rule: past that it turns into noise).
- One sound family per video: the same whoosh for the same kind of move. Variety comes from the music, not from random sounds.
- Leave silence before big moments.

## Levels (volume 1.0 = unity)
| Element | Volume |
|---|---|
| Voice / dialogue | 1.0 (the anchor) |
| Music under voice | 0.4–0.6 with duck: true (it then sits ~18–25 dB under the voice) |
| Music alone (no voice) | 0.8–1.0 |
| Impacts, risers | 0.6–0.9 |
| Whooshes, transitions | 0.45–0.7 |
| UI pops, ticks, clicks | 0.25–0.45 |
| Ambience beds | 0.15–0.3 |

Platforms play back at about −14 LUFS with peaks ≤ −1 dBTP; the export normalizes to that, so set the balance, not the loudness. No moment should jump far above the rest (a hit can, a whole section can't).

## Checklist
- [ ] Music is a real track that fits the mood and pace, mapped with detect_beats.
- [ ] Hook, scene changes and the reveal sit on downbeats / section starts; the ending resolves.
- [ ] Every SFX marks a visible event, peak within ±1 f, no early sounds.
- [ ] Real-world actions use recorded sounds; silent location footage has ambience.
- [ ] No moment has more than two sounds starting together; density fits the format.
- [ ] Voice is clear: music ducked under it.
- [ ] Credits kept for every CC BY asset.
