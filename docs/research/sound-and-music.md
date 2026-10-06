# Sound design and music for Reframer: research report

Date: 2026-10-06. Scope: (A) knowledge an AI editor can follow; (B) legal sources of real music and SFX it can search and import from code.
Unless marked otherwise, every API fact in section 7 was verified with live requests on 2026-10-06 (curl/Node from this machine). Book and essay ideas are paraphrased; URLs are in section 10.

---

## 0. TL;DR

1. **Sound is "added value" (Chion).** A sound that coincides with a visual event makes viewers believe the image itself made it (synchresis). So every SFX must be pinned to something visible. A sound with no visible event is just noise.
2. **Pick one palette per video**: one music track, one transition family, one UI family, one impact family. The same event always gets the same sound.
3. **Restraint (Murch's "2.5" rule):** voice + music + at most 2 SFX or ambience layers at once. Default budgets: explainers 4–10 SFX/min, launches 6–15, social ads 10–20, meme or retention shorts 15–30, and only when each sound marks an event.
4. **Timing:** put the transient (not the start of the file) on the event frame. Viewers notice sound more than 45 ms early or 125 ms late (ITU-R BT.1359). At 30 fps that is about 1 frame early or 3 frames late. A whoosh peaks on the cut; a riser ends on the hit; a new scene's ambience leads the cut by 0.5–1 s (J-cut).
5. **Levels:** deliver −14 LUFS integrated with true peak ≤ −1 dBTP for YouTube, TikTok, Reels and Spotify. Keep music under speech by at least 10 LU (research floor), and use 12–18 LU in practice. Keep ambience at least 15 LU under speech (Torcoli et al., JAES 2019).
6. **Music must be a real, licensed recording.** The agent must never synthesize a "music bed".
7. **Programmatic and commercially safe:**
   - **Openverse** needs no key and serves Freesound SFX, Jamendo music and Wikimedia audio.
   - **Incompetech `pieces.json`** lists 1,443 Kevin MacLeod tracks with BPM, mood and instrument metadata under CC BY 4.0, with direct MP3 links.
   - **Kenney** packs are CC0 and can be bundled with the app.
   - The **Freesound API** needs a free key, so users would bring their own.
8. **Not programmatic:**
   - Pixabay audio has no API, and its terms ban scraping.
   - Mixkit has no API, and its license forbids redistribution "in a tool".
   - YouTube Audio Library: YouTube's terms ban automated access and downloading unless YouTube authorizes it.
   - Free Music Archive shut its API down.
   - Sonniss forbids redistribution, including inside software. Users can still point Reframer at their own local copy.
9. **Licenses that are safe for a creator's commercial video:** CC0, Public Domain Mark and CC BY (with credit). Avoid:
   - **BY-SA**: share-alike spreads to the whole video.
   - **Any ND**: syncing music to picture legally counts as an adaptation.
   - **Any NC**: no commercial use.
10. **Bugs found in the uncommitted `src/server/audio-library.ts`** (section 8):
    - It sends `page_size` up to 40, but Openverse returns **HTTP 401 for anonymous `page_size` > 20**. With the default `limit` of 10, every music search fails.
    - `ccmixter` is no longer an Openverse source.
    - The archive.org Kevin MacLeod mirror has about half the catalog and is mislabelled CC0. The official `pieces.json` is better.

---

## 1. Principles from the authorities, as rules

### 1.1 Michel Chion, *Audio-Vision* (1990/1994)
- **Synchresis.** A sound and an image that happen at the same instant fuse in the mind automatically, whether or not it is logical. This is why a synthetic "pop" makes a text box feel physical.
  - *Rule:* sync only events you want to feel physical. The sync point is the frame where the event completes: it lands, stops, appears or is struck.
- **Added value.** Viewers credit the image with meaning the sound brought.
  - *Rule:* choose a sound for its meaning, not its literal source: cash register = money, shutter = a captured moment, ding = correct or done, whoosh = speed.
- **Rendering, not reproduction.** Audiences judge a sound "true" when it conveys the sensation (weight, speed, size), not when it is acoustically accurate. Movie punches are louder than real ones.
  - *Rule:* exaggerate weight on impacts, and give motion a sound even when it makes no real noise (a slide gets a swoosh).
- **Empathetic vs anempathetic sound.** Music either follows the scene's emotion or ignores it (cheerful music over chaos). Ignoring it reads as irony.
  - *Rule:* default to empathetic. Use anempathetic only on purpose, for irony or comedy.
- **Synch points and vectorization.** Synch points punctuate the audiovisual "phrase", and sound gives images direction in time: a riser creates expectation.
  - *Rule:* every build needs a payoff. Never place a riser that resolves into nothing.

### 1.2 Walter Murch (*In the Blink of an Eye*; "Dense Clarity, Clear Density")
- **The encoded–embodied spectrum.** Speech is "encoded" (language, at the violet end), music is "embodied" (at the red end), and sound effects sit in between. When sounds spread across the spectrum, about 5 layers stay clear. When they cluster in one "color", the limit drops to about **2.5**.
  - Murch's example: one or two robots' footsteps had to be in sync, but with three the audience stopped tracking individuals.
  - *Rule:* at any instant, voice + music + ≤2 SFX/ambience layers, and never 3 similar sounds together (for example, three whooshes).
- **Sacrifice.** To add an element you must take one away. When dialogue needs clarity, music is the sacrificial victim.
  - *Rule:* speech always wins. Duck or drop the music, and move SFX off stressed words.
- **Density needs variety.** A constantly dense track is as tiring as a constantly loud one.
  - *Rule:* plan "breaths", meaning sections with a single element.
- **Worldizing.** Murch re-recorded music played through speakers in real spaces so it sounded as if it existed in the scene (*American Graffiti*).
  - *Reframer analog:* for in-scene music (a phone, TV or party), apply a low-pass filter, a small room reverb and a lower level.
- **Rule of Six.** In order of priority, a cut must serve emotion, story, rhythm, eye-trace, the 2D plane and 3D space. In practice: emotional fit beats technical neatness.

### 1.3 Randy Thom, "Designing a Movie for Sound"
- Sound needs openings. Wall-to-wall dialogue or music leaves sound nothing to do, and characters (and viewers) need moments to *listen*.
  - *Rule:* leave gaps in the voiceover for featured sound.
- The great sound sequences are point-of-view sequences: sound filtered through a character's perception.
  - *Rule:* sound POV effects (a muffled, underwater feel, ringing after a blast) only make sense with a POV visual.
- **Starve the eye to feed the ear.** Darkness, ambiguity, extreme close-ups and slow motion pull the ear in.
  - *Rule:* slow motion, close-ups and black frames are where featured sound belongs.
- Show a sound source once, and it can then live off-screen at low level.

### 1.4 Ric Viers, *The Sound Effects Bible*
- **Categories:**
  - hard effects (synced to an action);
  - Foley (a body handling objects, footsteps, cloth);
  - backgrounds or ambience (room tone, beds);
  - designed sounds.
  - *Rule:* any real-footage or dialogue video needs a background layer. Digital silence under dialogue reads as a broken soundtrack (see the Room tone article on Wikipedia).
- **Layering makes size.** A hero hit is a transient plus a body plus a sub layer. But one right sound beats a stack of mediocre ones.
- **Organize by category with descriptive names.** This applies directly to Reframer's `SFX_LIBRARY` tags.

### 1.5 David Sonnenschein, *Sound Design: The Expressive Power of Music, Voice and Sound Effects in Cinema*
- **Listening modes:** causal (what made the sound), semantic (what it means) and reduced (its pure qualities).
  - *Rule:* use causal, recognizable sounds (shutter, click, cash) to explain, and abstract ones (swoosh, riser, glitch) for stylized motion graphics.
- **Entrainment.** Rhythm and tempo drive arousal and perceived pace.
  - *Rule:* tempo is the first lever for energy (section 6).
- **Figure and ground, and masking.** One sound is the figure and the rest is ground. Sounds in the same frequency range hide each other.
  - *Rule:* during speech, keep SFX and music out of the voice's presence range.
- **Silence** is a compositional tool, not an absence.

### 1.6 Modern creator, ad and trailer practice
- **Grammar:**
  - whoosh = movement;
  - riser = anticipation;
  - hit or boom = arrival and emphasis;
  - pop or click = UI or element appearance;
  - sub-drop = weight under a cut or title.
  - "Whoosh into hit" fits anything that travels and then stops (Epidemic Sound, trailer sound-design guides).
- **Sound the payoff, not every motion** (Sonilo):
  - Don't add an effect just because a transition exists.
  - Don't stack hits on accents the music already sells.
  - Protect speech first.
- **Trailers come in escalating waves.** A held frame of silence before the final hit often reads bigger than the hit itself (trailer sound-design guides). Derek Lieu: every sound must have a purpose, and title-card slams come first.
- **Mickey-mousing** (music imitating every action) is considered a cliché outside comedy and parody (Wikipedia).
- **Sync mechanics** (Morphic): align the waveform's transient, not the clip's leading silence. "A hair early" beats late, within the limits in section 3.

---

## 2. Visual event → sound table

Built-in ids are from `src/core/sfx.ts`. "Search:" means a real recording through `search_audio` / Openverse (`source=freesound`, `license=cc0,pdm,by`).

The level tier is Reframer's linear `volume` for built-in files, which are peak-normalized to −1 dBFS:

| Tier | Volume | Peak level |
|---|---|---|
| **S** (subtle) | 0.15–0.3 | ≈ −17 to −11 dBFS |
| **M** (medium) | 0.3–0.5 | ≈ −11 to −7 dBFS |
| **A** (accent) | 0.5–0.8 | ≈ −7 to −3 dBFS |
| **H** (hero) | 0.8–1.0 | Only in music-only moments, and relies on the export limiter |

Under speech, stay in S–M (section 5).

### 2.1 Text and titles
| Visual event | Sound | Sync point / timing | Tier | Notes / avoid |
|---|---|---|---|---|
| Headline/title pops in (scale with overshoot) | `pop` (playful) or `swoosh` (clean); premium/keynote: often none | First visible frame, or the overshoot peak (±1 f) | S–M | One sound per title, never per word |
| Title slam (big type hits) | `impact` (+ `sub-drop` under) or `bass-hit` on a beat | Transient on the landing frame; optional `whoosh-fast` peaking 1–2 f before | A–H | ≤1 per 10–15 s; pair with shake ≤6 px, ≤6 f |
| Typewriter text | `typewriter` once per character | Each strike on its character's first frame | S | Only up to ~12 chars/s; faster text → `typing` burst |
| Typing into a UI field / search / chat | `typing`, trimmed or looped to the typing span | First char → last char; Enter = `click` | S | Stop exactly when typing stops |
| Word-by-word captions (shorts) | None; `pop`/`tick` on ≤3 key words per sentence | Word appears | S | SFX on every word = noise; the voice is the rhythm |
| Lower third / label / callout slides in | `swoosh` or `whoosh-fast` | Peak where the move settles | S | Skip in calm interviews |
| Highlight / underline / circle annotation | Search "marker scribble", "pen stroke"; or none | Stroke start | S | — |
| Strike-through / "wrong" | `record-scratch` (comedy), short `glitch` (tech) | Strike frame | S–M | Meme and comedy styles only |
| Quote card / document / note | `paper` | Landing (peak at ~0.15 s) | S | — |

### 2.2 Numbers, money, data
| Visual event | Sound | Sync point / timing | Tier | Notes / avoid |
|---|---|---|---|---|
| Counter counting up | Quiet `tick` roll (one tick every 2–3 f, fading), or `riser-short`; then `ding` (positive) / `cash` (money) / `impact` (huge) | Roll spans the count; the final sound lands on the frame the final value locks | S roll, M final | Never one tick per integer at >10 Hz; one roll per counter |
| Big stat lands | `bass-hit` or `impact` (hero), `ding` (positive) | Landing frame | M–A | 1–2 hero stats per video |
| Price / revenue / sale | `cash` | The "ka" transient on the reveal frame | M | Once per money moment, not on every number |
| Bars grow (one move) | One `swoosh`/`whoosh` or `riser-short` for the whole chart; `pop` on the key label | Whoosh peak mid-growth; pop on the label | S | One sound per chart unless bars stagger ≥0.3 s apart (then a quiet `tick` per bar) |
| Line draws / graph rises | `riser-short` ending at the key point; `slide-whistle-up` only for comedy | Riser ends where the line hits the point | S–M | — |
| Pie / donut fills | `swoosh` | Fill end | S | — |
| Checklist items appear | `tick` or `click` per item (≥0.25 s apart); `ding` on the last | Item appears | S | Alternate 2 variants or ±2 dB |
| Countdown / timer | `tick` per digit; `impact` or `ding` at zero | Digit change | S, then M | — |
| Map pin drop / location | `pop` or `tap`; the zoom-to gets `whoosh` | Pin lands | S | — |

### 2.3 Images, capture, UI demos
| Visual event | Sound | Sync point / timing | Tier | Notes / avoid |
|---|---|---|---|---|
| Photo taken / camera flash / polaroid / freeze-capture | `shutter` + a 2–4 f white flash | First click on the flash frame | M | Only when the visual implies capture; not for every image |
| Screenshot / image card appears | `swoosh` (slide in), `pop` (scale in), `paper` (document) | Landing | S | — |
| Before/after flip | `switch` | Flip frame | S | — |
| Punch-in zoom on a detail | `whoosh-fast` or none | End of the push | S | — |
| Cursor click / button press | `click` | Frame the button changes state | S (0.15–0.3) | No sound for cursor moves or scrolling |
| Phone tap | `tap` | Contact | S | — |
| Toggle / mode change | `switch` | State change | S | — |
| Notification / message / toast | `chime` (message), `ding` (alert) | First visible frame of the toast | S–M | Same sound for the same notification type all video long |
| Success / check mark / complete | `ding` (or `chime`) | Check completes | S–M | — |
| Error / denied | `glitch` trimmed to ~0.2 s; search "error buzz UI" | Error state appears | S–M | — |
| Loading → result | None during loading; `riser-short` into the result | Riser ends on the result | S | — |
| App window / device appears | `swoosh` or `whoosh` | Landing | S | — |
| Emoji / sticker / like-heart pops | `pop` | Scale-in peak | S | — |

### 2.4 Reveals, branding, endings
| Visual event | Sound | Sync point / timing | Tier | Notes / avoid |
|---|---|---|---|---|
| Product reveal (hero) | `riser` (1–2 bars) → `impact` (bold) or `boom`, + `sparkle` (premium shine) | Riser's last frame = reveal frame = impact transient | A–H | If the music drops on the reveal, add only a `sub-drop` (don't double the hit) |
| Logo sting / lockup | `whoosh` peaking at the lockup + `impact` (bold) or `chime`/`sparkle` (friendly); or a real sting (Incompetech "Stings" genre, Kenney "Music Jingles") | Hit on the lockup frame | M–A | 1.5–3 s total; the music should resolve on the same frame |
| End card / CTA | The music's final downbeat or ring-out; optional `pop`/`click` on the CTA button | End card | S | No new big hits after the logo; let the tail ring 1–3 s |
| Sparkle / shine / magic highlight | `sparkle` | Shine passes mid-object | S–M | — |

### 2.5 Transitions
| Transition | Sound | Sync point | Tier | Notes / avoid |
|---|---|---|---|---|
| Hard cut | Nothing | — | — | The default; the music carries rhythm |
| Cut on a musical beat | Nothing extra | Cut on the beat or a few frames off | — | Don't double the beat with a hit |
| Whip pan / smash | `whip` | Center (0.12 s) on the cut | M | — |
| Zoom transition in/out | `whoosh` | Peak on the cut | M | — |
| Push / slide transition | `whoosh-fast` / `swoosh` | Peak at max velocity (usually the cut) | S–M | — |
| Glitch / digital | `glitch` | Centered on the cut, 0.2–0.6 s | M | One transition language per video |
| VHS / channel change | `static` | Centered on the cut | M | — |
| Flash / dip to white | `impact` or `boom` (+ `shutter` if photographic), optional `sub-drop` | Brightest frame | A | — |
| Dip to black / chapter change | Often nothing; or `sub-drop`/low `boom` where the music phrase ends | Fade-out start | S–M | Silence is usually stronger |
| Light leak / film burn | Soft `whoosh` or nothing | — | S | — |
| Speed ramp | `whoosh-fast` into `bass-hit` | Ramp peak | M | — |

### 2.6 Story, mood, comedy
| Visual event | Sound | Sync point / timing | Tier | Notes / avoid |
|---|---|---|---|---|
| Scene / location change | The new place's ambience (search "city street ambience", "office room tone", "cafe ambience", "forest birds ambience") | Starts 0.5–1 s before the cut (J-cut); outgoing ambience trails 0.3–1 s (L-cut) | ≥15 LU under speech | Crossfade ambiences 0.5–1 s; never digital silence under dialogue |
| Slow motion | `boom` or `sub-drop` at the onset; muffle or duck the music (low-pass); optional heartbeat (search); `whoosh` back to real time | Slow-mo onset | A | Thom: slow motion invites featured sound |
| Freeze frame, comedic ("yep, that's me") | `record-scratch` + music stops | Scratch and music cut on the freeze frame | M | — |
| Freeze frame, photographic | `shutter` + flash | Freeze frame | M | — |
| Punchline / reaction zoom | `vine-boom` (meme), `boing` (bounce), `slide-whistle-up` (flies up) | 2–6 f after the visual beat lands; never over the punchline words | M–A | Meme styles only; ≤3–4 comic stings per 30 s |
| Awkward pause | Drop the music to silence or room tone; search "crickets" | After the line | — | — |
| Fail / letdown | Search "sad trombone" (not built in) | 0.3–0.5 s after the fail | M | — |
| Tension build / suspense | `riser` + low drone (search "dark drone ambience"), or the music's own build | Ends on the payoff | M | Every build needs a payoff |
| Fast montage | Music only; at most a `whoosh` in and a hit at the end | — | — | Don't sound every cut |
| Talking head with no music | Continuous room tone or ambience bed | — | ≥15 LU under speech | Replaces dead air after silence removal |

---

## 3. Timing

### 3.1 What viewers can perceive
**ITU-R BT.1359 (1998).** Subjective tests in Japan, Switzerland and Australia found the following thresholds (positive = sound early):

| Threshold | Sound early | Sound late |
|---|---|---|
| Detectable | +45 ms | −125 ms |
| Acceptable | +90 ms | −185 ms |

The undetectable plateau in its Figure 1 runs from roughly 90 ms late to 20 ms early. Vision normally arrives before sound in real life, so late sound is tolerated more. Research on the point of subjective simultaneity agrees: simultaneity feels maximal when vision leads slightly.

Frame durations:

| Frame rate | 1 frame |
|---|---|
| 24 fps | 41.7 ms |
| 25 fps | 40 ms |
| 30 fps | 33.3 ms |
| 60 fps | 16.7 ms |

**So, at 30 fps:**
- Aim the transient at the event frame.
- 1 frame early (33 ms) is below detectability, and practitioners say "a hair early" reads crisp.
- 2+ frames early is visibly early.
- 1–2 frames late is invisible; 4+ frames late is visibly late.

### 3.2 Placement recipes
- **Hard-sync sounds** (click, tap, pop, shutter, cash, impact, bass-hit, vine-boom, tick): align the transient, not the file start. Built-in hits land on their first frame, so `startSec = eventSec`.
- **Peaked sounds** (`startSec = eventSec − peakOffset`). Built-in peak offsets:

  | Sound | Peak offset |
  |---|---|
  | `whoosh` | 0.45 s |
  | `whoosh-fast` | 0.19 s |
  | `swoosh` | 0.17 s |
  | `whip` | 0.12 s |
  | `braam` | 0.2 s |
  | `paper` | 0.15 s |
- **Whoosh into hit:** the whoosh peaks 0–2 f before the landing; the hit lands on the landing frame.
- **Risers:**
  - They end exactly on the hit or cut. The built-in `riser` (2.0 s) and `riser-short` (1.0 s) peak on their last frame, so `start = hit − duration`.
  - Musical length: 1–2 bars, where one 4/4 bar = 240/BPM seconds (2 s at 120 BPM).
  - Without music: 1–3 s.
  - Never let a riser run past its payoff, and never place one without a payoff.
- **Pre-hit silence:** for the single biggest reveal, dip everything (music and ambience) to near-silence for 4–12 f before the hit. Trailers use this. Do it once or twice per video at most.
- **Tails:** let reverb and boom tails ring across cuts, and never chop a tail mid-decay. If a tail masks the first word of a line, fade it over 3–10 f or choose a shorter sound.
- **J/L-cuts:**
  - The next scene's ambience, music or voice may lead the picture by 0.5–1 s (15–30 f at 30 fps). This is the J-cut, also called audio lead.
  - Outgoing sound may trail 0.3–1 s (L-cut).
- **Typing:** the sound starts with the first character and ends with the last. Per-character strikes only up to ~12 chars/s (one every ≥2.5 f at 30 fps).
- **Comedy:** let the visual beat register, then the sting 2–6 f later. For "awkward" beats, hold 1–2 s of silence. Never put the sting over the punchline words.
- **Music cuts:**
  - Cut picture on downbeats, or "a few frames before or after" a musical change for an organic feel (PremiumBeat).
  - Frames per beat = fps × 60 / BPM. At 30 fps: 100 BPM = 18 f, 120 BPM = 15 f, 128 BPM = 14.06 f.
  - When the result isn't a whole number, round each beat independently from its exact time (`beat_i × fps`), not by accumulating rounded steps.

---

## 4. Density and restraint

- **Murch's 2.5 rule:** never more than about 2.5 same-family layers. Across speech + music + effects, about 5 layers stay clear.
- **One hero sound per moment.** A support layer is allowed only to add weight: whoosh + impact, impact + sub-drop, riser + impact. Reframer's lint already warns when 3 SFX start within 2 frames (`sfx-stacked`), when more than 5 fall within 4 s (`sfx-busy`), and above 0.6 SFX/s (`sfx-everywhere`).
- **Budgets.** Synthesized from the guides and the existing house rule (motion-taste: 4–12/min); a style's `sfxPerMin` overrides:

  | Format | SFX per minute |
  |---|---|
  | Explainer / tutorial / screen demo | 4–10 |
  | Product launch / keynote | 6–15, mostly reveals and titles |
  | Social ad (6–30 s) | 10–20 |
  | Meme / retention short | 15–30, only if each marks a visible event |
  | Trailer | Escalating: sparse in act 1, dense in the finale |
- **Hero sounds** (impact, boom, braam, bass-hit, sub-drop, vine-boom): ≤1 per 10–15 s and ≤3 per minute outside a finale.
- **Don't double the music.** When a cut or reveal sits on a strong beat or drop, the music is the accent: skip the hit, or add only a sub-drop.
- **Never on a stressed word.** Move the SFX into the gap, shorten its tail, or drop it (Sonilo).
- **Don't sound meaningless transitions.** Transitions are already ≤25% of cuts in motion-taste. Repeated whooshes make a calm tutorial feel rushed.
- **Repetition:** the same event gets the same sound, but for back-to-back repeats alternate 2 variants or shift ±2 dB or ±1 semitone, so it doesn't machine-gun.
- **Palette consistency:** one transition family (for example `whoosh`/`whoosh-fast`), one UI family (`click`/`tap`/`pop`), one impact family (`impact`/`sub-drop`), and one music track (two at most for videos over 2 min). This is a "sonic logo" discipline.
- **Silence and space:**
  - Give at least one "breath" every 30–60 s: only music, or only voice.
  - Use pre-hit silence for the biggest moment.
  - A sudden music pause grabs attention, so use it for a reveal (Vidyard).
  - A monotonously dense track is fatiguing (Murch).
- **Test** (Sonilo): play the opening and the busiest section without looking at the timeline. If the mix keeps pulling attention from the subject, remove effects before adding any.

---

## 5. Levels and loudness

### 5.1 Delivery targets
| Destination | Integrated loudness | True peak | Notes | Source |
|---|---|---|---|---|
| YouTube | ≈ −14 LUFS reference | ≤ −1 dBTP | Turns loud content down, never up ("content loudness" in Stats for nerds) | loudnesspenalty.com; productionadvice.co.uk |
| Spotify | −14 LUFS (Normal); −11 Loud; −19 Quiet | ≤ −1 dBTP; ≤ −2 dBTP if the master is louder than −14 | — | Spotify for Artists |
| TikTok / Instagram Reels | No published spec; community measurements ≈ −14 LUFS | ≤ −1 dBTP | Deliver −14 | Third-party guides (unofficial) |
| Apple Podcasts | −16 LKFS ±1 dB | ≤ −1 dBFS true peak | — | Apple Podcasts for Creators |
| AES TD1008 (streaming) | Music −16 LUFS; speech −18 LUFS | — | Recommendation; most services still use −14 | AES / productionadvice |
| EBU R128 broadcast | −23 LUFS ±0.5 LU (±1 LU live) | ≤ −1 dBTP | — | EBU |
| EBU R128 s1 (ads/promos ≤ ~2 min) | −23 LUFS | ≤ −1 dBTP | **Max short-term loudness −18 LUFS (= +5 LU)** | EBU R128 s1 (2020) |
| Netflix | −27 LKFS ±2 LU, dialog-gated | ≤ −2 dBTP | — | Netflix spec (via Production Expert) |

YouTube upload audio: AAC-LC or Opus, 48 kHz, stereo at 384 kbps (YouTube Help).

**Default for Reframer:** −14 LUFS integrated, ≤ −1 dBTP, 48 kHz. Offer −16 LUFS (podcasts and long-form) and −23 LUFS (broadcast) presets.

### 5.2 Relationships inside the mix
| Element | Target | Practitioner dBFS rules of thumb |
|---|---|---|
| Speech (VO / dialogue) | Anchor of the mix: −16 to −14 LUFS short-term for social | Peaks −6 to −12 dBFS (Larry Jordan); −12 to −15 average (PremiumBeat) |
| Music under speech | **≥10 LU below speech** (Torcoli et al.: ≥10 LU for commentary over music). Non-experts preferred ~4 LU *more* separation than experts, so use **12–18 LU** | −18 to −24 dBFS (Larry Jordan / PremiumBeat); Epidemic Sound goes as low as −30 to −35 dB |
| Ambience / room tone under speech | **≥15 LU below speech** (Torcoli et al.) | −20 dB or lower (Krotos) |
| Music alone (no speech) | Close to the program loudness (−14 to −16 LUFS short-term) | About −10 dBFS peaks |
| SFX under speech | Short; never louder than the voice; keep out of words | −12 to −18 dBFS (Larry Jordan); −10 to −20 with occasional −8 (PremiumBeat) |
| SFX hero hits (music-only moments) | Short-term loudness ≤ program + 5 LU (EBU R128 s1) | Peaks up to about −3 dBFS before the limiter |
| Master | −14 LUFS integrated; true peak ≤ −1 dBTP | Mix peaks around −6 dBFS before the final limiter |

Broadcast and streaming bodies now use speech-to-background loudness difference (SBLD). The UK DPP and older Netflix guidance cite a minimum of 4 LU (arXiv 2405.17364). That is a floor for drama, not a target for VO-over-music. Torcoli's ducking study is the better guide for music beds.

### 5.3 Ducking music under voice
- **Depth:** 12–18 dB, or loudness-aware: enough to reach 12–18 LU separation. Premiere's auto-duck default is −18 dB with ~0.75 s fades (Larry Jordan).
- **Envelope** (offline, so it can look ahead using transcript word times):
  - Start ramping down 0.2–0.3 s before the first word (6–9 f).
  - Ramp back up over 0.5–1.0 s after the phrase ends.
  - **Stay ducked across pauses shorter than ~1.2 s** to avoid pumping.
- **Compressor style** (live sidechain): attack 10–30 ms, release 250–500 ms, ratio 2:1–4:1. Gain reduction beyond about 5–6 dB becomes audible, so make big depth changes with automation instead (iZotope; sidechain guides).
- **Spectral room:** under speech, dip the music 2–4 dB around 1–4 kHz, the speech-intelligibility band (iZotope). Avoid busy melodic leads in that range: violin, guitar leads, mid piano, vocals (Vidyard).
- **Music-only intros:** music at full level, then dip as speech begins. In long-form, a 2–5 s music-only open is common. In short-form, start the speech within 1 s.

### 5.4 Fades and edits
- **Music fade-in:**
  - None when it starts on a downbeat at frame 0 (a 2–5 ms micro-fade avoids clicks).
  - Otherwise 0.5–1.5 s; up to 1–3 s for ambient pieces (Sonilo).
- **Music fade-out:** 1–2 s for energetic pieces, 3–5 s for reflective ones (Sonilo). It's better to **backtime the real ending** onto the end card, cutting into the ending at a matching downbeat (PremiumBeat).
- **Crossfade between two songs:** 2–4 s on a phrase boundary (Sonilo), or a hard cut on a downbeat hidden under a transition hit.
- **Internal music edits:** cut on a transient or in the "valley" just before it, with a 10–30 ms crossfade. Ambient or beatless pads need ~0.5 s (Film Editing Pro: 15 frames).
- **Every audio clip edge:** a 2–5 ms micro-fade to avoid clicks.

### 5.5 Mapping to Reframer `volume` (linear gain, 0–2)
dB = 20·log10(v): v = 1.0 → 0 dB, 0.7 → −3.1, 0.5 → −6, 0.35 → −9.1, 0.25 → −12, 0.18 → −14.9, 0.125 → −18, 0.1 → −20.

**When `asset.analysis.loudness` (LUFS) is known:** v = 10^((target − loudness)/20), clamped to 0–2. Example: a music master at −9 LUFS that should sit at −16 LUFS alone gets v = 10^(−7/20) ≈ 0.45.

**Why the current default under-separates:**
- Default music volume is 0.6 (−4.4 dB) and the renderer's fixed duck is 0.28 (−11 dB).
- A typical commercial music master (≈ −9 to −12 LUFS) therefore ends up around −24 to −28 LUFS under the voice.
- That is only about 9–13 LU below a −15 LUFS voice: borderline against the 10 LU research floor, and below what general audiences prefer.
- A loudness-aware duck fixes this.

---

## 6. Music: selection and editing

### 6.1 Selection rules
1. **Function first.** Decide what the music must do (pace, emotion, brand), then the tempo, then the instrumentation, then the license.
2. **Only instrumental tracks under speech.** No lead vocals and no busy mid-range melody.
3. **Match tempo to edit pace.** Artlist's tempo bands:

   | Band | BPM |
   |---|---|
   | Slow | 20–70 |
   | Medium-slow | 70–90 |
   | Medium | 90–110 |
   | Medium-fast ("lively, exciting") | 110–130 |
   | Fast | 130–200 |

   Tempo alone doesn't fix the mood: fast can be happy or scary.
4. **Prefer tracks with a clear structure** (intro, build, drop or high, outro). Reframer's `detect_beats` returns sections and energy.
5. **Duration:** prefer tracks at least as long as the video, so you shorten rather than loop.
6. **One track per short.** For longer videos, change track at chapter boundaries, with at most one change per chapter.

### 6.2 By video type
Search words match Incompetech's `feel` tags (Dark, Grooving, Relaxed, Bright, Calming, Bouncy, Driving, Mysterious, Intense, Eerie, Unnerving, Somber, Mystical, Uplifting, Humorous, Epic, Action, Suspenseful, Aggressive) and Jamendo tags (for example "corporate", "filmscore", "instrumental", "speed_high").

| Video type | Feel / genre | BPM | Arrangement and editing | Under VO |
|---|---|---|---|---|
| Product launch / keynote | Bright, Uplifting, Driving; minimal electronic, ambient pop, cinematic | 100–124 | Build → drop on the reveal; music-only stretches carry the film | Duck 12–15 |
| Social ad (6–30 s) | Bright, Bouncy, Grooving; pop, hip-hop, house | 110–130 | Hook in the first second; cuts on downbeats; end on a sting | Duck 10–14 |
| Explainer / tutorial / screen demo | Calming, Relaxed, Bright; lo-fi, marimba, soft acoustic | 85–110 | Simple, repetitive, no lead melody | Bed 15–18 LU under; none during dense steps |
| Vlog / lifestyle | Grooving, Relaxed, Bright; lo-fi hip-hop, indie, acoustic | 80–110 | New section or track per segment | Duck 12–16 |
| Trailer / hype / teaser | Epic, Intense, Suspenseful, Dark; hybrid orchestral, pulses | 120–140 (often half-time feel) | Three escalating waves; hits on title cards; silence before the last hit | Mostly no VO |
| Testimonial / interview / corporate | Uplifting, Calming; piano, soft strings, ambient guitar | 70–100 | Drop out under the key emotional line | 18+ LU under |
| Data story / tech | Mysterious, Driving; minimal electronic, arpeggios | 100–120 | Leave space for numbers | Duck 14–16 |
| Comedy / meme | Humorous, Bouncy; pizzicato, bassoon, ukulele (e.g. MacLeod "Sneaky Snitch", 87 BPM) | 90–130 | The music may stop for jokes (`record-scratch`) | Duck 12–15 |
| Emotional / story / charity | Somber → Uplifting; piano, strings | 60–85 | One climax; silence for the key line | 15–18 LU under |
| Sports / fitness / montage | Driving, Aggressive, Action; rock, EDM, trap | 120–150 | Cut on downbeats, drops on highlights | Usually no VO |
| Horror / mystery / true crime | Eerie, Unnerving, Suspenseful, Dark; drones, textures | No pulse–90 | Silence is a tool | 15–18 LU under |
| Kids / education | Bright, Bouncy, Humorous; xylophone, ukulele | 100–130 | — | Duck 12–15 |
| Travel / real estate | Uplifting, Bright, Calming; acoustic, indie, ambient | 90–115 | Add location ambience under the music | Duck 12–16 |

**Edit pace vs BPM:**
- Calm: one cut per bar (2 s at 120 BPM).
- Energetic: every 2 beats.
- Hype: every beat, sparingly.
- Break the pattern regularly so it doesn't feel mechanical (Artlist). Over-cutting to the beat turns a film into a music video (PremiumBeat).
- Motion-taste's average shot lengths already align: hype 0.5–1.5 s, launch 1.5–3 s, explainer 3–6 s.

### 6.3 Editing music to picture
1. `detect_beats` (with `addMarkers`) returns BPM, beats, downbeats, sections with energy, and hits.
2. **Start** the music on a phrase start (the downbeat of bar 1 of a 4- or 8-bar phrase), or on the intro.
3. **Shorten** by removing whole 4- or 8-bar phrases between sections that sound alike (cutting a repeated chorus in half is common: Soundstripe). Splice on a downbeat with a 10–30 ms crossfade, or slip the edit point mid-bar until it sounds seamless (Film Editing Pro: the snare backbeat is a reliable cut point).
4. **End** by backtiming:
   - Place the track's real ending (final hit or ring-out) on the end card.
   - Find the matching downbeat in the body and crossfade.
   - If impossible, fade 1–5 s finishing on a downbeat.
   - Never stop mid-bar (Reframer lint: `music-hard-stop`).
5. **Loop** only whole bars (4, 8 or 16), spliced at downbeats, avoiding sections with fills or vocals. The total must be a whole number of bars.
6. **Build to the climax:**
   - Map the video's arc onto the energy sections.
   - Increase the cut rate during the build.
   - Pull the music out (low-pass or silence) 4–12 f before the drop.
   - Land the hero reveal on the drop's first downbeat.
7. **Stingers:** for logo, chapter and end beats, use a short sting: Incompetech genre 23 "Stings" (25 pieces), or Kenney "Music Jingles" (85 CC0 jingles).
8. **Never two musics at once.** Not two tracks (except a 2–4 s crossfade), and no score over footage that already contains music.
9. **When NOT to use music:**
   - Dense instructional speech: none, or a very low bed.
   - The key line of emotional testimony.
   - Natural-sound moments: crowd roar, product sounds, ASMR.
   - Deadpan comedy beats.
   - Scenes with diegetic music.
   - Anything whose license can't be verified.
   - Murch's principle: music is the first thing to sacrifice for clarity. Thom: wall-to-wall music leaves sound design no room.

---

## 7. Sources usable from code

### 7.1 Summary table
| Source | Content | Access (verified) | Auth / limits | License for creators' commercial videos | Direct file? | Verdict |
|---|---|---|---|---|---|---|
| **Openverse** | Freesound SFX (591,897), Jamendo music (644,708), Wikimedia audio (3,980,632) per `/v1/audio/stats/` | `GET https://api.openverse.org/v1/audio/` | None. Anonymous: **20 req/min burst, 200 req/day sustained** (response headers), **page_size ≤ 20**, **depth ≤ 240 results**; OAuth2 client credentials give slightly higher limits and larger pages | Per item; filter `license=cc0,pdm,by` | Yes: Freesound preview MP3 (CDN), Jamendo `prod-1.storage.jamendo.com`, `upload.wikimedia.org` (all returned 206) | **Primary, keyless.** Must attribute, show a "powered by Openverse, not endorsed" notice, and not scrape |
| **Freesound API v2** | ~600k sounds (591,897 indexed by Openverse) with rich filters (duration, BPM, rating, descriptors) | `GET https://freesound.org/apiv2/search/?query=…&token=KEY` (replaces the deprecated text-search endpoint, Nov 2025) | Free API key (`/apiv2/apply`); 60 req/min, 2,000/day; downloads 30/min, 500/day; originals need OAuth2 | "Creative Commons 0", "Attribution", "Attribution NonCommercial" per sound | Previews: yes (no OAuth2). Originals: OAuth2 (401 otherwise) | **Optional BYOK.** API terms: commercial use of the API is negotiated with UPF; no full database copies |
| **Jamendo API v3.0** | ~645k CC tracks (Openverse count) with musicinfo (genres, instruments, speed, vocal/instrumental) | `GET https://api.jamendo.com/v3.0/tracks/?client_id=…` | `client_id` required (an invalid id returned an error); free for **non-commercial** apps; commercial apps must contact Jamendo; must credit the artist and Jamendo with a backlink; no offline-cache design | Per track (`license_ccurl`); many are BY-NC-ND | `audiodownload` is empty unless `audiodownload_allowed` | Use **via Openverse** instead (no key; same files) |
| **Incompetech (Kevin MacLeod)** | 1,443 tracks; 1,196 with BPM; feel/mood, instruments, description, genre | `GET https://incompetech.com/music/royalty-free/pieces.json` (881 KB); MP3 at `…/mp3-royaltyfree/{encodeURIComponent(filename)}` | None | **CC BY 4.0**, monetization allowed; credit required; a paid no-credit license exists | Yes (206) | **Primary music library.** Tracks are pre-registered in Content ID, so claims are released after a dispute that cites the credit |
| **ccMixter** | CC remix/instrumental music with BPM | `GET http://ccmixter.org/api/query?f=json&tags=instrumental&lic=by&limit=…&sort=rank` | None | `lic=by` / `pd`, etc.; per upload | **403 without a ccmixter.org Referer** (hotlink protection); 206 with one | Secondary; don't spoof the Referer, so link the user to `file_page_url`. No longer in Openverse |
| **Wikimedia Commons** | PD/CC recordings (classical, historical, nature) | Via Openverse `source=wikimedia_audio` | Openverse limits | Per file (CC0/PD/BY/BY-SA) | Yes (`upload.wikimedia.org`, 206) | Good for public-domain classical music |
| **Kenney** | Interface Sounds 100, UI Audio 50, Impact Sounds 130, Digital Audio 60, Casino 50, Music Jingles 85, Sci-fi 70, RPG 50 (+ voiceover packs) | Asset page → zip at `https://kenney.nl/media/pages/assets/{slug}/{hash}/kenney_{slug}.zip` (the hash changes) | None | **CC0** | Yes (zip, 206) | **Bundle in the app** (redistribution allowed) |
| **Mixkit** (Envato) | Curated SFX and music | No API; preview pattern `https://assets.mixkit.co/active_storage/sfx/{id}/{id}-preview.mp3` | — | SFX license: commercial OK, no credit, but **no redistributing "on its own, as stock, in a tool or template"**, no Content ID registration. Music license: web/social/YouTube/ads/podcasts only; **not** broadcast, games, CDs/DVDs; no remixing into music-only tracks | Yes (206) | User-initiated single imports only; **never bundle or bulk-fetch** |
| **Pixabay** | Music + SFX | API covers images and videos only; **no audio API** | — | Pixabay Content License: commercial use, no credit, no standalone redistribution | — | Manual download only; terms prohibit scraping and bots |
| **Sonniss #GameAudioGDC** | 2015–2024 bundles (tens of GB) | `downloads.sonniss.com` + torrents | — | Royalty-free, commercial, no credit; **no redistribution including in an "SDK or anything similar"; no AI training** | — | Let users point Reframer at their own local folder; never bundle |
| **Free Music Archive** | CC music | API **shut down**; no hotlinking; no forwarding of searches or scraping without approval | — | Per track | — | Not integrable |
| **YouTube Audio Library** | Music + SFX | No API. YouTube Terms: no downloading except where the Service expressly authorizes it; no automated access (robots, scrapers) | — | Standard license (YouTube use) or CC BY (credit in description) | — | Users download manually in YouTube Studio; **never automate** |
| BBC Sound Effects | 30k+ SFX | — | — | RemArc licence: personal, educational and research use only *(fetch blocked this session; verify)* | — | Exclude for commercial work |

### 7.2 Openverse details (verified)

**Parameters** (OpenAPI at `/v1/schema/`):

| Parameter | Values / notes |
|---|---|
| `q` | ≤200 chars |
| `page`, `page_size` | Default 20 |
| `source`, `excluded_source` | `freesound`, `jamendo`, `wikimedia_audio` |
| `license` | `by`, `by-nc`, `by-nc-nd`, `by-nc-sa`, `by-nd`, `by-sa`, `cc0`, `nc-sampling+`, `pdm`, `sampling+` |
| `license_type` | `all`, `all-cc`, `commercial`, `modification`; comma-joined values are *intersected* |
| `category` | `audiobook`, `music`, `news`, `podcast`, `pronunciation`, `sound_effect` |
| `length` | `shortest` <30 s, `short` 30 s–2 min, `medium` 2–10 min, `long` >10 min (from the indexer source) |
| `extension` | — |
| `tags` / `title` / `creator` | Field searches; can't be combined with `q` |
| `filter_dead` | Default true |
| `mature` | Default false |
| `peaks` | Waveform peaks |
| `unstable__*` | Experimental |

**Gotchas found by testing:**
- **Freesound items have `category: null`, so `category=sound_effect` drops all of Freesound.** "keyboard typing" returned 240 results without the filter and **0** with it. Use `source=freesound` for SFX.
- `license_type=commercial` **includes `by-nd`** and `sampling+`. `commercial,modification` intersects to {by, by-sa, cc0, pdm, sampling+}. **Use an explicit `license=cc0,pdm,by`** (add `by-sa` only knowingly).
- `duration` is in **milliseconds** (the shutter is `295` = 0.295 s).
- `alt_files[0].url` (the Freesound original) needs Freesound OAuth2 and returns 401. Use `url` (the HQ MP3 preview).
- Anonymous `page_size=30` → `401 {"detail":"page_size may not exceed 20 for anonymous requests"}`. Page 13 at size 20 → `401 {"detail":"pagination depth may not exceed 240 for anonymous requests"}`.
- Jamendo results carry useful tags such as `instrumental` and `speed_high`. Put "instrumental" in `q`.
- **Registration:**
  - `POST /v1/auth_tokens/register/` with `{name, description, email}` returns `client_id`/`client_secret`. Email verification is required for the higher limits.
  - `POST /v1/auth_tokens/token/` (`application/x-www-form-urlencoded`, `grant_type=client_credentials`) returns a Bearer token (example `expires_in: 36000`).
  - An open-source desktop app can't ship a secret, so use anonymous access per user IP (200/day is plenty for one editor), or let users paste their own credentials.
- **Terms of service:**
  - No scraping, and no circumventing rate limits (for example with multiple machines).
  - Comply with the CC terms, including attribution.
  - Openverse does not verify licenses. Store a license snapshot and the landing URL at import time.
  - Openverse may charge for heavy commercial use.
  - Indicate the product was made using Openverse but is not endorsed by it.

**Verified request** (SFX):
```
GET https://api.openverse.org/v1/audio/?q=camera%20shutter&license=cc0,pdm,by&page_size=2
→ 200, headers: x-ratelimit-limit-anon_burst: 20/min, x-ratelimit-limit-anon_sustained: 200/day
{
 "result_count": 240, "page_count": 120, "page_size": 2, "page": 1,
 "results": [{
   "id": "3290f0e3-a217-48c9-bafb-06401b961c21",
   "title": "Camera Shutter",
   "url": "https://cdn.freesound.org/previews/170/170229_3133582-hq.mp3",
   "creator": "roachpowder", "creator_url": "https://freesound.org/people/roachpowder",
   "license": "cc0", "license_version": "1.0",
   "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
   "attribution": "\"Camera Shutter\" by roachpowder is marked with CC0 1.0. To view the terms, visit https://creativecommons.org/publicdomain/zero/1.0/.",
   "source": "freesound", "foreign_landing_url": "https://freesound.org/people/roachpowder/sounds/170229",
   "duration": 295, "filetype": "mp3", "category": null, "genres": null,
   "tags": ["Camera", "Camera-Shutter", "Shutter"],
   "alt_files": [{"url": "https://freesound.org/apiv2/sounds/170229/download/", "filetype": "aiff", "sample_rate": 44100}]
 }, { "title": "Camera Shutter, Fast, A.wav", "creator": "InspectorJ", "license": "by", "license_version": "4.0", "...": "..." }]
}
```

**Verified request** (music):
```
GET https://api.openverse.org/v1/audio/?q=corporate%20upbeat&source=jamendo&license=cc0,pdm,by&page_size=1
{ "title": "The Corporate Upbeat", "creator": "Soundrider/Dope",
  "url": "https://prod-1.storage.jamendo.com/?trackid=1670594&format=mp32",
  "license": "by", "license_version": "3.0",
  "attribution": "\"The Corporate Upbeat\" by Soundrider/Dope is licensed under CC BY 3.0. To view a copy of this license, visit https://creativecommons.org/licenses/by/3.0/.",
  "foreign_landing_url": "https://www.jamendo.com/track/1670594",
  "duration": 121000, "filetype": "mp32", "category": "music",
  "genres": ["corporate", "filmscore"], "tags": ["commercial", "instrumental", "soft", "speed_high"] }
GET <url> with Range → 206 audio/mpeg
```
Note: the top 5 Jamendo hits for "upbeat" *without* a license filter were all `by-nc-nd 3.0`. Always filter.

### 7.3 Freesound API v2 (from the docs; search needs a key)
- `GET https://freesound.org/apiv2/search/?query=whoosh&filter=license:"Creative Commons 0" duration:[0.2 TO 2]&sort=rating_desc&fields=id,name,username,license,duration,previews,url&page_size=50&token=KEY`
- **Search parameters:**
  - `page_size`: default 15, max 150.
  - `sort`: `score`, `duration_*`, `created_*`, `downloads_*`, `rating_*`.
  - Filters use Solr syntax: `tag:`, `type:`, `duration:[a TO b]`, `avg_rating:[3 TO *]`, `bpm:`, `samplerate:`. License filter values: `"Creative Commons 0"`, `"Attribution"`, `"Attribution NonCommercial"`.
- **Response:**
  - Fields: `{count, next, previous, results:[{id, name, username, license, duration, previews:{preview-hq-mp3, preview-lq-mp3, preview-hq-ogg, preview-lq-ogg}, url}]}`.
  - Previews don't need OAuth2.
- **Verified:**
  - Without a token, `GET /apiv2/search/?query=camera%20shutter` → `401 {"detail":"Authentication credentials were not provided."}`.
  - The preview `https://cdn.freesound.org/previews/351/351256_2247456-hq.mp3` → 206 audio/mpeg with no auth.
  - The original `…/apiv2/sounds/351256/download/` → 401.

### 7.4 Incompetech (verified)
- `pieces.json` entry:
  ```json
  {"title":"Sneaky Snitch","filename":"Sneaky Snitch.mp3","length":"00:02:17","instruments":"Oboe, Strings, Snare Drum","genre":"22","bpm":"87","description":"…","feel":"Bouncy, Dark, Humorous, Mysterious","uploaded":"2010-11-25","isrc":"USUAN1100772","collection":"34","filmmusicURL":"https://incompetech.filmmusic.io/song/4384-sneaky-snitch/"}
  ```
- **Genre ids** (from `music.html`):

  | Id | Genre | Id | Genre | Id | Genre |
  |---|---|---|---|---|---|
  | 2 | African | 11 | Jazz | 20 | Silent Film Score |
  | 3 | Blues | 12 | Latin | 21 | Ska |
  | 4 | Classical | 13 | Modern | 22 | Soundtrack |
  | 5 | Contemporary | 14 | Musical | 23 | Stings |
  | 6 | Disco | 15 | Polka | 24 | Unclassifiable |
  | 7 | Electronica | 16 | Pop | 25 | World |
  | 8 | Funk | 18 | Reggae | 26 | Urban |
  | 9 | Holiday | 19 | Rock | | |
  | 10 | Horror | | | | |
- **Feel frequencies:** Dark 419, Grooving 374, Relaxed 354, Bright 329, Calming 307, Bouncy 303, Driving 271, Mysterious 261, Intense 221, Eerie 185, Unnerving 177, Somber 166, Mystical 164, Uplifting 154, Humorous 151, Epic 130, Action 120, Suspenseful 102, Aggressive 82.
- **File URL:** `https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Snitch.mp3` → 206.
- **Credit** (Incompetech FAQ; the credit can go in the YouTube description or in the video):
  `"Sneaky Snitch" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/`
- **Content ID:** MacLeod pre-registers his catalog to block fraudulent claimants. The creator credits him and disputes, and the claim is released (his page says within 72 hours). The agent should warn users about this on monetized YouTube uploads.

### 7.5 ccMixter (verified)
`http://ccmixter.org/api/query?f=json&tags=instrumental&lic=by&limit=2&sort=rank` returns:
```json
[{"upload_name":"I dunno","user_name":"grapes","license_name":"Attribution (3.0)","license_url":"http://creativecommons.org/licenses/by/3.0/","upload_extra":{"bpm":90,"usertags":"hip_hop,instrumental"},"file_page_url":"https://ccmixter.org/files/grapes/16626","files":[{"download_url":"https://ccmixter.org/content/grapes/grapes_-_I_dunno.mp3","file_format_info":{"ps":"2:45","mime_type":"audio/mpeg"}}]}, ...]
```
- Other parameters: `lic` (`by`, `nc`, `sa`, `nod`, `byncsa`, `byncnd`, `s`, `splus`, `ncsplus`, `pd`), `search` with `search_type` (`match`/`any`/`all`), `reqtags`, `type=all|any`, `offset`, `sort` (`rank`, `date`, `name`, `score`, …).
- `download_url` → **403** without a `ccmixter.org` Referer, and 206 with one. That is hotlink protection: don't spoof it.

### 7.6 License safety for a creator's commercial video
| License | Commercial video OK? | Obligations | Notes |
|---|---|---|---|
| CC0 1.0 / Public Domain Mark | Yes | None (credit is courteous) | Keep a provenance log anyway |
| CC BY 3.0/4.0 | Yes | Credit: Title, Author, Source link, License link (TASL), in a reasonable manner for the medium: video description, credits, or both | CC 4.0 lets attribution be satisfied "in any reasonable manner" for the medium |
| CC BY-SA | Legally yes, but… | The video counts as an adaptation, so it must be released under BY-SA too | Syncing music to moving images always counts as an adaptation (CC BY 4.0 definition) → avoid by default |
| CC BY-ND / BY-NC-ND | **No** | — | Syncing = adaptation (CC 4.0 definition; CC 3.0 "synching" clause), and ND forbids sharing adaptations |
| CC BY-NC / BY-NC-SA | **No** for monetized or brand content | — | Treat monetized YouTube as commercial |
| Sampling+ / NC Sampling+ | Avoid | — | Deprecated CC licenses with advertising restrictions |
| Pixabay Content License | Yes | No credit; no standalone redistribution | Manual only |
| Mixkit Free License | SFX: yes. Music: web, social, ads, podcasts, YouTube; not broadcast, games, discs | No credit; no bundling in tools; no Content ID registration | Music claims → team@mixkit.co |
| Sonniss GDC license | Yes (sync in productions) | No redistribution, no AI training | Local folder only |
| YouTube Audio Library Standard | YouTube uploads | Some tracks are YouTube-only | No automation |

**Attribution output Reframer should generate at export** (one line per CC BY asset; CC0 optional):
`Music: "The Corporate Upbeat" by Soundrider/Dope (https://www.jamendo.com/track/1670594), licensed under CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)`
`SFX: "Camera Shutter, Fast, A.wav" by InspectorJ (https://freesound.org/people/InspectorJ/sounds/360329), licensed under CC BY 4.0`
Add "Music/SFX search powered by Openverse" in the app UI (Openverse terms).

---

## 8. Implementation notes for Reframer (found while researching; nothing was modified)

1. **`src/server/audio-library.ts` (uncommitted) breaks on Openverse at default settings.**
   - `page_size: Math.min(40, limit * 3)` gives 30 when `limit=10`, which Openverse rejects with `401 page_size may not exceed 20 for anonymous requests`. Reproduced with the exact query string.
   - Fix: cap at 20, and over-fetch through `page=2` only if needed (that costs 2 of the 20/min burst).
   - `source=jamendo,ccmixter`: ccMixter is no longer indexed (it is silently ignored). Consider `jamendo,wikimedia_audio`.
2. **Kevin MacLeod catalog.**
   - The archive.org items hold 747 + 108 MP3s; the `KevinMacLeod` item's metadata claims CC0, but the music is CC BY.
   - The official `pieces.json` has **1,443** tracks with BPM, feel tags, instruments and descriptions, so mood/BPM search becomes real ("calm" → `Calming|Relaxed`, "epic" → `Epic|Intense`).
   - Cache it for ~7–30 days.
3. **Attribution.** Openverse's `attribution` string lacks the source URL. Append `foreign_landing_url` (TASL), and store a license snapshot per imported asset (Openverse disclaims license accuracy).
4. **Ducking** (`src/remotion/context.tsx`):
   - It uses a fixed `DUCK_LEVEL = 0.28` (−11 dB) and ignores the style DNA's `duckDb`.
   - Attack and release are both 8 frames.
   - Speech ranges merge only when the gap is <8 frames, so it pumps between sentences.
   - Video clips with any transcript duck for their whole duration.
   - Suggested: use per-phrase ranges from transcript word times; start the attack ~0.25 s before speech; release over 0.5–0.8 s; bridge gaps < 1.2 s; set depth from `duckDb` (default 15); make it loudness-aware using `asset.analysis.loudness`.
5. **No master loudness stage was found** (no `loudnorm`/`ebur128`/limiter in `src`). Add one at export: a two-pass ffmpeg `loudnorm=I=-14:TP=-1:LRA=11` (or a limiter plus gain), with platform presets of −14, −16 and −23. Also normalize assets at import, which `analysis.loudness` already partly supports.
6. **SFX library gaps** (real recordings via Openverse/Freesound CC0, or bundled Kenney CC0):
   - ambience beds and room tone (office, street, cafe, nature);
   - a UI error buzz, more notification variants, a camera flash pop;
   - reverse cymbal / suck-back, tape stop, drumroll;
   - crowd cheer, applause, laugh, crickets, sad trombone, heartbeat;
   - 2–3 **variants** each of whoosh, click and pop to avoid identical repeats.
7. **`search_audio`** is referenced by lint messages and exists as `/api/audio/search`, but it is not yet in `tool-schemas.ts`. The skill draft below assumes it becomes an agent tool (`kind: "music" | "sfx"`, `query`, `minSec`, `maxSec`).

---

## 9. Agent skill draft (`src/agent/skills/sound-design.md`, ≤250 lines)

```markdown
---
name: sound-design
description: Load before adding music, sound effects or voiceover, and for any audio pass. House rules for choosing real licensed music, placing SFX on visible events with frame-accurate timing, restraint, ducking, loudness and credits.
---

# Sound design: music and SFX like a pro editor

Viewers forgive soft visuals before they forgive bad sound. Your job:
- make every sound feel like it came from the picture (synchresis: a sound on the exact frame of a visual event fuses with it);
- keep speech effortless;
- leave room to breathe.

Frames assume 30 fps (1 f ≈ 33 ms).

## Non-negotiables
- Music is always a real recording: `search_audio` (kind "music") → `import_media`, or the user's own file.
  - Never synthesize music, chords, drones or "beds" with code, components or stacked SFX.
  - If nothing fits, `ask_user` with 3 candidates plus "no music".
- Allowed licenses: CC0, Public Domain, CC BY (credit).
  - Never NC.
  - Never ND: syncing music to picture counts as an adaptation.
  - CC BY-SA only if the user accepts that the whole video becomes BY-SA.
- Write each CC BY credit line into the clip `note`, and list all credits in your final message for the video description.
- Every SFX marks something visible: an arrival, impact, click, capture, reveal or cut. No visible event, no sound.
- Speech wins: no SFX on a stressed word; music at least 12 LU under the voice.

## Workflow
1. Read the brief and the style's sound block (music, bpm, sfx, sfxPerMin, duckDb).
2. Put a sound plan in `set_plan`:
   - the music mood, genre and BPM;
   - the palette: one transition family, one UI family, one impact family;
   - the 1–3 hero moments;
   - where the silence goes.
3. Music: search 3–5 candidates using mood + genre + "instrumental" + a tempo word. Prefer tracks at least as long as the video. Import, then run `detect_beats` with `addMarkers`.
4. Cut picture to the music: hero moments on downbeats, the reveal on the drop.
5. Place SFX from the event map with frame math. For real-world sounds not in the library, use `search_audio` kind "sfx".
6. Level, duck, fade, and end on the music's resolution.
7. Check density, layers, lint warnings and credits (Self-check).

## Music by video type
| Video | Feel / genre (search words) | BPM | Notes |
|---|---|---|---|
| Launch / keynote | bright, uplifting, driving; minimal electronic, ambient pop | 100–124 | Build → drop on the reveal |
| Social ad 6–30 s | bright, bouncy, grooving; pop, hip-hop, house | 110–130 | Hook in second 1; end on a sting |
| Explainer / tutorial | calming, relaxed; lo-fi, marimba, soft acoustic | 85–110 | No lead melody; none during dense steps |
| Vlog / lifestyle | grooving, relaxed; lo-fi hip-hop, indie | 80–110 | New section per segment |
| Trailer / hype | epic, intense, suspenseful; hybrid orchestral, pulses | 120–140 | 3 escalating waves; silence before the last hit |
| Testimonial / corporate | uplifting, calming; piano, soft strings | 70–100 | 18 LU under speech; drop out for the key line |
| Data story / tech | mysterious, driving; minimal electronic | 100–120 | Space for numbers |
| Comedy / meme | humorous, bouncy; pizzicato, bassoon, ukulele | 90–130 | Music may stop for jokes |
| Emotional / story | somber → uplifting; piano, strings | 60–85 | One climax |
| Sports / fitness / montage | driving, aggressive, action; rock, EDM, trap | 120–150 | Drops on highlights |
| Horror / mystery | eerie, dark, unnerving; drones, textures | none–90 | Silence is a tool |
Tempo words: slow <70 · medium-slow 70–90 · medium 90–110 · medium-fast 110–130 · fast >130.

## Cutting music
- Frames per beat = fps × 60 / BPM (30 fps: 120 BPM = 15 f, 100 BPM = 18 f). A 4/4 bar is 4 beats.
- Shot rhythm, then break the pattern now and then:
  - calm: a cut per bar;
  - energetic: every 2 beats;
  - hype: every beat.
  Never cut on every beat for a whole film.
- Start the music on a downbeat at the start of a phrase. At frame 0 no fade is needed; elsewhere fade in 0.5–1.5 s.
- To shorten, remove whole 4- or 8-bar phrases between similar sections.
  - Splice on a downbeat with a 10–30 ms crossfade (beats) or ~0.5 s (pads).
  - Never splice through vocals or a held chord.
- Loop whole bars only, spliced at downbeats, avoiding fills.
- Ending:
  - Backtime the track's real ending (final hit or ring-out) onto the end card.
  - Otherwise fade 1–2 s (energetic) or 3–5 s (reflective), finishing on a downbeat.
  - Never stop mid-bar.
- Climax:
  - Quicken cuts in the build.
  - Dip the music 4–12 f before the drop.
  - Land the hero reveal on the drop's first downbeat.
- Change tracks only at chapter boundaries: crossfade 2–4 s on a phrase boundary, or cut on a downbeat under a transition hit.
- Under speech: instrumental only, duck on, at least 12 LU under the voice (style duckDb). Speech-dense tutorials can go without music.
- No music for:
  - the key line of an emotional testimony;
  - crowd roars, product sounds, ASMR;
  - deadpan jokes;
  - footage that already has music.

## SFX event map (built-in ids)
startSec = event time − peak offset. Peak offsets:
- whoosh 0.45 s, whoosh-fast 0.19, swoosh 0.17, whip 0.12, braam 0.2, paper 0.15.
- riser and riser-short peak on their last frame (start = hit − 2.0 s or − 1.0 s).
- All other built-in sounds land on their first frame.

| Event | Sound | Sync to |
|---|---|---|
| Title/text pops in | pop (playful) or swoosh (clean); premium styles: none | First visible frame or overshoot peak |
| Title slam / hero stat | impact or bass-hit (+ sub-drop for weight) | Landing frame |
| Typewriter text | typewriter per char, max 12 chars/s | Each char's first frame |
| Typing in UI/search/chat | typing, trimmed to the typing span; Enter = click | First to last char |
| Word-by-word captions | nothing; pop or tick on ≤3 key words per sentence | Word appears |
| Lower third / label / card slide | swoosh or whoosh-fast | End of the move |
| Counter counting up | quiet tick every 2–3 f, then ding / cash / impact | Final value locks |
| Price / revenue / money | cash | Number lands |
| Chart animates | one swoosh or riser-short per chart; pop on the key label | Growth end |
| Checklist items | tick or click per item (≥0.25 s apart); ding on the last | Item appears |
| Photo taken / flash / freeze | shutter + 2–4 f white flash | Flash frame |
| Screenshot / image card | swoosh (slide), pop (scale) or paper (document) | Landing |
| Before / after | switch | Flip frame |
| Cursor click / button | click | Button state change |
| Phone tap / toggle | tap / switch | Contact / state change |
| Notification / message | chime (message), ding (alert) | Toast appears |
| Success / done | ding | Check completes |
| Error / denied | glitch trimmed to 0.2 s | Error state |
| Product reveal | riser → impact (bold) or sparkle (premium); if the music drops there, only sub-drop | Reveal frame |
| Logo lockup | whoosh into impact (bold) or chime/sparkle (friendly) | Lockup; music resolves there too |
| End card / CTA | the music's resolution; optional pop on the button | End card |
| Hard cut / cut on a beat | nothing | — |
| Whip pan | whip | The cut |
| Zoom / push transition | whoosh or whoosh-fast | The cut |
| Glitch / VHS transition | glitch / static | Centered on the cut |
| Flash / dip to white | impact or boom (+ shutter if photographic) | Brightest frame |
| Dip to black / chapter | nothing, or sub-drop as the music phrase ends | Fade start |
| Slow motion | boom or sub-drop, music muffled; whoosh back to real time | Slow-mo onset |
| Speed ramp | whoosh-fast into bass-hit | Ramp peak |
| Punchline / reaction (meme styles) | vine-boom | 2–6 f after the beat lands, never over words |
| "Wait, what?" freeze | record-scratch, and the music stops | Freeze frame |
| Bounce / jump / fly up | boing / slide-whistle-up | Contact / take-off |
| Scene or location change | the new place's ambience (search) | 0.5–1 s before the cut (J-cut) |
| Paper / notes / documents | paper | Landing |
| Shine / magic highlight | sparkle | Shine passes |
| Countdown | tick per digit; impact or ding at zero | Digit change |
For sounds outside the library, `search_audio` kind "sfx" with plain nouns:
- "city street ambience", "office room tone", "crowd cheer", "applause";
- "door close", "heartbeat", "crickets", "sad trombone";
- "notification", "error buzz".

## Timing
- Align the transient, not the clip start.
- Viewers notice sound more than 45 ms early or more than 125 ms late. Aim at the event frame: 1 f early or 1–2 f late is fine; 2+ f early looks wrong.
- Whoosh into hit: the whoosh peaks 0–2 f before the landing; the hit lands on it.
- Risers end exactly on the hit or cut.
  - Length: 1–2 bars with music (one bar = 240 / BPM s), 1–3 s without.
  - Never play past the payoff, and never place a riser without one.
- Biggest reveal only: 4–12 f of near-silence right before the hit.
- Let tails ring across cuts. If a tail sits under the first word of a line, fade it over 3–10 f.
- Scene changes: the new scene's sound leads the picture by 0.5–1 s (J-cut); outgoing sound may trail 0.3–1 s (L-cut).
- Comedy: the visual beat registers first, then the sting 2–6 f later. Awkward beats get 1–2 s of silence.

## Density
- SFX per minute (the style's sfxPerMin wins):

  | Format | Per minute |
  |---|---|
  | Explainer / tutorial | 4–10 |
  | Launch / keynote | 6–15 |
  | Social ad | 10–20 |
  | Meme / retention short | 15–30 |
- Hero sounds (impact, boom, braam, bass-hit, sub-drop, vine-boom): ≤1 per 10 s and ≤3 per minute outside the finale.
- At any instant: voice + music + at most 2 SFX or ambience layers. Never 3 similar sounds together.
- One sound per moment. Add a support layer only for weight (whoosh + impact, impact + sub-drop).
- Don't double the music. When a cut or reveal lands on a strong beat or drop, skip the hit or add only a sub-drop.
- The same event gets the same sound all video long. For back-to-back repeats, alternate 2 variants or shift the volume ±2 dB.
- Give the ear a rest every 30–60 s: a stretch with only music or only voice.
- Transitions without meaning get no sound. Most cuts are silent.

## Levels
`volume` is linear gain: dB = 20·log10(volume). 0.5 ≈ −6 dB, 0.25 ≈ −12, 0.125 ≈ −18.
- Delivery:
  - YouTube, TikTok, Reels, Spotify: −14 LUFS integrated, true peak ≤ −1 dBTP.
  - Podcasts: −16 LUFS.
  - Broadcast: −23 LUFS (EBU R128).
- Built-in SFX peak at −1 dBFS. Starting volumes:

  | Sounds | Volume |
  |---|---|
  | click, tap, tick, switch | 0.15–0.3 |
  | pop, swoosh, whoosh, whip, paper, typing | 0.25–0.45 |
  | shutter, cash, ding, chime, sparkle, glitch, static, risers | 0.3–0.5 |
  | impact, boom, braam, bass-hit, vine-boom | 0.5–0.8 |
  | sub-drop | 0.6–0.9 |

  Under speech, use the low end, and never let an SFX get louder than the voice.
- If `analysis.loudness` is known: volume = 10^((target − loudness) / 20). Targets:
  - voice: −16 to −14 LUFS;
  - music alone: −16;
  - music under voice: 12–18 LU below the voice;
  - ambience under voice: ≥15 LU below the voice.
- No moment should jump more than ~5 LU above the overall loudness. Hits are short, not loud.
- Ducking:
  - duck on for music, depth = the style's duckDb (default 15 dB);
  - start 0.2–0.3 s before the first word, recover over 0.5–1 s;
  - stay ducked through pauses under ~1.2 s.
- Fades:
  - music in: 0.5–1.5 s, except on a downbeat at frame 0;
  - music out: 1–5 s, or the track's real ending;
  - every audio cut: a 2–5 ms micro-fade to avoid clicks.
- Clear speech: under VO, choose music without busy mid-range leads (lead guitar, violin, vocals).

## Credits
- CC BY: "Title" by Creator (source URL), licensed under CC BY x.0 (license URL). The Openverse attribution plus its landing URL is enough.
- Kevin MacLeod: "Title" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/
  - Tell the user: his tracks are pre-registered in YouTube Content ID. A claim may appear, and it is released after a dispute that cites this credit.
- CC0, public domain and built-in SFX: no credit needed, but still note the source in the clip note.

## Self-check
- [ ] The music is a real, licensed track: cut on bars, ending on its resolution, nothing synthesized.
- [ ] Every SFX sits on a visible event, transient within −1/+2 f of it.
- [ ] SFX count within budget; no moment with more than 2 SFX layers; hero sounds rare.
- [ ] Speech always clear: music ducked ≥12 LU, nothing on stressed words.
- [ ] One palette: same event, same sound.
- [ ] −14 LUFS and −1 dBTP, no clipping, at least one breath of space.
- [ ] Credits listed for every CC BY asset.
```

---

## 10. References

**Theory and craft**
- Michel Chion, *Audio-Vision* (PDF): https://monoskop.org/images/6/6d/Chion_Michel_Audio-Vision.pdf
- Chion annotation (UChicago): http://csmt.uchicago.edu/annotations/CHION.HTM
- Synch points: https://www.jwstrand.com/blog/2018/10/30/locating-audio-vision-michel-chions-synchpoints
- Empathetic sound: https://en.wikipedia.org/wiki/Empathetic_sound
- Walter Murch, "Dense Clarity, Clear Density" (Transom): https://transom.org/2005/walter-murch/
- Worldizing: http://filmsound.org/terminology/worldizing.htm
- Walter Murch (Wikipedia; Rule of Six and the sound designer credit): https://en.wikipedia.org/wiki/Walter_Murch
- Randy Thom, "Designing a Movie for Sound": https://www.asoundeffect.com/designing-a-movie-for-sound/ (also http://filmsound.org/articles/designing_for_sound_old.htm)
- Ric Viers, *Sound Effects Bible*:
  - Emily Carr University wiki summary: http://wiki.ecuad.ca/index.php/Viers,_Ric._%22The_Sound_Effects_Bible:_How_to_Create_and_Record_Hollywood_Style_Sound_Effects%22._Michael_Wiese_Productions._California,_United_States_of_America._2008.
  - Book page: https://mwp.com/product/the-sound-effects-bible-how-to-create-and-record-hollywood-style-sound-effects/
- David Sonnenschein, *Sound Design* (contents): http://www.filmsound.org/bibliography/sounddesignbook.htm
- Sonnenschein, "Sound Spheres": https://designingsound.org/2011/05/10/david-sonnenschein-special-sound-spheres/
- J cut: https://en.wikipedia.org/wiki/J_cut
- Room tone: https://en.wikipedia.org/wiki/Room_tone
- Mickey Mousing: https://en.wikipedia.org/wiki/Mickey_Mousing
- Record Needle Scratch trope: https://tvtropes.org/pmwiki/pmwiki.php/Main/RecordNeedleScratch

**Modern practice**
- Epidemic Sound:
  - Transition SFX: https://www.epidemicsound.com/youtube/transition-sound-effects/
  - Sound design tips: https://www.epidemicsound.com/blog/sound-design-tips-and-tricks/
  - Audio mixing for video: https://www.epidemicsound.com/blog/audio-mixing-for-video/
- Morphic, syncing SFX: https://morphic.com/resources/how-to/how-to-sync-sound-effects-to-video
- Sonilo:
  - SFX for YouTube: https://sonilo.com/blog/guides/sound-effects-for-youtube-videos
  - Whoosh guide: https://sonilo.com/ai-music/whoosh-sound-effect-guide
  - Background music: https://sonilo.com/blog/how-to-add-background-music-to-a-video
- Derek Lieu, trailer sound design: https://www.derek-lieu.com/blog/2022/1/17/secrets-to-trailer-sound-design
- Trailer elements: https://duendesounds.com/trailer-sound-design-elements/ ; https://add.app/sound-effects/sound-design-for-trailers-hits-rises-drones-pulses/
- Pitchdrift, motion graphics tips: https://pitchdrift-productions.com/sound-design-tips-for-motion-graphics/
- PremiumBeat:
  - Capping music endings: https://www.premiumbeat.com/blog/cap-your-music-tracks-for-a-smooth-ending/
  - Editing a film to music: https://www.premiumbeat.com/blog/how-to-edit-a-film-to-music-without-it-becoming-a-music-video/
  - Audio levels: https://www.premiumbeat.com/blog/how-to-set-audio-levels-for-video/
- Film Editing Pro, cutting music cues: https://www.filmeditingpro.com/quick-tips-for-cutting-music-cues/
- Soundstripe, cutting stock music: https://www.soundstripe.com/blogs/how-to-cut-music-for-video-from-stock-music-sites
- Artlist BPM guide: https://new-blog.artlist.io/blog/music-bpm/
- Vidyard, background music: https://www.vidyard.com/blog/background-music-for-video/
- Krotos, balancing music and SFX: https://krotos.studio/blog/how-to-balance-music-and-sound-effects
- iZotope, mixing audio for video: https://www.izotope.com/en/learn/mixing-audio-for-video-part-4-mixing-techniques.html
- Larry Jordan:
  - Auto-ducking: https://larryjordan.com/articles/adobe-premiere-pro-cc-auto-ducking-audio/
  - Rethinking audio levels: https://larryjordan.com/articles/rethinking-audio-levels/

**Sync and loudness standards**
- ITU-R BT.1359: https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1359-0-199802-S!!PDF-E.pdf
- EBU loudness: https://tech.ebu.ch/loudness
- EBU R128 s1 (short-form): https://tech.ebu.ch/docs/r/r128s1.pdf
- EBU Tech 3343: https://tech.ebu.ch/docs/tech/tech3343.pdf
- Spotify loudness normalization: https://support.spotify.com/us/artists/article/loudness-normalization/
- Apple Podcasts audio requirements: https://podcasters.apple.com/support/893-audio-requirements
- AES TD1008: https://aes.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf ; summary: https://productionadvice.co.uk/td1008/
- Loudness Penalty: https://www.loudnesspenalty.com/
- Netflix spec summary: https://www.production-expert.com/home-page/2018/8/23/has-netflix-turned-the-clock-back-10-years-or-is-their-new-loudness-delivery-spec-a-stroke-of-genius
- YouTube upload encoding: https://support.google.com/youtube/answer/1722171
- Torcoli et al., "Preferred Levels for Background Ducking…" (JAES 2019):
  - https://www.researchgate.net/publication/338359352_Preferred_Levels_for_Background_Ducking_to_Produce_Esthetically_Pleasing_Audio_for_TV_with_Clear_Speech
  - https://salford-repository.worktribe.com/output/1360952/preferred-levels-for-background-ducking-to-produce-esthetically-pleasing-audio-for-tv-with-clear-speech
- Speech Loudness in Broadcasting and Streaming: https://arxiv.org/html/2405.17364

**Sources and licenses**
- Openverse:
  - API: https://api.openverse.org/v1/ ; schema: https://api.openverse.org/v1/schema/ ; stats: https://api.openverse.org/v1/audio/stats/
  - Terms of service: https://docs.openverse.org/terms_of_service.html
  - Code (license groups, length buckets): https://github.com/WordPress/openverse
- Freesound:
  - API overview: https://freesound.org/docs/api/overview.html
  - Resources: https://freesound.org/docs/api/resources_apiv2.html
  - API terms: https://freesound.org/help/tos_api/
- Jamendo:
  - Tracks API: https://developer.jamendo.com/v3.0/tracks
  - API terms: https://devportal.jamendo.com/api_terms_of_use
  - Licensing terms: https://licensing.jamendo.com/en/legal/termsofuse
- Incompetech:
  - Catalog: https://incompetech.com/music/royalty-free/pieces.json ; https://incompetech.com/music/royalty-free/music.html
  - FAQ: https://incompetech.com/music/royalty-free/faq.html
  - Content ID: https://incompetech.com/music/royalty-free/youtube-contentid.html
  - Licenses: https://incompetech.com/music/royalty-free/licenses/
- ccMixter Query API: https://ccmixter.org/query-api
- Kenney audio: https://kenney.nl/assets/category:Audio
- Mixkit license: https://mixkit.co/license/ (modal text at https://mixkit.co/license/modal/sfxFree/ and https://mixkit.co/license/modal/musicFree/)
- Pixabay:
  - API docs: https://pixabay.com/api/docs/
  - License summary: https://pixabay.com/service/license-summary/
  - Terms: https://pixabay.com/service/terms/
- Sonniss:
  - GDC bundle: https://sonniss.com/gameaudiogdc
  - Bundle license: https://sonniss.com/gdc-bundle-license/
- Free Music Archive, app developers: https://freemusicarchive.org/app-developers
- YouTube Terms of Service: https://www.youtube.com/t/terms
- YouTube Audio Library help: https://support.google.com/youtube/answer/3376882
- Creative Commons:
  - CC BY 4.0 legal code: https://creativecommons.org/licenses/by/4.0/legalcode.en
  - CC BY-ND 3.0 legal code: https://creativecommons.org/licenses/by-nd/3.0/legalcode
  - Best practices for attribution: https://wiki.creativecommons.org/wiki/Best_practices_for_attribution
- BBC Sound Effects licensing (not fetched this session): https://sound-effects.bbcrewind.co.uk/licensing
