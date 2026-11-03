---
name: sound-design
description: Load for any video that needs music or sound effects (almost all of them) and whenever audio feels wrong, to pick real music with search_audio, cut to its structure with detect_beats, place sound effects on real events, and set levels like a sound editor.
---

# Sound design: what a sound editor would do

Viewers forgive soft footage long before they forgive bad sound. The AI tell is sound that is generic, missing, or everywhere: a synthesized bleep for a camera, a whoosh on every cut, music chopped off mid-bar. Your job is to make every sound feel caused by the picture.

## Sources (in this order)
- **Music: compose it for the edit with `generate_music` when it's available** (the user has an ElevenLabs key). Give global styles and one section per part of the film with its exact length (intro → reveal → features → finale), so the music turns on your cuts and resolves on the last frame. Instrumental under a voice.
- **Otherwise a real track from `search_audio` (kind "music"), chosen for the style, not just the mood.** A jazzy, comedic or epic-orchestral cue under a minimal product film sounds wrong even if its mood tag matches. Kevin MacLeod's catalogue is the most recognisable library music on YouTube and reads as stock in a brand film; prefer other results when one fits. Search with mood + genre + instrument words ("uplifting electronic", "tense cinematic pulse", "warm acoustic", "lofi hip hop", "corporate piano"). Never build music from code or from sound effects.
- **Real-world sounds: `search_audio` (kind "sfx").** Anything that exists in the real world should be a recording: camera shutter, keyboard typing, mouse clicks, cash register, crowd, applause, door, footsteps, ocean, city, rain.
- **Built-in library (`add_clips` type "sfx"):** designed motion sounds where speed matters: whooshes, swooshes, whips, risers, impacts, sub drops, pops, ticks, UI clicks. Each has a described peak time.
- Import with `import_media({ url, name, license, credit })` so the credit line is kept (CC BY needs it in the description; the export panel lists it).
- Kevin MacLeod tracks can get YouTube Content ID claims on monetized uploads even with credit; the claim is released after a dispute citing the license. Mention it once when you use one.

## Music
1. **Choose by role before searching.** Write down the emotion (uplifting, tense, playful, epic, calm, nostalgic), the energy curve (steady, build to a drop, quiet → big), and whether a voice speaks. Under a voice: instrumental only, sparse mids, nothing with lyrics.
2. **Check fit.** Length ≥ the video or clear sections you can cut together; tempo that matches the edit (hype 120–150 BPM, explainer 90–115, emotional 60–90).
   - You can't hear the track, but detect_beats measures its `profile`: bass share, top-end brightness and dynamics, with tags. Viewers notice a low end that fights the style before anything else.
   - A bass-heavy track (over 40% of its energy in the lows) belongs to hype, sport, trailers and club edits. Under a voice, a calm explainer or a minimal product film it sounds muddy and cheap: pick another.
   - Keynote, brand and explainer films want a light low end and an airy or clear top. Quiet, intimate films want a dynamic track with room to breathe.
3. **Map the track: `detect_beats` on the asset.** It returns bpm, beats, downbeats, sections (intro/build/drop/high/mid/low/outro with energy) and hits.
4. **Fit it to the length with `fit_music` as soon as the length is known, before cutting picture to it.** It lands the track's own ending on the last frame and, when the track is too long or short, removes or repeats whole bars at the point where the music matches itself, with a crossfade on the downbeat. It returns the new downbeats, sections and hits on the timeline: cut to those. Call it again whenever the length changes; never trim, splice or fade the music clip by hand.
   - Read its `edit` match and `energy` note. A rough join (match under 0.75) or a fitted track that is mostly its quiet ending means another `startAtSec`, `ending: "fade"` (keeps the energetic body and fades from a bar line) or another track.
5. **Edit to the music, not on top of it:**
   - Cut on beats; change scenes on downbeats or section starts. Hype edits cut every 1–2 beats, launches every bar, explainers every 2–4 bars.
   - Land the hook on a strong downbeat in the first 2 s (trim a slow intro or start inside the track).
   - Put the main reveal or product shot on the first drop/high section; risers end on it.
   - Use quiet sections for setup and talking, high sections for montage and payoff.
   - End where the music resolves: on the track's final hit or the outro's last downbeat (fit_music does this). Land the end card on the last hit it reports. Never stop mid-bar or mid-word.
   - Never splice the music by hand (cutting its middle out with two clips): listeners hear a bad splice instantly, and critique_video flags one. fit_music finds the join that matches.
   - Cut picture to bars during builds and to beats only for payoffs; never cut on every beat for more than about 4 bars.
6. **Pulling music out for impact is a pro move that sounds broken when done loosely.** Listeners hear a gap as a fault unless it is exact:
   - Only when a voice line or one designed sound fills the gap.
   - End the music on a downbeat (or fade it over ≥ 0.5 s from a phrase end).
   - Keep the silence a whole number of beats (1–2).
   - Bring the same track back on a downbeat at the position it would have reached had it kept playing: the music was muted, not paused.
   - Never come back from a different part of the track after a gap: that is a splice.
   When unsure, keep the music continuous and dip it 6–10 dB under the key line with volume keyframes.

## Levels (people notice a loud effect before anything else)
- Start every sound effect at volume 0.15–0.25 against a music bed at 0.8–0.9, then adjust by ear. 0.35 or more is almost always too loud.
- A whoosh, click or pop should only just reach the music's level at its sharpest moment. A payoff hit (the logo, the reveal) may sit a little above.
- Ambience beds (fire, rain, crowd, room tone) sit well under the music, around 10 dB. Fade them in and out over half a second or more. Crackling or clicking beds need extra room: their sharp peaks poke through even when the average is low.
- critique_video measures this from the audio and names the effects that stick out, with the volume that would sit right: apply those numbers.

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
- Polished brand, launch and short-form: ≤ 6–8 SFX per minute. Live-action explainers and long-form: ≤ 12. High-energy meme edits: ≤ 20, and still one per real event.
- Animation is the exception: an illustrated or motion-graphics explainer is scored like a cartoon. Most visible motions get a small designed sound (a pop as a shape appears, a soft swish as something flies, a tick as a counter runs, a gentle swell into a reveal, a squeak when a character lands), 20–40 per minute, mixed low (0.1–0.2) so they add life without poking out. A silent animated world feels empty.
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
