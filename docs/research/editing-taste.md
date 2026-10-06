# Editing and Directing Taste for an AI Video Editor

Research report for Reframer. Compiled 2026-10-06.

Goal: give the Reframer agent the judgment of a working editor and director, plus a rubric it can use to critique its own cuts. The founder's complaint is that AI results look like "AI slop". This report collects the craft knowledge, the numbers, and the failure patterns behind that complaint, and turns them into rules.

How to read the evidence tags:

- **[P]** Primary, official, or peer-reviewed: platform guidance, standards bodies, research papers, or the creator's own document.
- **[S]** Secondary: practitioner articles, vendor blogs, trade press. Directionally useful, but the numbers are not rigorous.
- **[H]** My synthesis or heuristic. These are tunable defaults, not facts.

Bracketed numbers like [12] point to the Sources list at the end.

---

## 0. Executive summary

1. **Taste is mostly subtraction plus motivation.** Walter Murch ranks the reasons for a cut as emotion 51%, story 23%, rhythm 10%, eye-trace 7%, 2D screen plane 5% and 3D space 4%. When something has to give, you give up the bottom criteria first, never emotion [1][2]. His working ethic is to do the most with the least. An editor who over-points at things is like a tour guide who never stops talking [3]. Every cut, transition, zoom, sound effect and line of text needs a reason you can state in one line. If it has none, delete it.
2. **The plain cut is the professional default.** Cuts make up more than 99% of transitions in contemporary Hollywood film [12] [P]. A transition on every cut is the single most recognizable amateur and template tell [72].
3. **Rhythm comes from variance, not speed.** Shot lengths in real films follow a right-skewed, roughly lognormal distribution. The median is about 0.5 to 0.6 times the mean: many short shots and a few long holds [14] [P/S]. Shots also cluster into "packets" of similar length, short for action and longer for dialogue, and the overall pattern approaches 1/f [12][13] [P]. AI edits tend toward mathematically even cut lengths, which read as robotic [79] [S]. The fix is to measure the variance and the runs of equal-length shots.
4. **The hook is the first 1 to 3 seconds, and the first frame must already be content.**
   - TikTok reports that 90% of an ad's recall impact is captured in the first 6 seconds [30] [P].
   - Google and YouTube's ABCD research covers more than 6,000 ads, with Ipsos, Nielsen and Kantar data. It recommends tight framing, two or more shots in the first 5 seconds, people on screen at the open, and the brand within 5 seconds [29] [P].
5. **Retention structure for long-form.**
   - The MrBeast production handbook calls the first minute the most important minute of every video.
   - Minutes 1 to 3 should show fast progress rather than describing what is coming.
   - Re-engage the viewer at about 3:00 and again at about 6:00, and never signal the ending early [26] [P].
   - Since 2024, though, the backlash against "beastification" matters. MrBeast says he slowed his videos down, let scenes breathe and yelled less, and his views rose [28] [S]. Retention editing done as noise (loud sound effects, sub-2-second shots, no pauses) is now a liability.
6. **B-roll must carry information.**
   - Good B-roll shows the exact thing being said, evidence for it, or a deliberate counterpoint.
   - Generic, keyword-literal stock (skyline handshakes, laptop-in-café, staring at screens) is the strongest "slop" signal after a robotic voice [74][78] [S].
7. **Motion rules.**
   - Never use linear easing on spatial moves.
   - Entrances decelerate, exits accelerate, and exits are shorter than entrances.
   - Use overshoot only when the tone is playful.
   - At most a third of the elements should be moving at once.
   - Keep each element type's entrance direction consistent.
   - Motion should carry information, not decorate (the Vox principle) [39][47][48][50].
8. **Text rules.**
   - One idea per screen.
   - Reading time of at least 0.33 to 0.375 s per word (BBC, 160 to 180 wpm) [57], plus time to orient.
   - Captions in chunks of 2 to 4 words.
   - Body text at least 4 to 5% of frame height on mobile [59].
   - Graphics inside the 5% graphics-safe margin [53] and outside the 9:16 platform UI zones [54][55].
9. **Sound is half the picture.**
   - Web loudness: about -14 LUFS integrated, -1 dBTP true peak [70].
   - Music bed 18 to 25 dB under speech [70].
   - Sound effects only on visible events [71].
   - Silence before an impact [71].
   - Music edited at phrase boundaries, ending on a resolution [24].
10. **Workflow discipline beats polish.**
    - Story first: paper edit, radio cut, rough cut.
    - Then rhythm: the fine cut.
    - Then graphics, sound and color.
    - Then QC [45][80].
    - The agent fails when it tweens properties inside one scene instead of cutting between shots, or decorates before the story works [75][77].
11. **Gap analysis for Reframer (section 7).** The existing `motion-taste`, `self-review` and `shorts-captions` skills cover motion and legibility well. They are missing the editorial brain: story logic, cut placement, B-roll meaning, pacing variance and pause preservation. A few of their defaults actively push toward slop:
    - transitions allowed on up to 25% of cuts;
    - 10 punch-ins a minute on short talking heads;
    - an overlay every 5 to 8 seconds;
    - 100 to 150 ms maximum silence;
    - "something new every 2 to 4 seconds" applied uniformly.

---

## 1. Editing craft

### 1.1 Walter Murch: the Rule of Six, blinks, and restraint

**The six criteria.** Murch asks of each cut whether it:

1. is true to the emotion of the moment (51%);
2. advances the story (23%);
3. occurs at a rhythmically right moment (10%);
4. respects the audience's eye-trace, meaning where they are looking (7%);
5. respects the 2D plane of the screen, its geometry and screen direction (5%);
6. respects 3D spatial continuity (4%).

The weights are deliberately lopsided. An emotionally right cut lets you break the lower rules, and the audience will not notice a spatial mismatch [1][2]. The idea came from a 1988 Sydney talk that became *In the Blink of an Eye* (1995) [1].

**Blinks.** While cutting *The Conversation*, Murch noticed that Gene Hackman blinked very near the points where he chose to cut. He concluded that people blink when a thought completes. A cut is the moment the viewer says, in effect, "I get it, next idea," and it lands at or slightly before where the audience would blink [2] [S]. Eye-tracking research backs this up: viewers do tend to blink at cuts [6] [P].

**Restraint.**

- Do the most with the least, and resist cutting for cutting's sake [3].
- Trust the audience instead of over-explaining [3].
- Anticipate what the audience wants to see and give it to them just before they ask. Cut to the listener's reaction while the speaker is still talking.
- Avoid "dragnet" editing, which mechanically cuts to whoever is speaking on every line change [2].

**Non-narrative work.** For corporate, social and commercial work, spatial continuity matters less and rhythm matters more. One adaptation moves about 9 points of weight from 2D and 3D space into rhythm [4] [S]. In fast montage and on small screens, eye-trace can become the deciding factor [5] [S].

**Screen size.** Murch kept small paper figures next to his monitor, scaled to remind him the audience would see a 30-foot screen. A small editing screen tempts an editor to pace too quickly and lean on close-ups [25] [S].

For phones the lesson half-inverts. ABCD shows you need tighter framing and bigger type on mobile [29]. But you still judge pacing at real size and real speed, not by scrubbing.

**Agent translation [H].**

- Every edit decision gets a one-line reason in the clip `note`, phrased as emotion, story, rhythm, eye-trace or information.
- If the only reason is "variety" or "keep it moving", try removing the edit and compare.

### 1.2 Cutting on action and eye-trace

**Cutting on action.** Cut during a movement, so the action starts in shot A and completes in shot B. Motion draws the eye and hides both the cut and small continuity errors [8] [S].

Practical defaults [H]:

- Cut 2 to 4 frames after the movement starts in shot A.
- Pick up shot B with the movement already under way.
- Avoid visibly repeating the action. The exception is the deliberate "repeat cut", a stutter used for emphasis [10].

**What eye-tracking research says** (Tim J. Smith and colleagues) [6][7] [P]:

- Right after a cut, viewers saccade toward the center of the screen. Fixations right after a cut are shorter, and gaze is biased to the center.
- Eyes move about 2 to 3 times per second in natural scenes, about 4 per second in unedited video, and about 5 per second in edited film. Editing raises the attentional load.
- Motion onsets and light-to-dark changes capture attention fastest.
- Viewers watching edited film show "attentional synchrony": everyone looks at the same faces and hands.
- Continuity editing works by using natural attention cues (motion, gaze, pointing, sound onsets, conversational turns) to move attention across the cut.

**Implications for the agent [H].**

- In shots under about 1.5 s, keep the subject of interest in the central 60% of the frame, or close to where the previous shot's focal point was.
- Do not introduce a text element on the exact cut frame, because it competes with the re-orientation saccade. Bring it in 3 to 6 frames after the cut. The existing Reframer self-review already flags "elements appearing on the exact cut frame".
- Animate only the thing that matters. Every other moving element steals the saccade.

**Screen direction and the 180-degree rule.** Keep subjects' left and right relationships consistent within a scene. Crossing the axis disorients the viewer [84] [S]. Movement direction carries meaning too: consistent left-to-right reads as continuing a journey, and a reversal reads as a return [84].

### 1.3 Split edits: J-cuts and L-cuts

**Definitions.** In a J-cut, the next shot's audio starts before its picture. In an L-cut, the current shot's audio continues over the next picture [9] [S].

**Typical offsets** from practitioner guides [9] [S]:

- 4 to 12 frames for dialogue.
- 1 to 3 seconds for scene changes.
- About half a second is often enough to make an interview answer or demo flow.
- If the audience consciously notices the stagger, it is too long.

**Uses.**

- Interviews and documentary: hear the next speaker before you see them.
- Smoothing jump cuts.
- Carrying emotion across a scene change.
- Sound bridges and sound match cuts [10].

Murch's advice to cut to reactions while someone is still speaking is itself an L-cut habit [2].

**Agent rule [H].** At every scene or section change that has dialogue or ambient sound, first try a J-cut (audio leading by 0.5 to 2 s) before reaching for any visual transition. In Reframer: start the next clip's audio earlier, or detach the audio and offset it.

### 1.4 Match cuts

**Types** [10] [S]:

- Graphic match: similar shape, color or composition.
- Match on action.
- Sound match or sound bridge.
- Repeat cut.

**Classics** [10]: *Lawrence of Arabia* cuts from a blown-out match to a desert sunrise. *Psycho* matches a drain to an eye.

Match cuts strengthen themes, compress time and create metaphors. They feel gimmicky when unmotivated or used several times in quick succession [10].

**Agent rule [H].**

- At most 1 to 2 showpiece match cuts per piece.
- Each one must link two ideas: before and after, cause and effect, problem and product, or then and now.

### 1.5 Jump cuts

**Definition.** A jump cut removes time between two shots with the same, or nearly the same, framing. The classical 30-degree rule says to change the camera angle by at least 30 degrees to avoid one [11] [S].

**When they are acceptable.**

- Native in vlogs, talking heads, TikTok, Reels and Shorts [11].
- Can feel frantic or unprofessional in more formal contexts (one guide cites LinkedIn) [11].
- Editors warn against using jump cuts as a lazy patch for missing material or ideas [72] [S].

**How to soften them.**

- Alternate framings with a punch-in of about 15 to 20% at sentence breaks, so the cut reads like a second camera [68] [S].
- Cover the seam with B-roll.
- Carry the audio across with a J- or L-cut.

**Pauses in talking footage.**

- A common safe default is to trim gaps over 0.5 s down to about 0.25 s, keeping a natural floor of 0.2 to 0.3 s so speech still breathes. Over-aggressive trimming makes speakers sound like they are gasping [69] [S].
- Silence-removal tools typically leave 0.1 to 0.3 s of padding around speech [69].
- Cut the pauses that exist for the speaker (searching for words). Keep the pauses that exist for the viewer: the beat after a claim and the beat before a reveal [68] [S].

### 1.6 Cutaways and B-roll

**Functions.** B-roll supports, illustrates, adds tension, elaborates, and covers edits [93] [S].

**Practical trigger** for talking heads [68] [S]:

- Insert B-roll when roughly two sentences pass without a visual change.
- Only use it if it explains, proves, or resets attention.
- Purely decorative mood footage does not count.

**Stock footage problems.**

- Clichés undermine originality and trust: slow-motion handshakes against a skyline, glass towers, people walking with purpose, people staring at screens, the laptop-in-café shot [78] [S].
- Stock must match the hero footage's resolution, frame rate and color, or it breaks the piece [78].
- *This Is a Generic Brand Video* (Dissolve, 2014) parodied exactly this genre of stock plus portentous voiceover, and won a Shorty Award [78].

**Ethics.**

- Condensing a 90-second ramble into a 15-second core is normal.
- Splicing fragments into a statement the person never made (a "frankenbite") or inventing reactions is not. The 2016 documentary *Under the Gun* was criticized for inserting a fabricated eight-second silence [45] [S].

**B-roll specificity scale [H]** (for the agent to self-score each cutaway):

| Score | Meaning | Example (VO: "our app cut invoice time in half") |
|---|---|---|
| 3 | Exact referent | Screen recording of the invoice flow with a timer |
| 2 | Concrete example or evidence | Before/after numbers on a chart, a real customer at their desk |
| 1 | Generic category | Any "person typing on laptop" stock clip |
| 0 | Unrelated mood, or contradicts the VO | Drone shot of a city, a handshake |

Targets: average at least 2, no zeros, and no more than 20% of B-roll scoring 1.

### 1.7 Montage

**Theory.**

- The Kuleshov effect: meaning comes from juxtaposition. The same neutral face reads as hungry, tender or grieving depending on the next shot [23] [P].
- Eisenstein's five methods are metric (cut by length), rhythmic (cut by content in the frame), tonal, overtonal and intellectual (collision of ideas) [23].

**Practice** [85] [S]:

- Shorten shots progressively toward the peak, then hold a longer shot at the climax, because stillness after acceleration lands the payoff.
- Decide the beginning, middle and end before cutting.
- Put the strongest clip near the end, not the start.

**Music in montage** [24] [S]:

- Cut on bars during the build and on beats for the payoff. A cut on every beat for long stretches is exhausting.
- Cut music just before the "1" of a bar, ideally at the end of a full 4- or 8-bar phrase.

### 1.8 Pacing and rhythm: the numbers

**Average shot length (ASL) by format.** ASL is mean seconds per shot. Treat each format as a band, not a target.

| Format | ASL / cut frequency | Evidence |
|---|---|---|
| Classical Hollywood (1930s) | 8 to 11 s | Wikipedia summarizing Bordwell [15] [S]; about 12 s in 1930 per Cutting [16] |
| Hollywood around 2005 | about 3 to 4 s; "about 2.5 s today" in Cutting's press summaries | [13][16] [P/S] |
| Contemporary features (Bordwell's "intensified continuity") | 4.3 to 4.9 s | [15] [S] |
| Example distributions | *Ace Ventura* ASL 4.7 s / median 2.7 s; *On the Beach* ASL 19.1 s / median 8.8 s | Salt via Cinemetrics [14] [P] |
| TV commercials, 1991 | about 2 s, roughly half the early-1980s length | [18] [P] |
| Fast-food and soft-drink TV ads (AdSum204, 102 ad pairs) | 30 s ads: 18 shots on average (range 8 to 38), ASL 1.67 s. 15 s ads: about 8 to 10 shots, ASL about 1.52 s. Individual shots 0.19 to 13.6 s | [17] [P] |
| Movie trailers | Average trailer length 114 s. Example ASLs: *Minari* 1.6 s, *Modern Warfare II* 1.3 s, game trailers 2.6 to 4.25 s (others reported down to about 0.8 s) | [19][20] [S] |
| YouTube tutorial / how-to | 5 to 9 s | [21] [S] |
| YouTube talking head / explainer | 4 to 8 s | [21] [S] |
| Vlog / lifestyle | 2 to 5 s | [21] [S] |
| Fast commentary / "retention-edited" YouTube | 1.5 to 3 s; retention-edited videos are built from shots under 2 s | [21][28] [S] |
| TikTok / Reels / Shorts | 1 to 2 s per shot is common. Guidance converges on a visual change every 2 to 3 s; TikTok says faster scene changes pull viewers in early | [21][30][88] [S] |
| Documentary interview bites | news 8 to 15 s; documentary 20 to 40 s or longer for strong storytellers | [45] [S] |

Notes:

- For talking-head shorts, "shots" include punch-ins, B-roll and graphic inserts. A visual change is not always a cut.
- There is no rigorous public cinemetrics for short-form platforms. The short-form numbers are practitioner norms.

**Shape of a good rhythm** [P unless noted]:

- **Distributions are right-skewed and roughly lognormal.** This holds for most films with an ASL under about 15 s, across eras [13][14]. Median divided by mean is roughly 0.5 to 0.6 in the Salt examples [14]. The AdSum ad histograms show the same skew: most shots are short and a few are long [17].
- **Packets, not noise.** Across 150 films from 1935 to 2005, shot lengths became increasingly correlated with their neighbors, forming packets: action sequences as clusters of short shots, dialogue as clusters of longer shots. The pattern approached a 1/f spectrum, which the authors suggest helps hold attention [12][13]. In practice, vary the pace by sequence. Do not jitter randomly shot by shot.
- **Pace is information rate, not just cut rate.**
  - Short promos should squeeze out dead space.
  - Longer formats need room to feel and think.
  - It is generally better to cut a little too fast than too slow [16] [S].
  - Most sluggish videos are not slow because they have few cuts. They are slow because shots overstay by 2 to 3 s [21] [S].
  - A uniform cut rate is monotonous [21].
  - Sub-second cutting with no rhythm reads as anxiety [21].
- **"Cutting too soon" is the other top mistake.** It does not trust the story. Let emotional moments breathe [72] [S].
- **More editing is not better editing.** Flashy cutting can look like compensation for weak material. Ask whether the editing makes the message clearer and more entertaining [19] [S].

**Metrics the agent should compute [H]:**

- Median divided by mean shot length: aim for 0.45 to 0.85.
- Coefficient of variation (CV, standard deviation divided by mean): aim for 0.5 to 1.2. Below 0.35 reads as a metronome.
- Equal-length runs: flag 5 or more consecutive shots within ±10% of each other. Exception: a deliberately bar-locked music montage, and even then the cut rate should change between sections.
- Longest static stretch (no cut, no meaningful motion, no new information): 3 s or less in short-form, unless it is a deliberate hold of 6 s or less.
- Pace curve: a rolling 5 s cut rate. There should be at least one acceleration into the climax and at least one deceleration (a breath) every 20 to 40 s.

### 1.9 The plain cut versus transitions

**How rare transitions are.** More than 99% of transitions in contemporary film are cuts [12] [P]. Editors list overusing flashy or repetitive transitions as a classic mistake: they date the project and distract from the story [72] [S].

**What each transition means** [22] [S]:

- **Dissolve.** Signals time or space distance, or that two shots belong together.
  - Typical length is 1 to 2 s (24 to 48 frames).
  - Very short dissolves of 6 to 12 frames can soften a jump.
- **Fade to or from black.** Beginnings, endings, and the close of something important.

**Mapping to Reframer's `transitionIn` types [H]:**

| Reframer type | Legitimate use | Default limit |
|---|---|---|
| none (hard cut) | Everything else | 90% or more of edit points |
| `fade` (cross dissolve) | Time passing, memory, soft montage; 4 to 8 f only to soften a jump | 12 to 30 f |
| `dip-to-black` | Chapter end, big time skip, ending | 3 or fewer per piece |
| `dip-to-white` | Flash of memory, euphoric beat | 1 or fewer per piece |
| `whip`, `push`, `slide` | Only when matched to on-screen or camera motion direction | 6 to 10 f; 1 or fewer per 20 s |
| `zoom-in`, `zoom-out`, `spin`, `flip`, `glitch`, `iris`, `clock-wipe`, `flash`, `light-leak`, `blur` | Only in styles that call for them (gaming, retro, music video, hype) | 1 or fewer per 30 s; never as a default |

---

## 2. Story structure for short videos

### 2.1 The hook (first 1 to 3 seconds)

**Platform evidence [P].**

- **TikTok** [30][31]:
  - 90% of ad recall impact is captured in the first 6 s.
  - Structure every piece as hook, then body, then close.
  - The hook should use suspense, surprise or emotion.
  - Faster scene changes typically draw viewers in early.
  - Design for sound on, vertical 9:16, at least 720p, and keep the UI safe space clear.
- **YouTube ABCD** [29]. Sources: Nielsen Neuro (n=6,000 ads), Google/Ipsos (n=5,000 TrueView ads), Kantar (more than 15,000 ads).
  - Use tight framing on the subject.
  - Aim for two or more shots in the first 5 s.
  - If people appear in the video, open with them on screen.
  - Use surprising or memorable imagery.
  - Introduce the brand or product in the first 5 s.
  - Have on-screen people say the brand name. This beats a voiceover mention.
  - Prefer an "emerging story arc": start high, show subtle brand cues, include an unexpected shift and multiple peaks, then offer more story for those who stay. The traditional slow TV build performs worse.
  - Context: 70% of watch time is on mobile and 95% of YouTube video is played with sound on (Google data, 2018).
- **YouTube long-form retention** [26][33]:
  - The biggest drop is almost always in the first minute.
  - In one MrBeast analytics screenshot, YouTube describes 69% still watching at 0:30 as typical.
  - Paddy Galloway argues an extra 10% retained at 30 s can be the difference between 100k and 1M views. This is a claim, not a study.

**Hook patterns [S].** These come from vendor research, so use them directionally.

- One analysis of 10,000 videos ranked "result first" highest, then contrarian claim, story setup, shocking stat and question. Social proof ranked lowest. Hooks that delivered a complete micro-hook within 5 s kept 23% more viewers at 30 s than hooks needing 10 s or more [35].
- A widely used three-phase opening [34]:
  1. Pattern interrupt (0 to 5 s).
  2. A concrete payoff promise (5 to 15 s).
  3. A commitment hook (15 to 30 s): an information gap, proof, or the start of a story or demo.
- Openers to avoid [34]: "hey guys", logo bumpers, "in this video we'll...", more than 10 s of context, apologies or disclaimers, an early like-and-subscribe ask, "have you ever wondered...".

**Expectation match.** The opening must deliver what the title and thumbnail, or the brief, promised. Otherwise viewers feel lied to and leave [26] [P].

**Agent rules [H].**

- Frame 0 is content: no black, no fade-in, no logo, no title card.
- The subject is in tight framing on the first frame.
- A first words-on-screen or spoken claim lands by 1.5 s.
- The tension, question or payoff promise is explicit by 3 s.
- For ads: two or more visual changes in the first 5 s, and the brand or product visible within 5 s.

### 2.2 Retention structure and pattern interrupts

**MrBeast handbook structure** [26][27] [P]:

- **Minute 0 to 1.** Match the title and thumbnail exactly, and front-load the most interesting material. Good lighting at the start correlates with less drop-off.
- **Minutes 1 to 3.** Move from hype to execution: stop telling, start showing. Use "crazy progression": cover several days of a survival challenge in the first 3 minutes rather than one, so viewers invest.
- **About 3:00.** A "re-engagement": a spectacle that fits the story and that only this channel could do.
- **Minutes 3 to 6.** The most exciting but simplest content, with lots of quick scene changes, so viewers fall in love with the people and the story.
- **About 6:00.** A second re-engagement that needs a bit more explanation and pushes into the back half.
- **Back half.** Longer explanations live here. Never signal the end of the video unless you are building hype for the final payoff.
- **Always know which minute mark you are working on.** Average video length across the last 100 videos was about 13:37.

**The 2024 correction** [28] [S]:

- The Washington Post called retention editing the "beastification" of YouTube: loud sound effects, fast cuts, flashing, zero pauses. Editors describe it as sequences of sub-2 s shots.
- In March 2024 MrBeast said he had slowed down, focused on storytelling, let scenes breathe and yelled less, and that his views had risen.
- A Syracuse professor described the style as saturated, so it no longer stands out when every video looks the same.

**Pattern interrupts done right [H, informed by 21, 30, 39].**

| Format | Visual change | New information beat | Structural re-engagement |
|---|---|---|---|
| Short-form, 60 s or less | Every 1.5 to 4 s, varying, not a fixed timer | Every 5 to 10 s | Mid-video twist or escalation |
| Long-form talking head | Every 4 to 8 s (B-roll, framing change, graphic) | Every 20 to 40 s | Every 60 to 180 s: reveal, location change, chapter |

The interrupt must change the information, not just the pixels. A cut to an example, a graphic that shows the number, or a reaction counts. A random zoom, a sound effect or an emoji does not.

### 2.3 Story logic: but/therefore, open loops, setup and payoff

**But and therefore.** Trey Parker and Matt Stone's rule: if the words "and then" sit between your beats, the story is broken. Each beat should connect with "but" or "therefore", which forces causation [36] [S].

**Open loops.** Raise a question early and pay it off later. The curiosity gap, or Zeigarnik effect, keeps people watching [38] [S]. Every loop you open must close.

**Chekhov's gun.** Every element must be necessary. A setup implies a payoff [37].

**Agent rules [H].**

- Write the beat sheet with the connective word between beats. At least 70% of connectors should be "but" or "therefore".
- Every promise in the hook is paid off in the final 20% of the runtime.
- Every setup (a stat, a prop, a question) pays off.

### 2.4 Endings and calls to action

**Don't signal the end** in long-form. End on the payoff [26].

**Calls to action.**

- Specific CTAs ("Sign up", "Buy now", a search bar) beat vague ones [29] [P].
- Urgency helps: limited time or limited units [29].
- Delivered via a text card, simple animation, or voiceover [29].

**TikTok data [P].** CTA cards lifted recall 45% and likeability 19%. Showing the product on screen lifted brand affinity 65% and recall 25% [30].

**Music.** End on the final downbeat or the track's sting. Edit so the ending lands after the last line of dialogue. Do not stop mid-phrase [24] [S].

**Agent rules [H].**

- The payoff sits in the last 10 to 20%.
- Exactly one CTA.
- No dead tail longer than 1 s after the final beat in short-form.
- Shorts should loop: the last line flows back into the first. Reframer's shorts skill already does this.

### 2.5 Reference grammars: what to borrow

| Reference | Grammar worth borrowing | Watch out for |
|---|---|---|
| MrBeast long-form | Front-loaded first minute, progression over chronology, re-engagements around 3 and 6 min, simple stimulating middle, no end signal [26] | 2020–23 "overstim" style is now stale [28] |
| Hormozi-style shorts | Word-by-word captions, jump cuts, hook text [42] | Neon green/yellow strokes, emojis and constant whoosh/pop now read as "guru content" ("production blindness"). Newer "dynamic minimalism": clean sans, white text, accent color on keywords only, no emoji or sound-effect spam [42] [S] |
| Ali Abdaal | Calm pace, consistent grade, minimal animated text callouts, B-roll that makes abstract ideas concrete, slow zooms [41] [S] | Text on everything becomes noise |
| Vox explainers | Motion synced to narration; highlighter sweeps on documents; animated maps; flat limited palette; 12 fps stutter on graphics in a 24 fps edit; camera-blur transitions. Motion carries information, not decoration [39] [S] | Copying the textures without the information design |
| Johnny Harris | Handmade texture (paper, halftone, grain, light leaks, film burns), maps, graphics animated "on twos", deliberate imperfection [40] [S] | Texture is a style commitment: apply it to the whole piece or not at all |
| Apple product film | Say one thing per ad; most product ads are a short demo [43]. Slow reveals with light sweeping across edges; macro detail with deep focus; slow motion; minimal text [43]. The iPod silhouette ads used black silhouettes on single bright color fields, white earbuds, music-driven, near-zero text [43] [S] | Premium needs 0% overshoot and calm durations |
| Nike manifesto ("Dream Crazy", 2018, 30th anniversary of "Just Do It") | First-person manifesto voiceover (Kaepernick) over a montage of real athletes overcoming adversity, slow motion, a building score (Dustin O'Halloran's "We Move Lightly"), ending on one line plus logo [44] [S/H] | The manifesto must be earned by real people, not stock |
| Documentary interview film | Paper edit (selects with timecodes), then string-out, then radio cut (works with eyes closed), then picture. Or a scene-based cut for vérité material [45] [S] | Wall-to-wall talking heads; frankenbites |
| Micro-doc for brands, 2 to 3 min | Cold open with a stake (0–8 s), context through the subject (8–40 s), obstacle (40 s–2 min), turning point where the brand enters as a tool (2:00–2:30), resolution with verifiable outcomes [46] [S] | Summary voiceover instead of proof |
| Trailers | Rising three-act structure, title cards as punctuation, accelerating montage, a "button" after the title [19][20] [H] | Over-editing to hide weak material [19] |

---

## 3. Motion design and typography

### 3.1 Easing curves

| Family | cubic-bezier | Use | Source |
|---|---|---|---|
| Material 1 standard | (0.4, 0, 0.2, 1) | On-screen moves | [47] [P] |
| Material 1 deceleration | (0, 0, 0.2, 1) | Entrances | [47] |
| Material 1 acceleration | (0.4, 0, 1, 1) | Exits | [47] |
| Material 1 sharp | (0.4, 0, 0.6, 1) | Temporary exits | [47] |
| M3 standard | (0.2, 0, 0, 1) | Default UI motion | [48] [P] |
| M3 standard decelerate / accelerate | (0, 0, 0, 1) / (0.3, 0, 1, 1) | Enter / exit | [48] |
| M3 emphasized decelerate / accelerate | (0.05, 0.7, 0.1, 1) / (0.3, 0, 0.8, 0.15) | Hero and brand moments | [48] |
| easeOutCubic | (0.33, 1, 0.68, 1) | Gentle entrance | [49] [P] |
| easeOutQuint | (0.22, 1, 0.36, 1) | Confident entrance | [49] |
| easeOutExpo | (0.16, 1, 0.3, 1) | Crisp, premium entrance. Reframer's `smooth` preset | [49] |
| easeInOutCubic | (0.65, 0, 0.35, 1) | Moves between two on-screen positions | [49] |
| easeInOutQuart | (0.76, 0, 0.24, 1) | Stronger in-out, for camera pushes | [49] |
| easeInCubic | (0.32, 0, 0.67, 0) | Exits | [49] |
| easeOutBack | (0.34, 1.56, 0.64, 1) | Playful pop, about 10% overshoot (Penner c = 1.70158). Reframer's `overshoot` preset | [49] |

**Rules** [P/S]:

- Never use linear for spatial motion [50].
- Entrances decelerate, exits accelerate, and moves between two on-screen points use ease-in-out [47][48].
- Exits are shorter than entrances. Material uses 225 ms in and 195 ms out [47]. LottieFiles' motion skill makes entrances 30 to 50% longer than exits [50].
- After Effects' default Easy Ease is 33.33% influence. Motion designers push it to 60–75% for polished deceleration and 85–100% for dramatic moves [51] [S].

**Durations.** UI tokens run 50 to 1000 ms [48]. LottieFiles' tone archetypes [50] [S]:

| Tone | Duration | Overshoot |
|---|---|---|
| Premium | 350–600 ms | 0% |
| Corporate | 200–400 ms | 0–3% |
| Playful | 150–300 ms | 10–20% |
| Energetic | 100–250 ms | 15–30% |

Doubling the travel distance means roughly 1.3 times the duration [50].

**Video defaults at 30 fps [H].** Viewers did not trigger the motion and need time to read, so video runs about 1.3 to 2 times UI speed.

- Labels and small elements: 8 to 12 f.
- Titles: 12 to 20 f.
- Hero reveals: 20 to 30 f.
- Full-frame moves: 15 to 24 f.
- Exits: 60 to 80% of the entrance, or simply cut.

**Springs.**

- Remotion's default `spring()` config (mass 1, damping 10, stiffness 100, overshoot clamping off) bounces visibly. Raise damping to remove the bounce, and use `durationInFrames` to normalize timing [52] [P].
- Reframer's presets map onto this: `gentle` (damping 200) has no bounce, `snappy` (22/260/0.7) is tight, `bouncy` (8/120) and `playful` (12/160) are visibly elastic.

**Anticipation and follow-through.** These come from Disney's 12 principles [91]. A small counter-move before a big move. A slight overshoot and settle after it. Secondary elements trailing by a few frames.

Video defaults [H]:

- Anticipation at most 10% of the travel distance, over 2 to 4 f.
- Settle over 4 to 8 f.
- Only on hero or character elements, never on body text.

### 3.2 Choreography, hierarchy and direction

**Stagger and travel** [50] [S]:

- Stagger 50 to 100 ms per element (2 to 3 f at 30 fps), with the whole sequence under 400 to 600 ms.
- No more than a third of elements in active motion at once.
- No single move travels more than a third of the screen without a keyframe change.

**Hierarchy.** Eyes go to motion onsets and luminance changes [6]. Animate the most important element; keep secondary elements still or subtle.

**Direction vocabulary [H].**

- Pick one entrance direction per role and keep it for the whole piece. For example, titles rise from below, callouts slide from the side they point to, and counters and progress move left to right.
- Whips and pushes must follow the subject or camera direction.
- Never alternate directions at random.

Screen-direction continuity applies to graphics as much as to footage [84].

**Information, not decoration.** Every animation should land on the word that introduces its idea (narration-synced motion) [39] [S].

**Settle.** Put the motion in the first 10 to 15 frames of a shot, then hold still while text is read. Reframer's `motion-taste` skill already says this [H].

### 3.3 Safe areas

**16:9 broadcast (EBU R 95)** [53] [P]:

- Action-safe margin is 3.5% per edge.
- Graphics-safe margin is 5% per edge.
- At 1920×1080 that means 67 px left/right and 38 px top/bottom for action, 96 px left/right and 54 px top/bottom for graphics.

**9:16 platform UI** at 1080×1920. Numbers differ by platform and by organic versus paid placement [54][55] [S]:

| Platform (source) | Top | Bottom | Left | Right |
|---|---|---|---|---|
| TikTok organic [55] | 108 | 320 | 60 | 120 |
| TikTok in-feed ads (secondary) [55] | 150 | 440 | 60 | 60 |
| Instagram Reels organic [55] | 210 | 310 | 0 | 84 |
| Instagram / Facebook Reels ads [54] | 14% (about 269) | 35% (about 672) | 6% (about 65) | 6% (about 65) |
| YouTube Shorts [55] | 120 | 300 | 0 | 96 |
| One guide's universal box [55] | 900×1400 centered | | | |

**Agent default [H].**

- Keep text, faces and products inside x 90 to 950 and y 270 to 1440 for organic posts.
- For paid Reels and TikTok, keep y at or below 1250, so the bottom 35% stays clear.
- Never place captions over eyes or mouths.

Reframer's current rule is top 12%, bottom 22%, right 13%. That is close to TikTok organic but too low at the bottom for ads.

### 3.4 Typography in video

**Families and roles.**

- Use at most two families: one display, one text, with clear roles [64] [S].
- Avoid ornate and decorative faces [60].

**The template fingerprint.** The usual thumbnail and caption faces read as template when used by default: Impact, Bebas Neue, Montserrat, Anton, Burbank, Komika [92] [S]. Inter on a purple gradient with glassmorphism is the widely mocked "AI design slop" fingerprint [76] [S]. Choose type from the style and brand, not from the median.

**Size** [58][59] [S]:

- Body at least 40 to 60 px at 1080p for phone viewing.
- Titles at least 1.5 times body.
- Lines of 30 characters or fewer, at most 3 lines.
- Captions about 4 to 5% of frame height, around 44 px on a 1080-tall 16:9 frame.
- On 1080×1920, about 60 to 75 px, which is 3.1 to 3.9% of the height.

Reframer's `motion-taste` legibility table is already in this range.

**Contrast.** Letters must separate from the background for the whole shot. Use a stroke, shadow or scrim [58][64].

**Words per screen.**

- One idea per screen.
- Subtitles at most 42 characters per line and 2 lines (Netflix) [56] [P].
- Titles about 7 words per line or fewer [H, consistent with `motion-taste`].
- Do not repeat on screen what the voice is already saying, except as captions. Redundant text distracts [60].

**Reading speed** [P/S]:

- BBC: 160 to 180 wpm, which is 0.33 to 0.375 s per word [57].
- Netflix adult subtitles: at most 20 characters per second (17 for children). Each subtitle shows for at least 5/6 s (20 frames at 24 fps) and at most 7 s [56].
- legibility.info gives a conservative minimum dwell of 13 characters per second, so a 30-character line needs at least 2.3 s [58].
- Name supers need at least about 4 s to register, and more than 7 s is too long [60]. Lower-third guides span 3 to 7 s [87].

**Hold-time rule for non-spoken text [H].**

Hold at least the larger of 1.2 s or (0.35 s × words + 0.5 s).

| Words | Minimum hold |
|---|---|
| 1 to 2 | 1.2 s |
| 5 | about 2.3 s |
| 7 | about 3.0 s |
| 10 | about 4.0 s |
| 15 | about 5.8 s, which means split the card |

Text must be still while it is being read. Text animation should be discreet [58].

### 3.5 Kinetic typography: do and don't

**Do** [64] [S]:

- Readable faces.
- Hierarchy through size, color or motion on the one keyword.
- Sync to the audio.
- Simple, purposeful motion.
- Keep a consistent type system.

**Don't** [64] [S]:

- Too many fonts.
- Stacked effects.
- Dense screens where the next phrase arrives before the first is read.
- Weak contrast.
- Pacing that is too fast to read or so slow it bores.

**Agent defaults [H].**

- Use per-character effects (typewriter, scramble, wave) only on words of 12 characters or fewer, and at most once per piece.
- Use word-level staggers of 2 to 4 f.
- Never animate more than one text block at a time.

### 3.6 Captions that work now

**Why captions** [P/S]:

- In a 2019 Verizon Media and Publicis survey (n=5,616), 69% of consumers watch with sound off in public and 80% are more likely to finish a video with captions [61].
- Facebook found captioned video ads increase view time by 12% on average [62].
- On YouTube, 95% of video plays with sound on [29]. So captions are essential in social feeds, and for accessibility rather than survival on YouTube long-form.

**Effective current style** [63][68] [S]:

- Bold white sans-serif with a thin dark outline or shadow.
- 2 to 5 words at a time, or 1 to 3 for word-by-word.
- Highlight the active word.
- Lower-middle safe zone, kept out of the bottom 20% and away from the right edge.
- At most 2 lines.

**Tone shift.** Hormozi-style neon, emoji and sound-effect-per-word captions now trigger "guru content" scroll-away. Keep the mechanics and lose the noise [42] [S].

**Agent rules [H].**

- One caption style per video.
- At most one emphasized keyword per sentence.
- Emoji at most one per 10 s, or none for premium or serious tones.
- Captions synced within ±2 frames of speech.
- Never over faces.

### 3.7 Color grading: consistency and restraint

**Workflow** [65] [S]:

1. Balance each shot.
2. Match shots to a chosen hero shot, using scopes rather than just your eyes: waveform for exposure, RGB parade for neutral balance, vectorscope for saturation and the skin-tone line.
3. Only then apply the creative look.

**Restraint** [65] [S]:

- If a viewer notices the grade before the subject, it is too strong.
- Cullen Kelly's principles: simplicity beats complexity, broad adjustments beat narrow ones, macro beats micro. The colorist's work should be invisible.
- "Memory colors" such as skin and sky must stay in their natural range.

**Common mistakes** [65] [S]:

- Skipping balancing and matching.
- Crushed shadows and blown highlights.
- Oversaturated, "sunburnt" talent.
- Skin tones that make viewers wince.

**Teal and orange** [65] [S]. The look now reads as "an edit" rather than a photograph. If you use warm-cool separation, keep it subtle: a low-saturation warm push in the highlights only, minimal shadow cooling, reduced orange saturation on skin.

**AI tells.** Oversaturated, "video game" palettes and flat, uniform lighting are tells of AI-generated footage [74] [S]. Stock and AI clips must be graded to sit with the hero footage [78].

**Reframer `grade` defaults [H].**

- One look per piece: the same LUT at intensity 0.3 to 0.7.
- Per-shot grades only to match.
- Saturation 0.9 to 1.15 and contrast 0.95 to 1.15, unless the style specifies otherwise.
- Temperature shifts between shots of one scene of 0.1 or less on Reframer's -1 to 1 scale, unless motivated.
- Keep skin near the skin-tone line, with no crushed blacks on faces and no clipping on skin.

### 3.8 Zooms and punch-ins

**What they are for.**

- A punch-in is a tighter reframe of the same take, often done in post. It is used to create a "second angle" between answers or sentences, typically 15 to 20% [68] [S].
- Use them for emphasis only: the hook, an emotional line, a punchline, a section change. Effects on every line kill the emphasis [68] [S].
- A good pattern: a slow zoom that builds toward the end of a thought, then a snap back to wide [68].
- Meanings differ by type: a crash zoom emphasizes or gets a laugh, a slow push suggests focus or revelation, a zoom-out suggests isolation [68].

**Defaults [H].**

- Scale 1.08 to 1.20. Go above 1.25 only for chaotic or comedic styles.
- Do not exceed source resolution headroom: about 120% or less on 1080p sources.
- Short-form: 4 to 6 per minute or fewer. Long-form: 1 to 2 per minute or fewer.
- Slow push-ins of 3 to 8% across a held line.

**Ken Burns moves.** These animated pans and zooms on stills are valuable in documentary, where stills are all you have. On every image they read as lazy [89] [S]. Push toward the subject of interest, eased, 3 to 8% over the shot, and leave some stills static.

### 3.9 Grain, letterbox, vignette and texture

**Grain** [66] [S]:

- Use the minimum effective amount.
- Scale grain size with resolution; large grain at 4K is distracting.
- Check the output after platform compression. Heavy grain at low bitrates turns into blocky noise.

**Letterbox** [67] [S]:

- Fake 2.39:1 bars on 16:9 footage crop away captured image for a vibe.
- They are legitimate only when the shots were composed for that ratio.
- Never use them on vertical video.
- Reframer's style schema has a `letterbox` field, which should be gated accordingly.

**Vignette** [66] [H]. Subtle, to focus attention. If you notice it, it is too strong.

**Texture packs** (paper, halftone, light leaks, VHS). These belong to a declared style such as Johnny Harris or retro. Apply them consistently or not at all [40].

---

## 4. "AI slop" anti-patterns: what critics say, and how to detect them

**What critics and practitioners say** (paraphrased):

- Retention editing has saturated. When every video uses loud sound effects, sub-2 s cuts and no pauses, nothing stands out, and MrBeast himself reversed course [28] [S].
- The Hormozi caption style triggers "production blindness": viewers file it as hustle-guru content and swipe away [42] [S].
- AI tools default to mathematically even cuts and cut moment by moment without an integrated emotional arc. The result is technically correct but flat, with no hierarchy and templated pacing [79] [S].
- Coding agents producing motion graphics converge on the median tutorial: a centered headline fading up about 20 px on a purple-to-blue gradient, linear interpolation, everything entering at once, one scene tweened instead of cut [75] [S].
- One team that taught an agent post-production names the failure modes: technical correctness without visual hierarchy, templated pacing, color inconsistency despite shared presets, over-processing with unmotivated effects, and previews that look fine while the real render fails. Features only become professional when the agent can reason about why to use them [77] [S].
- AI video tells [74] [S]:
  - over-reliance on bland stock;
  - flat, uncanny lighting;
  - oversaturated synthetic palettes;
  - floaty camera with no micro-jitter;
  - lip-sync drift;
  - gibberish in-scene text;
  - a TTS "plateau" cadence: no breaths, every sentence at the same prosodic level.
- Editors' perennial notes [72] [S]:
  - cutting too soon;
  - overusing transitions;
  - jump cuts as a lazy patch;
  - adding sound too late;
  - too much music. If a scene feels boring it is probably badly edited, not short of music.
- Cheap stock clichés erode trust [78]. *This Is a Generic Brand Video* is the canonical parody [78].
- Flashy trailer editing can look like compensation for a weak product [19].

**Anti-pattern table.** Detectors are computable from the Reframer timeline unless marked "vision" or "LLM".

| # | Anti-pattern | Why it reads as slop | Detector [H] | Fix |
|---|---|---|---|---|
| 1 | Generic or keyword-literal stock unrelated to the meaning | Blandness and clichés [74][78] | B-roll specificity score (LLM + transcript): average below 2 or any 0; more than 30% of runtime from stock | Show the referent: user footage, screen recordings, real data, diagrams. Or hold on the speaker |
| 2 | Transition on every cut | Pros use cuts more than 99% of the time [12][72] | Non-cut transitions above 10% of edit points; same type repeated 3 or more times | Hard cuts, J/L cuts, match cuts |
| 3 | Random zooms and unmotivated camera moves | Kills emphasis; AI "floaty camera" [68][74] | Zoom/scale keyframes per minute over the cap; zooms not on emphasis words | Emphasis-only punch-ins; static is fine |
| 4 | Overused fonts, effects, templates | "Production blindness"; AI design fingerprint [42][75][76] | Font list vs. a blacklist; gradient background as main visual; `fade` as more than 50% of animations | Style-specific type, real assets, scale contrast |
| 5 | Text everywhere | Redundant text and caption walls [60][68] | More than 20% of runtime with 2 or more non-caption text layers; on-screen words above about 3 per second; text duplicating the VO | One text idea at a time; delete redundant text |
| 6 | Mismatched music | Fights the emotion; cut mid-phrase; too much music [24][72] | Music edit points not on bar lines; ending not on a downbeat; no dynamic change at act breaks | Choose by arc, edit at phrases, drop out for key lines |
| 7 | Robotic pacing | Even cuts, equal beats [79] | CV below 0.35; 5 or more equal-length runs; beats within ±10% of each other | Packets, holds, accelerate into the climax |
| 8 | Too many sound effects | Whoosh on every cut, ding on every text [71] | Sound effects per minute above the cap; effects not within ±1 f of a visible event | Motivated effects only; silence before impact |
| 9 | Inconsistent visual language | Mixed grades, caption styles, animation families [74][77] | More than 2 fonts, more than 1 caption style, more than 3 animation presets per role; per-shot grade deltas above tolerance | One style sheet per video |
| 10 | No breathing room | Retention noise; breathless speakers [28][69] | Inter-sentence gaps under 150 ms on more than 80% of sentences; no hold of 1.5 s or more in a 30 s window | Keep a 0.2–0.3 s floor and beats after claims |
| 11 | Emoji spam | Guru-content signal [42] | More than 1 emoji per 10 s | Remove; use emphasis color sparingly |
| 12 | Everything enters at once; one scene tweened | Median-tutorial look [75] | 3 or more elements starting on the same frame; fewer than 1 cut per 6 s in promos | Shots, staggers, cuts |
| 13 | Loop wiggles, drift and Ken Burns on everything | Unmotivated movement [89] | More than 30% of clips with loop animations | Motion only when it means something |
| 14 | Robotic TTS narration | "TTS plateau" [74] | n/a (listen) | Human VO, or expressive TTS with punctuation-driven pauses and varied emphasis |
| 15 | AI-image artifacts | Morphing hands, gibberish text [74] | Vision review of frames | Replace, crop, or cut shorter |
| 16 | Slow intro or logo first; hook doesn't match the title | Retention-killer openers [26][34] | Frame 0 black, static or logo; first claim after 3 s | Open on the strongest moment |
| 17 | Over-graded look | Teal-orange push, crushed blacks [65] | Saturation or contrast beyond bounds; clipping percentage | Balance, then match, then a subtle look |
| 18 | Fake letterbox; bars on vertical | Deletes image for "vibe" [67] | Letterbox on 9:16, or on shots not composed for it | Remove |
| 19 | Captions under UI or over faces | Unreadable, amateur [54][55] | Bounding box vs. safe zones and face boxes (vision) | Reposition |
| 20 | Weak ending | Fade to nothing; two CTAs; music cut mid-bar [24][29] | Last 2 s audio/visual check | Payoff, one CTA, musical resolution |

---

## 5. A director's workflow the agent can follow

Each stage lists what to decide, what the agent produces, and what "done" means. Never jump ahead to polish. Several sources describe the post-production stages this table is built on [45][80][81][82][83].

| Stage | Decide | Agent output in Reframer | Done when | Typical AI failure |
|---|---|---|---|---|
| 0. Brief | Objective, audience and insight, single-minded proposition, reasons to believe, desired response, tone, deliverables (platform, aspect, duration), mandatories, assets, approval [81] | `set_plan` step 1 summary; `ask_user` only for missing facts | The proposition fits in 20 words or fewer; specs are known | Starts building before knowing the one message |
| 1. Concept / angle | Tension or angle; reference grammar; style preset; what makes this not generic | One-sentence logline, chosen reference, `apply_style` | Logline of 25 words or fewer; at least 2 angles considered, 1 chosen with a reason | "Modern and sleek" adjectives instead of a concept [75] |
| 2. Beat sheet / script | Hook, promise, beats joined by but/therefore, open loops, payoff, CTA, timing; VO at 150–170 wpm [H] | Beat list with seconds and connectors | Read-aloud fits the target within ±10%; every beat has a job | Equal-length beats; "and then" structure |
| 3. Shot list and asset plan | For each beat: A-roll, B-roll, graphic or text; source priority (user footage, screen recordings, real data components, stock, generated); shot-size variety | Shot list with specificity scores; asset gaps flagged | No beat without a specific visual; B-roll specificity averages 2 or more | Keyword-literal stock; invented UI or data |
| 4. Rough cut (story) | Selects, string-out, radio cut, then lay picture. No effects, transitions or grading [45] | Timeline with dialogue/VO spine and placeholder visuals | Makes sense with eyes closed; story clear at full speed; runtime within +20% of target | Decorating first |
| 5. Fine cut (rhythm) | Trim heads and tails; cut on action or thought; J/L cuts; holds; shot-length distribution; cut 10–20% [H] | Updated timeline plus rhythm metrics | Metrics in band (section 6); no dead air; picture lock | Uniform cuts; no holds |
| 6. Graphics, text, captions | Type system, titles, lower thirds, callouts, captions, motion vocabulary, safe zones | Text, component and caption clips with notes | Legibility, reading time and safe-zone checks pass; at most 1 text idea at a time | Text everywhere; centered gradient headline |
| 7. Sound and music | Music choice by arc and tempo; edit to phrases; ducking; ambience/room tone; motivated sound effects; silence | Audio clips with `role` and `duck`; music edits on bars | Loudness on target; VO intelligible on a phone speaker; music resolves | Whooshes everywhere; music drowning the VO |
| 8. Color and texture | Balance, match, look; skin; texture last and subtle | Grade effects; one LUT | Shot deltas within tolerance; no clipping on skin | Over-grading; mismatched stock |
| 9. QC and critique | Contact sheet, cut frames, first and last 3 s, metrics, rubric score, fix worst 3, render-file check [77][83] | `review_frames`, scorecard to user | Rubric score of 80 or more and no red flags | Declaring done from the preview |

**How a senior editor reviews a cut.** Adapt these into agent passes [82] [S]:

1. Watch straight through once without stopping, noting where attention drifts, what confuses, and where you lean in.
2. Do a sound-only pass. The radio-cut test: does it still work with the picture off?
3. Do a picture-only pass.
4. Watch in black and white to judge composition without color.
5. Watch without temp music, which hides weak editing.
6. Watch at phone size and muted, to apply Murch's screen-scale lesson to the actual device [25].
7. Frame-step every cut, checking -2, 0 and +2 frames, for flash frames, and for text landing on the cut [83].

---

## 6. Senior-editor review: metrics and thresholds

These thresholds are [H] defaults, calibrated against the evidence above. Tune them per style preset. "Auto" means computable from the timeline or the render.

| Area | Measure | Pass | Warn | Fail | Auto? |
|---|---|---|---|---|---|
| Hook | Frame 0 is content (not black, logo or static) | yes | n/a | no | render frame 0 + LLM |
| Hook | First spoken or visual claim | 1.5 s or less | 1.5–3 s | over 3 s | transcript |
| Hook (ads) | Visual changes in the first 5 s [29] | 2 or more | 1 | 0 | timeline |
| Hook (ads) | Brand or product visible | within 5 s [29] | 5–10 s | over 10 s | vision |
| Structure | Beat connectors that are but/therefore [36] | 70% or more | 50–70% | under 50% | LLM on beat sheet |
| Structure | Hook promise paid off in the last 20% | yes | late or partial | no | LLM |
| Pacing | ASL within the format band (section 1.8) | inside | ±25% outside | beyond that | timeline |
| Rhythm | Median ÷ mean shot length | 0.45–0.85 | 0.85–0.95 | over 0.95 (uniform) | timeline |
| Rhythm | CV of shot lengths | 0.5–1.2 | 0.35–0.5 or 1.2–1.6 | under 0.35 | timeline |
| Rhythm | Longest run of shots within ±10% duration | 4 or fewer | 5–6 | 7 or more (unless bar-locked montage with section changes) | timeline |
| Rhythm | Longest static stretch (short-form) | 3 s or less, or a deliberate hold of 6 s or less | 3–5 s undeclared | over 5 s undeclared | timeline + motion |
| Breath | Holds of 1.5 s or more after key claims, per 30 s (short-form) | 1 or more | n/a | 0 | timeline + transcript |
| Pauses | Inter-sentence gaps [69] | 0.2–0.5 s | 0.1–0.2 s | under 0.1 s on more than 80% of sentences | transcript |
| Transitions | Non-cut share of edit points [12] | 10% or less (5% or less for doc/premium) | 10–25% | over 25% | timeline |
| Transitions | Distinct non-cut types | 2 or fewer | 3 | 4 or more | timeline |
| B-roll | Specificity average (0–3) | 2 or more, no zeros | 1.5–2 | under 1.5 or any 0 | LLM + transcript + vision |
| Text | Hold time vs. words: max(1.2 s, 0.35 s/word + 0.5 s) | all pass | 1–2 under | 3 or more under | timeline |
| Text | Simultaneous non-caption text blocks | 1 | 2 briefly | 2 or more for over 20% of runtime | timeline |
| Text | Size (9:16) | captions 60 px or more; titles 80 px or more | 48–60 px | under 48 px | timeline |
| Safe zones | Text, captions, faces in the safe box | 0 violations | n/a | any critical text violation | timeline + vision |
| Type | Font families / caption styles | 2 or fewer / 1 | 3 / 2 | 4 or more / 3 or more | timeline |
| Motion | Linear spatial keyframes (excluding tickers and drifts) | 0 | 1–2 | 3 or more | timeline |
| Motion | Exit duration ÷ entrance duration | 0.6–0.8, or cut | 0.8–1.0 | over 1.0 | timeline |
| Motion | Elements entering on the same frame | 2 or fewer | 3 | 4 or more | timeline |
| Zoom | Punch-ins per minute (short / long) | 6 or fewer / 2 or fewer | 7–10 / 3–4 | over 10 / over 4 | timeline |
| Loudness | Integrated level for web [70] | -14 LUFS ±1 | ±2 | beyond ±2 | ffmpeg ebur128 |
| Loudness | True peak [70] | -1 dBTP or lower | -1 to 0 | above 0 | ffmpeg |
| Mix | Voice-over-music gap (short-term loudness) [70] | 15 dB or more | 10–15 dB | under 10 dB | render analysis |
| Music | Edit points on bar lines; ending on downbeat or sting [24] | all | 1 off | mid-phrase ending | beat markers |
| SFX | Per minute, short / long [71] | 6–8 or fewer / 12 or fewer | +50% | double | timeline |
| SFX | Aligned to a visible event within ±1 f | 100% | 90% or more | under 90% | timeline |
| Color | Within-scene exposure delta | 0.25 stop or less | 0.25–0.5 | over 0.5 | render analysis |
| Color | Clipped pixels on skin / crushed faces | 0 | n/a | any | vision |
| QC | Flash frames, black frames, 1-frame gaps [83] | 0 | n/a | any | timeline |
| QC | Spelling of names, brands, numbers | 0 errors | n/a | any | LLM + OCR |
| QC | Caption sync | within ±2 f | ±3–4 f | over ±4 f (about 133 ms) | transcript |

---

## 7. Gap analysis against Reframer's current agent rules

I read `src/agent/prompt.ts`, `src/agent/skills/motion-taste.md`, `self-review.md`, `shorts-captions.md`, `src/core/schema/clip.ts`, `src/core/easing.ts` and `src/core/styles/presets/archetypes.ts`. I did not modify anything.

**What is already strong.**

- Legibility minimums.
- Easing presets: `smooth` is easeOutExpo; `apple`, `gentle` and `overshoot` exist.
- The ban on the centered gradient headline.
- Text hold of 0.3 s per word + 0.6 s.
- -14 LUFS.
- Music ducking.
- A contact-sheet review loop.
- Caption grouping.
- Hook by frame 3.

**What is missing.** This is the editorial brain the founder is asking for:

1. Story logic: but/therefore, open loops, setup and payoff, expectation match, re-engagement points.
2. Cut placement craft: cut on action and on thought completion, eye-trace with center bias, J/L cuts as the default alternative to transitions, match cuts, reaction cuts.
3. B-roll semantics: the specificity scale, the cliché blacklist, stock matching.
4. Rhythm as distribution: median/mean, CV, packets, holds and breaths. The current rules only constrain speed ("something new every 2–4 s"), which pushes the agent toward metronomic cutting.
5. Pause preservation: the archetypes set `maxSilenceMs` to 100–150 for several talking-head styles, below the 200–300 ms natural floor practitioners recommend [69].
6. Stage gates: there is no rule against polishing before the story cut works.

**Defaults that push toward slop, with suggested changes [H].**

| Current rule (file) | Issue | Suggested change |
|---|---|---|
| "Transitions on ≤25% of cuts" (`motion-taste`, `self-review`) | Film uses cuts more than 99% of the time [12]. 25% invites decoration | 10% or less (5% or less for doc, premium and talking head); each non-cut needs a note giving its reason |
| "Something new every 2–4 s; no static stretch over 3 s" (`motion-taste`) | Uniform timer leads to robotic rhythm; forbids emotional holds | Keep for promos and shorts, but require CV 0.5–1.2, packets, and at least one 1.5 s+ hold per 30 s. Allow deliberate holds up to 6 s |
| Prompt: "SFX on cuts and hits" | Encourages a whoosh on every cut | "SFX only on visible, motivated events; never on hard cuts by default" |
| `shorts-captions`: "an overlay every 5–8 s"; "a whoosh on a punch-in" | Text everywhere; whoosh tell | Overlays only when they add information. Whoosh only on animated moves, at most 1 per 15 s |
| `shorts-captions`: "3 value beats of ~6 s each" | Equal beats | Escalating beats of unequal length (e.g., 4 / 7 / 9 s) with an open loop |
| Archetype `base-talking_head_short`: punch-in 1.25 at 10/min, `maxSilenceMs` 100 | Hormozi-era density; breathless speech | Punch-in 1.12–1.2 at 4–6/min on emphasis words; `maxSilenceMs` 250 with beats kept after claims |
| Archetypes `base-retention_entertainment` and `base-talking_head_premium`: `maxSilenceMs` 150 | Breathless | 200–300 |
| Prompt and `shorts-captions` safe zones: bottom 22% / 420 px | Too low for paid Reels and TikTok ads [54] | Keep 420–480 px for organic; add 35% (y ≤ 1250) for ads |
| Captions: "Montserrat or Inter 800–900" | Template sameness [76][92] | Derive from the style preset; Montserrat/Inter only as fallback |
| `self-review` scoring | No story, B-roll or rhythm-variance dimensions | Add the rubric below, or merge its story and edit items into `self-review` |

**Product suggestions [H].** These are small and high-leverage.

- Compute the section 6 metrics in a `review_timeline` tool, so the agent stops estimating rhythm by eye.
- Persist the one-line "edit reason" in `meta.note` for every transition, zoom and sound effect. Absence of a reason should be a lint warning.
- Add a beat sheet object to the plan, holding connectors, timing and promise/payoff links. Plan mode already proposes storyboards.
- Measure loudness on the real render (ffmpeg `ebur128`), not on clip volumes.

---

## 8. Agent skill draft

This is written as instructions to the AI editor, and is under 250 lines. It is meant to sit beside `motion-taste` and `self-review`. Where it conflicts with them, the founder should decide; this draft follows the research above.

````markdown
---
name: editor-taste
description: Load for any assembly, recut, edit or review. The editor-director's judgment: story first, motivated cuts, rhythm with variance, B-roll that means something, restraint. Pair with motion-taste (type and motion details) and self-review (critique loop).
---

# Editor-director taste

You are the editor and the director, not a decorator. Viewers forgive plain. They punish noise.
Every cut, transition, zoom, SFX, text and effect needs a job you can say in one line:
emotion, story, information, rhythm or eye-trace. Write it in the clip note. No job means delete it.
When rules conflict, follow Murch's order: emotion > story > rhythm > eye-trace > screen geometry > spatial continuity.
Frames assume 30 fps. All numbers are defaults. A style preset may override them, but never the order of work.

## 0. Order of work — never polish before the story works
1 Brief → 2 Angle → 3 Beat sheet → 4 Shot and asset plan → 5 Rough cut (story) → 6 Fine cut (rhythm)
→ 7 Text and captions → 8 Sound and music → 9 Color → 10 QC and critique.
- Put these stages in set_plan. A stage is done only when its gate passes.
- No transitions, effects, grades, SFX or animated text before stage 6 passes.

## 1. Brief and angle
Gate: a one-sentence promise.
- Extract: audience, platform and aspect, target duration, the one message, the desired action, tone, mandatories, real assets.
- Write the promise in ≤20 words: "After watching, the viewer will ___."
- One message per video. Saying three things means the viewer remembers none.
- Pick an angle with tension: a result shown first, a contrarian claim, a problem in motion, a question, or a story already under way.
- Name one reference grammar (Apple product film, Vox explainer, MrBeast, documentary, Nike manifesto, Ali Abdaal calm).
  Call apply_style if a preset matches.
- Ask the user only for missing facts (claims, numbers, names, CTA). Otherwise decide.

## 2. Beat sheet
Gate: a causal chain and a payoff.
- Write one line per beat, with seconds.
- Join beats with BUT or THEREFORE. If "and then" fits between two beats, merge one or cut it.
- Required beats:
  - Hook (0–3 s): tension or a payoff promise.
  - Promise or setup by 5 s.
  - Escalating body.
  - Payoff in the final 20%.
  - Exactly one CTA.
- Close every loop you open. Pay off every setup. Deliver everything the hook promised.
- Short-form (≤60 s): a new information beat every 5–10 s. Make beat lengths unequal (vary ±40%). Escalate.
- Long-form:
  - The first 60 s get the best material and fast progress (show, don't announce).
  - Re-engage every 60–180 s (reveal, escalation, new place, new chapter).
  - Never signal the ending early.
- VO runs 150–170 wpm (2.5–2.8 words/s). If you are over length, cut beats. Do not speed the pace.

## 3. Shot and asset plan
Gate: every beat has a specific visual.
- For each beat choose A-roll (speaker, product, action), B-roll, a graphic, or a text card.
- Source priority: user footage > screen recordings and screenshots > components with real data > stock > generated imagery.
- Score every B-roll shot from 0 to 3:
  - 3 = the exact referent;
  - 2 = a concrete example or evidence;
  - 1 = generic category;
  - 0 = unrelated mood, or contradicts the words.
  Average ≥2, no 0s, ≤20% scored 1.
- Banned stock unless asked for: skyline handshakes, glass towers, laptop in a café, people pointing at screens,
  generic data HUDs, globe spins, "teamwork" high-fives.
- Vary shot size (wide / medium / close). Two consecutive same-size shots of the same subject make a jump cut — use one only on purpose.
- Add a graphic only for information: a number, a comparison, a sequence, a location, a quote.

## 4. Rough cut: story only
Gate: it works at full speed and with eyes closed.
- Build the radio cut first: VO, interview or dialogue selects in story order. It must make sense with no picture.
- Talking footage:
  - Remove false starts, repeats and fillers.
  - Trim gaps longer than 0.5 s to 0.2–0.3 s.
  - Keep 0.4–0.8 s before reveals and after claims that must land.
  - Never strip every pause.
- Interview bite length: social 3–8 s, news-style 8–15 s, documentary 20–40 s.
  Condensing is fine. Never splice words into a meaning the speaker did not express.
- Lay picture over the radio cut. Use no transitions, effects, grades or SFX yet. Temp music stays low.
- At this stage the runtime may run up to 20% over target.

## 5. Fine cut: rhythm
Gate: metrics in band, nothing dead.
- Cut where a thought completes, the moment the viewer would blink. Cut on action:
  enter the move 2–4 f into shot A and continue it in shot B.
- After a cut the eye snaps to center. In shots under 1.5 s, keep the subject in the central 60% of the frame
  or near the previous shot's focal point.
- Use split edits before reaching for transitions:
  - J-cut (audio leads) 0.5–2 s at scene changes.
  - L-cut 4–12 f in dialogue.
  - Cut to a reaction while someone is still talking.
- Average shot length bands (punch-ins and B-roll count as shots):
  - bumper 6–15 s: 0.8–1.5 s
  - ad 15–30 s: 1.2–2.0 s (TV ads ≈ 1.5–1.7 s)
  - shorts and Reels talking head: a visual change every 1.5–4 s
  - trailer or hype montage: 0.8–2 s, with holds
  - YouTube entertainment: 1.5–3 s
  - explainer or talking head: 3–8 s
  - tutorial or screen recording: 5–9 s
  - documentary or brand film: 3–6 s
  - product film: 2–4 s, with 3–5 s hero holds
- Variance matters more than speed. Real edits are right-skewed: many short shots, a few long ones.
  - Target median/mean 0.45–0.85 and a coefficient of variation of 0.5–1.2.
  - Never ≥5 consecutive shots within ±10% of each other's length. A bar-locked music montage is the exception,
    and even then change the cut rate between sections.
  - Work in packets: fast packets for action and lists, slower packets for emotion and explanation.
    Accelerate into the climax, then hold.
- Holds: 1–2 s after a reveal, punchline or key number. 2–5 s on emotional or hero moments.
  Short-form needs at least one breath of ≥1.5 s per 30 s.
- Trim 10–20% of the rough-cut runtime. A shot ends when it stops giving information, emotion or motion,
  usually 0.5–2 s before your first instinct.
- Jump cuts are fine in talking heads. Disguise every 2nd or 3rd one with a punch-in (1.10–1.20) or B-roll.
  Never cut mid-word.

## 6. Transitions — the hard cut is the default
- Make ≥90% of edit points hard cuts. Documentary, talking head and premium work: ≥95%. (Film uses cuts >99% of the time.)
- Every non-cut transition needs a reason in its note:
  - fade, 12–30 f: time passing, memory or a soft montage. Use 4–8 f only to soften a jump.
  - dip-to-black, 12–24 f: a chapter end or a big time skip. At most 3 per piece.
  - whip, push or slide, 6–10 f: only when it matches the direction of on-screen motion. At most 1 per 20 s.
  - zoom, spin, flip, glitch, iris, clock-wipe, flash or light-leak: only when the style calls for it
    (gaming, retro, music video). At most 1 per 30 s, and never as a default.
- Use at most 2 non-cut types per piece. Never put a transition on every cut.
- Match cuts (shape, motion, sound) are the premium move. At most 2 per piece, each linking two ideas.

## 7. Text, graphics and captions
Gate: legible, timed and safe.
- One text idea on screen at a time; captions count as one.
- Titles ≤7 words per line. At most 12 words on screen at once.
- Do not put on screen what the voice already says (captions excepted). Text adds a number, a name or a label, or it goes.
- Hold non-spoken text for ≥ max(1.2 s, 0.35 s × words + 0.5 s). Name supers: 4–6 s.
  Text stays still while it is being read.
- Bring text in 3–6 f after a cut, never on the cut frame. Do not let text straddle a cut by less than 6 f.
- Captions for social:
  - 1–4 words per page, ≤2 lines, synced within ±2 f.
  - One style per video.
  - At most one emphasized word per sentence.
  - Emoji at most 1 per 10 s (none for premium or serious tones).
  - Never over a face.
- Safe areas:
  - 16:9: graphics-safe is 5% per edge (96 px left/right, 54 px top/bottom at 1080p).
  - 9:16: keep text and faces inside x 90–950, y 270–1440.
  - Paid Reels and TikTok: keep the bottom 35% clear (y ≤ 1250).
- Type system:
  - ≤2 families and ≤3 sizes per screen.
  - Title ≥1.5× body.
  - The same role keeps the same style, position and animation for the whole video.
- Take typefaces from the style or brand. Use Impact, Bebas, The Bold Font, Komika or Inter on a purple gradient
  only if the brand demands it.

## 8. Motion (details in motion-taste)
- Never use linear easing on spatial moves.
  - Entrances: smooth (expo out) or cubic-bezier(0.22,1,0.36,1).
  - Exits: cubic-bezier(0.3,0,1,1).
  - Moves on screen: cubic-bezier(0.65,0,0.35,1).
- Durations:
  - small elements 8–12 f, titles 12–20 f, hero reveals 20–30 f;
  - exits 60–80% of the entrance, or a cut;
  - twice the distance needs about 1.3× the duration.
- Overshoot by tone: premium 0% (gentle), corporate ≤3% (snappy), playful ≤10% (overshoot, playful), energetic ≤20%.
  Never on body text or UI chrome.
- Stagger 2–4 f per word or item, with the whole sequence ≤0.6 s.
  Keep ≤1/3 of elements moving at once: the most important thing moves, the rest stays still.
- Keep one entrance direction per role for the whole video. Progress reads left to right.
  Whips and pushes follow subject or camera motion.
- A camera move needs a reason: follow action, reveal, or build intensity.
  - A slow push-in is 3–8% across a held line. Snap back to wide at a section change.
  - Do not put drift, Ken Burns or loop wiggles on every still.
- Punch-ins: 1.08–1.20, only on emphasis words or at sentence breaks. Short-form ≤6/min, long-form ≤2/min.
  Never zoom on every sentence.

## 9. Sound and music
Gate: the voice is clear on a phone speaker.
- Choose music by the arc's emotion first, then by tempo: calm 60–90 BPM, explainer and vlog 90–120, shorts and hype 120–160.
  Corporate ukulele and whistling only if the brief asks for it.
- Edit music:
  - Cut at phrase boundaries (4 or 8 bars), just before the downbeat.
  - Land the hero moment on a downbeat or the drop.
  - End on the final hit or a resolution, never mid-phrase, and never a lazy fade-out.
- Cut picture to bars during builds and to beats only for payoffs. Never cut on every beat for more than about 4 bars.
- Loudness:
  - Web and social: -14 LUFS integrated, true peak ≤ -1 dBTP.
  - Broadcast: EBU -23 LUFS.
  - Netflix: -27 LKFS, dialog-gated.
- Music bed sits 18–25 dB under the voice. Duck it 12–18 dB when speech starts
  (attack 30–80 ms, release 250–700 ms).
- SFX only on visible, motivated events (impact, object motion, UI click, reveal), within ±1 f.
  - Shorts ≤6–8/min; long-form ≤12/min.
  - No whoosh on a hard cut, no ding on every text, no riser before every beat.
- Use silence. Drop the music 0.3–1 s before a key line or an impact, and let one moment play on natural sound.
- Keep room tone or ambience continuous under jump cuts. Put a 2–4 f audio fade on every audio edit to avoid clicks.

## 10. Color and texture
- Balance → match → look. Pick a hero shot and match the others to it (exposure, white balance, saturation, skin).
- One look per video: the same LUT, intensity 0.3–0.7. Grade individual shots only to match.
  Skin stays natural. Never crush blacks on faces or clip skin.
- The viewer must not notice the grade before the subject.
  Keep saturation 0.9–1.15 and contrast 0.95–1.15 unless the style says otherwise.
  Teal and orange only at low saturation.
- Grade stock, AI and screen footage so it sits with the hero footage.
- Texture (grain 0.03–0.06, vignette 0.15–0.3, halftone or paper) is a style decision: all or nothing.
  No fake letterbox on vertical video. Use 2.39 bars only when the shots were framed for them.

## 11. Anti-slop sweep — delete on sight
- Transitions on many cuts, the same transition repeated, a whoosh on every cut.
- Uniform shot lengths, equal-length beats, text or B-roll changing on a fixed timer.
- Keyword-literal or generic stock; B-roll that contradicts the voice.
- Zooms, drifts, shakes or wiggles without a reason; everything entering or moving at once.
- Text everywhere: text duplicating the VO, caption walls, overlays every few seconds, emoji spam.
- A centered headline fading up on a purple-blue gradient; Inter on glassmorphism; default template fonts.
- Music that fights the emotion, cuts mid-phrase, drowns the voice, or never changes dynamics.
- No breathing room: every pause removed, no holds, no silence.
- An oversaturated "AI" palette, a teal-orange push, mismatched grades.
- A slow intro, a logo first, "hey guys", a hook that doesn't match the title or brief.
- An ending that fades to nothing, or that has two CTAs.

## 12. Before you say done (then run self-review)
- review_frames passes:
  1. a contact sheet every 0.5 s;
  2. every cut at −2, 0 and +2 frames;
  3. the first 3 s frame by frame;
  4. the last 3 s.
- Compute:
  - ASL, median/mean, CV, longest equal-length run, longest static stretch;
  - non-cut share of edit points, text hold vs. words, safe-area violations, fonts;
  - SFX per minute, punch-ins per minute, loudness.
- Score with the critique rubric (100 pts). Ship at ≥80 with no red flags.
  Otherwise fix the 3 largest point losses and re-check. Stop after 3 loops and report what remains.
- Report: the score, the 3 fixes you made, and what better assets or more time would improve.
````

---

## 9. Critique rubric (scored checklist)

Use this after every major pass. Score from evidence (frames, transcript, timeline metrics), never from intent. The total is 100.

- **Ship:** 80 or more, with no red flags.
- **Excellent:** 90 or more.
- **Below 70:** go back a stage. Usually that means the beat sheet or the fine cut, not polish.

Scoring per item:

- Full points if the "full" condition holds.
- Half points (rounded down) if the "half" condition holds.
- Zero otherwise.

**A. Story and intent (30 pts)**

| ID | Item | Pts | Full | Half |
|---|---|---|---|---|
| A1 | Single-minded message | 5 | The promise is clear in one sentence; every beat serves it | One digression or a second message |
| A2 | Hook (0–3 s) | 8 | Frame 0 is content; claim or visual by 1.5 s; tension by 3 s; ads have 2+ visual changes and brand by 5 s | Hook present but lands at 3–5 s, or weak framing |
| A3 | Causal structure and escalation | 5 | 70% or more of connectors are but/therefore; stakes rise; beats are unequal lengths | 50–70%, or flat middle |
| A4 | Loops and payoffs | 4 | Every opened question and setup pays off; long-form re-engages every 60–180 s | One loose end |
| A5 | Ending and CTA | 4 | Payoff in the last 20%; one specific CTA; no dead tail over 1 s; music resolves | CTA vague or doubled, or tail 1–2 s |
| A6 | Expectation and brief match | 4 | Delivers the title/brief promise and the platform spec (duration ±10%, aspect) | Minor drift |

**B. Picture edit and rhythm (25 pts)**

| ID | Item | Pts | Full | Half |
|---|---|---|---|---|
| B1 | Pace fits format | 3 | ASL inside the band for the format | Within ±25% of the band |
| B2 | Rhythm variance | 6 | Median/mean 0.45–0.85; CV 0.5–1.2; longest equal run 4 or fewer; packets with acceleration and a breath | One metric in warn |
| B3 | Cut quality | 5 | Cuts on action or thought completion; split edits at scene changes; no mid-word cuts; jump cuts disguised | 1–2 clumsy cuts |
| B4 | Transition discipline | 4 | 90% or more hard cuts (95% for doc/premium); at most 2 non-cut types; each has a reason | 75–90% hard cuts |
| B5 | B-roll meaning | 5 | Specificity average 2 or more, no 0s, no clichés, stock matched to hero footage | Average 1.5–2 |
| B6 | Breathing room | 2 | Holds after key moments; inter-sentence gaps 0.2–0.5 s; at least one breath per 30 s | Breathless in places |

**C. Graphics, text and motion (20 pts)**

| ID | Item | Pts | Full | Half |
|---|---|---|---|---|
| C1 | Text economy | 4 | One text idea at a time; no redundant text; titles 7 words per line or fewer | Occasional clutter |
| C2 | Legibility and timing | 5 | Sizes at or above minimums; contrast with stroke, shadow or scrim; every hold at or above max(1.2 s, 0.35 s/word + 0.5 s); text still while read | 1–2 holds short |
| C3 | Safe areas | 3 | All text, captions and faces inside the safe zones (16:9: 5%; 9:16 platform box) | n/a. Any critical violation is a red flag |
| C4 | Style-system consistency | 3 | 2 families or fewer; one caption style; same role, same style and animation; one accent | One inconsistency |
| C5 | Motion quality | 3 | No linear spatial moves; entrances decelerate, exits shorter; overshoot matches tone; stagger; one-third rule; consistent direction | Minor violations |
| C6 | Zoom and camera discipline | 2 | Punch-ins only on emphasis and within the per-minute cap; camera moves motivated | Slightly over cap |

**D. Sound (15 pts)**

| ID | Item | Pts | Full | Half |
|---|---|---|---|---|
| D1 | Loudness and intelligibility | 5 | -14 LUFS ±1 (or delivery spec); true peak -1 dBTP or lower; voice 15 dB or more above music; clear on a phone speaker | ±2 LU, or a 10–15 dB gap |
| D2 | Music fit and edit | 5 | Emotion and tempo fit the arc; edits on bars and phrases; dynamics follow acts; ending on a resolution | One rough music edit |
| D3 | SFX and ambience | 5 | Per-minute count within cap; 100% motivated within ±1 f; silence used before impacts; continuous room tone; no clicks | A few unmotivated effects |

**E. Image and QC (10 pts)**

| ID | Item | Pts | Full | Half |
|---|---|---|---|---|
| E1 | Color consistency and restraint | 5 | One look; shots matched within scene (exposure delta 0.25 stop or less); natural skin; no clipping or crush; texture subtle and consistent | One visible mismatch |
| E2 | Technical QC | 5 | No flash or black frames or gaps; spelling verified; captions synced within ±2 f; correct fps, resolution and aspect; checked on the rendered file | One minor defect |

**Red flags.** Any one of these blocks shipping, whatever the score:

1. A misspelled name, brand or number on screen.
2. Audio true peak above 0 dBTP (clipping), or music masking speech (gap under 10 dB).
3. Critical text or captions under the platform UI, or over a face.
4. Frame 0 is black, a logo or static, or nothing meaningful happens in the first 2 s.
5. Non-cut transitions on more than 25% of edit points.
6. B-roll that contradicts the voiceover, or any B-roll scored 0.
7. A flash frame or an unintended black frame.
8. Captions out of sync by more than 4 frames.
9. Invented UI, metrics, logos, testimonials or reviews presented as real.
10. A human-edited clip changed without permission. This is already a Reframer rule.

**Scorecard template for the user:**

```
Score 84/100 (A 26, B 21, C 17, D 12, E 8). Red flags: none.
Fixed: (1) replaced 6 crossfades with hard cuts + 2 J-cuts; (2) re-cut beats 3-5 to break a 7-shot equal run (CV 0.31 -> 0.74);
(3) swapped 3 generic stock clips for screen recordings (B-roll specificity 1.4 -> 2.3).
Remaining: music ends 4 f after the last bar (needs a re-edit of the outro); product shot at 0:12 is soft.
Needs your confirmation: the "50% faster" claim at 0:08.
```

---

## Sources

Evidence tags in the body show which sources are [P] primary or [S] secondary.

1. Cut Daily, "What Walter really meant by the Rule of Six": https://www.cut-daily.com/what-walter-really-meant-with-the-rule-of-six/
2. PremiumBeat, "When and where to make the cut" (Murch): https://www.premiumbeat.com/blog/when-and-where-to-make-the-cut-inspired-by-walter-murchs-in-the-blink-of-an-eye/
3. Mike Battle, *In the Blink of an Eye* book notes: https://www.mikebattle.com/book-notes/in-the-blink-of-an-eye
4. No Film School, Rule of Six for non-narrative content: https://nofilmschool.com/editing-emotion-using-walter-murchs-rule-six-non-narrative-content
5. No Film School, "Editing with an eye-trace in mind": https://nofilmschool.com/2018/08/editing-eye-trace-mind-rule-six-incorrect
6. Tim J. Smith, Aeon, "How filmmakers push your eyes around the screen": https://aeon.co/essays/how-filmmakers-push-your-eyes-around-the-screen-at-will
7. Smith, "The Attentional Theory of Cinematic Continuity": https://ualresearchonline.arts.ac.uk/id/eprint/21187/2/6679.pdf
8. Wikipedia, Cutting on action: https://en.wikipedia.org/wiki/Cutting_on_action
9. J-cuts and L-cuts:
   - https://en.wikipedia.org/wiki/J_cut
   - https://en.wikipedia.org/wiki/L_cut
   - https://loopdesk.ai/blog/j-cut-and-l-cut-explained
   - https://www.soundstripe.com/blogs/a-video-editors-guide-to-j-cuts-and-l-cuts
10. StudioBinder, Match cuts: https://www.studiobinder.com/blog/match-cuts-creative-transitions-examples/
11. Jump cuts and the 30-degree rule:
    - https://en.wikipedia.org/wiki/Jump_cut
    - https://en.wikipedia.org/wiki/30-degree_rule
    - https://klap.app/blog/jump-cut-definition
12. Cutting, DeLong and Nothelfer (2010), "Attention and the Evolution of Hollywood Film", *Psychological Science*: https://jordandelong.com/pubs/2010/AttentionEvolution.pdf
13. Cinemetrics, Cutting on 1/f shot structure: https://cinemetrics.uchicago.edu/article/590235ff-85aa-4714-9553-71d4c44fd61c
14. Cinemetrics, Barry Salt on lognormal shot-length distributions: https://cinemetrics.uchicago.edu/article/4bae8cac-cceb-452a-b6e6-1aa2df4fa76a
15. Wikipedia, Post-classical editing (Bordwell figures): https://en.wikipedia.org/wiki/Post-classical_editing
16. Film Editing Pro, "Fast vs. Slow: Video Editing Pacing Tips": https://www.filmeditingpro.com/fast-vs-slow-video-editing-pacing-tips/
17. Xie et al., "AdSum" (AdSum204 dataset), arXiv 2510.26569: https://arxiv.org/pdf/2510.26569
18. "Camera shot length in TV commercials and their memorability and persuasiveness" (Gale): https://link.gale.com/apps/doc/A13980912/AONE?u=googlescholar&sid=AONE&xid=bd8a2091
19. Derek Lieu, "More Trailer Editing is not Better Trailer Editing": https://www.derek-lieu.com/blog/2023/4/23/more-trailer-editing-is-not-better-trailer-editing
20. Stephen Follows, average movie trailer length: https://stephenfollows.com/p/long-average-movie-trailer
21. CutScore, "How fast should I cut my video?": https://cutscore.io/blog/how-fast-should-i-cut-my-video
22. Wikipedia, Dissolve (filmmaking): https://en.wikipedia.org/wiki/Dissolve_(filmmaking)
23. Kuleshov effect and Soviet montage:
    - https://en.wikipedia.org/wiki/Kuleshov_effect
    - https://en.wikipedia.org/wiki/Soviet_montage_theory
24. Music editing:
    - https://www.videomaker.com/article/c4/15659-trimming-music-for-time/
    - https://www.storyblocks.com/resources/tutorials/3-techniques-cutting-music-without-sudden-stop
    - https://clipmusic.ai/blog/bpm-video-editing-guide
25. Murch on screen scale:
    - https://nevalalee.wordpress.com/tag/walter-murch/
    - https://www.moviemaker.com/walter-murch-cutting-from-the-heart-3217/
26. "How to Succeed in MrBeast Production" (leaked handbook PDF): https://cdn.prod.website-files.com/6623bf84e83241ec49b548e4/66edaa19db6e9359bb92931f_How-To-Succeed-At-MrBeast-Production%20(2).pdf
27. Daniel Scrivner, summary of the MrBeast handbook: https://www.danielscrivner.com/how-to-succeed-in-mrbeast-production-summary/
28. "Beastification" and retention editing:
    - https://www.washingtonpost.com/technology/2024/03/30/video-editing-mrbeast-retention/
    - https://gigazine.net/gsc_news/en/20240403-retention-editing-beastification-may-be-end/
29. Google / YouTube, ABCD creative playbook: https://www.thinkwithgoogle.com/_qs/documents/8472/ABCD_Complete_V7b_HR_1.pdf
30. TikTok, creative best practices for top-performing ads: https://ads.tiktok.com/business/en-US/blog/creative-best-practices-top-performing-ads
31. TikTok, Creative Codes: https://ads.tiktok.com/business/en/creative-codes
32. TikTok, video ad specifications: https://ads.tiktok.com/help/article/video-ads-specifications
33. Paddy Galloway on retention at 30 s: https://twitter.com/PaddyG96/status/1510219133895741443
34. Prepublish, the first 30 seconds: https://prepublish.ai/guides/first-30-seconds
35. BrightBean, analysis of 10,000 YouTube hooks (vendor data): https://brightbean.xyz/blog/youtube-hook-types-analysis/
36. Parker and Stone's "but / therefore" rule:
    - https://www.aerogrammestudio.com/2014/03/06/writing-advice-from-south-parks-trey-parker-and-matt-stone/
    - https://perell.com/note/but-therefore-rule/
37. Wikipedia, Chekhov's gun: https://en.wikipedia.org/wiki/Chekhov%27s_gun
38. Clipchamp, open loops: https://clipchamp.com/en/blog/boost-video-watch-time-open-loops/
39. Vox style:
    - https://earnedits.com/how-vox-style-edits-are-built/
    - https://www.premiumbeat.com/blog/replicating-vox-motion-graphic/
40. Johnny Harris style:
    - https://fcpxfullaccess.com/blogs/blog/vox-johnny-harris-documentary-style-final-cut-pro
    - https://motionarray.com/learn/premiere-pro/edit-documentary-in-premiere-pro/
    - https://aescripts.com/learn/post/how-johnny-harris-makes-maps
41. Ali Abdaal style:
    - https://techbullion.com/an-ultimate-guide-to-ali-abdaal-video-editing-style-and-methods/
    - https://increditors.com/an-ultimate-guide-to-alex-hormozi-ali-abdaal-and-mr-beast-video-editing-style-and-methods/
42. Joyspace, Hormozi editing style analysis (vendor): https://joyspace.ai/hormozi-editing-style-2026-analysis
43. Apple advertising:
    - https://www.manfrotto.com/global-uk/stories/how-to-shoot-cinematic-tech-videos-like-apple/
    - https://9to5mac.com/2016/06/03/ken-segall-simplicity/
    - https://www.insurancetimes.co.uk/think-simple-apples-ad-guru-tells-insurance-industry-/1411563.article
    - https://en.wikipedia.org/wiki/IPod_advertising
44. Nike "Dream Crazy":
    - https://thebrandhopper.com/2024/09/28/a-case-study-on-nikes-dream-crazy-campaign/
    - https://en.wikipedia.org/wiki/Dream_Crazy
    - https://medium.com/@jahneeya.oscar/a-rhetorical-analysis-of-nikes-dream-crazy-adactivism-3f3cc50367a2
45. Documentary editing:
    - https://www.jenbeman.com/post/radio-cut-vs-scene-based-editing
    - https://doza.ai/glossary/paper-edit/
    - https://doza.ai/glossary/sound-bite/
    - https://www.cined.com/frankenbiting-in-post-production/
    - https://aspect.inc/blog/post-production/how-to-build-string-outs-and-selects-for-documentary-editing
46. Five-beat micro-documentary brief: https://www.influencers-time.com/the-five-beat-documentary-brief-winning-brand-trust/
47. Material Design (M1), duration and easing: https://m1.material.io/motion/duration-easing.html
48. Material Design 3 motion tokens:
    - https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
    - mirror: https://github.com/anzy-renlab-ai/vocut/blob/main/docs/research/methodology/material-motion.md
49. easings.net source (cubic-bezier values): https://raw.githubusercontent.com/ai/easings.net/master/src/easings.yml
50. LottieFiles motion-design skill: https://github.com/LottieFiles/motion-design-skill/blob/main/skills/motion-design/SKILL.md
51. After Effects easing:
    - https://helpx.adobe.com/after-effects/using/speed.html
    - https://designkkashi.com/en/after-effects-graph-editor-speed-value-influence-guide/
52. Remotion `spring()` docs: https://www.remotion.dev/docs/spring
53. EBU R 95, safe areas for 16:9 production: https://tech.ebu.ch/docs/r/r095.pdf
54. Meta Reels ad safe zones:
    - https://www.biddyco.com/blog-posts/meta-ad-specs
    - https://www.firstpier.com/resources/instagram-ad-safe-zones
55. 9:16 safe zones:
    - https://postplanify.com/blog/social-media-safe-zones-2026-complete-guide
    - https://www.ignitesocialmedia.com/content-creation/what-are-the-safe-zones-for-tiktoks-and-instagram-reels/
    - https://quso.ai/blog/tiktok-dimensions
56. Netflix Timed Text Style Guide:
    - https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide
    - https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements
57. BBC subtitling guidelines (summary): https://www.clevercast.com/bbc-subtitling-guidelines/
58. legibility.info, rules for text in videos: https://legibility.info/rules-for-text-in-videos
59. Caption sizing:
    - https://cutscore.io/blog/best-caption-font-size
    - https://blitzcutai.com/blog/best-caption-size-instagram-reels-2026
60. Hencar, dos and don'ts for on-screen text: https://hencar.com/2015/12/what-the-font-when-to-use-onscreen-text/
61. Verizon Media and Publicis captions study (Forbes): https://www.forbes.com/sites/tjmccue/2019/07/31/verizon-media-says-69-percent-of-consumers-watching-video-with-sound-off/
62. Facebook captions +12% view time: https://www.socialmediatoday.com/social-business/facebook-adds-automated-captions-video-ads-offers-tips-improve-video-performance
63. Short-form caption styles:
    - https://www.opus.pro/blog/youtube-shorts-caption-subtitle-best-practices
    - https://blitzcutai.com/blog/best-caption-style-youtube-shorts-2026
64. Kinetic typography and font pairing:
    - https://wedesignmotion.com/blog/design/kinetic-typography-when-and-why-it-works/
    - https://www.linkedin.com/advice/3/what-some-common-pitfalls-challenges-kinetic-text
    - https://www.videomaker.com/how-to/editing/motion-graphics/type-in-video-picking-the-right-fonts/
65. Color grading:
    - https://theeditingstudio.co/blog/why-teal-and-orange-looks-dated
    - https://www.portrait.com/blog/cullen-kellys-color-grading-philosophy/
    - https://www.cliffsnotes.com/study-notes/28269362
    - https://editlounge.com/post-production/colour-grading/beginner-mistakes/
    - https://cinapex.pro/shot-matching-davinci-resolve/
    - https://www.toolfarm.com/tutorial/achieve-perfect-skin-tones-when-color-grading/
66. Film grain:
    - https://www.holygrain.com/blog/film-grain-and-video-compression/
    - https://www.holygrain.com/blog/how-to-add-film-grain-cinematic-workflow-settings-best-practices/
67. Letterboxing:
    - https://www.mauriziomercorella.com/aspect-ratio-mattes
    - https://ultrawidevideo.com/ultrawide-blog/why-do-movies-have-black-bars
68. Punch-ins and talking heads:
    - https://howtofilmschool.com/dictionary/punch-in/
    - https://jupitrr.com/how-to/edit-talking-head-videos
    - https://www.premiumbeat.com/blog/mastering-zoom-and-punch-in/
69. Pauses and silence removal:
    - https://setuproll.com/how-to/ve-2-remove-gaps-and-dead-air
    - https://www.opus.pro/blog/best-ai-silence-removers
70. Loudness and mixing:
    - https://en.wikipedia.org/wiki/EBU_R_128
    - https://www.production-expert.com/production-expert-1/how-to-optimise-an-audio-mix-for-delivery-to-netflix
    - https://www.toolsforfilm.com/blog/lufs-loudness-normalization
    - https://pureaudioinsight.com/blogs/content-production/background-music-volume-how-loud-should-it-be
    - https://zellahq.com/blog/music-ducking-explained/
71. Sound design:
    - https://www.filmeditingpro.com/a-video-editors-guide-to-sound-design/
    - https://sfxengine.com/blog/sound-effects-for-editing-videos
72. No Film School, eight common editing mistakes: https://nofilmschool.com/eight-common-editing-mistakes
73. Not used. The "98% cuts" figure seen in search snippets could not be traced to a source, so [12] is used instead.
74. AI-video tells:
    - https://www.opus.pro/blog/ai-slop-aesthetic-12-tells
    - https://www.mcgill.ca/oss/article/medical-health-and-nutrition-pseudoscience-technology/deceitful-ai-videos-mislead-seniors-important-health-issues
75. snapcn, "Why AI motion graphics all look the same": https://snapcn.dev/why-ai-motion-graphics-look-the-same
76. "AI design slop":
    - https://smoothui.dev/blog/ai-design-slop
    - https://www.925studios.co/blog/ai-slop-design-tells
77. Timeline Studio (dev.to), teaching an agent professional post-production: https://dev.to/martindelophy/ai-video-editing-should-be-more-than-auto-cutting-teaching-an-agent-professional-post-production-4dke
78. Stock footage:
    - https://beverlyboy.com/film-technology/dont-be-that-editor-stock-footage-mistakes-that-kill-your-video/
    - https://videoforbusiness.ca/avoiding-the-corporate-video-cliche/
    - https://en.wikipedia.org/wiki/This_Is_a_Generic_Brand_Video
79. Limits of AI editing:
    - https://try.wideframe.com/blog/can-ai-edit-video-automatically/
    - https://www.brandbeavers.com/ai-vs-professional-video-editing-why-ai-alone-cant-replace-professional-video-editing-yet/
80. Post-production stages:
    - https://www.adorama.com/alc/filmmaking-post-production/
    - https://clipmasters.io/video-editing-terms/fine-cut/
    - https://en.wikipedia.org/wiki/Picture_lock
81. Arcalea, creative brief: https://arcalea.com/diagnostic/creative-brief
82. Reviewing your own cuts:
    - https://www.filmeditingpro.com/3-editing-tips-for-reviewing-your-own-cuts/
    - https://www.filmeditingpro.com/how-to-stay-objective-when-watching-your-own-cuts/
83. PlayPause, video QC checklist: https://playpause.io/blogs/video-quality-control-checklist
84. Screen direction and the 180-degree rule:
    - https://en.wikipedia.org/wiki/Screen_direction
    - https://en.wikipedia.org/wiki/180-degree_rule
85. Montage:
    - https://www.premiumbeat.com/blog/create-dynamic-video-editing-montages/
    - https://adobevideoworld.com/montage-editing-guide/
86. YouTube Shorts benchmarks (low confidence, not relied on): https://www.shortimize.com/blog/how-to-analyze-youtube-shorts-performance
87. Lower thirds:
    - https://riverside.com/blog/lower-thirds
    - https://softhandtech.com/how-long-should-a-lower-third-last/
88. Third-party TikTok pacing summaries:
    - https://www.stackmatix.com/blog/tiktok-creative-best-practices-2026
    - https://www.teleprompter.com/blog/tiktok-3-second-rule
89. Ken Burns effect:
    - https://en.wikipedia.org/wiki/Ken_Burns_effect
    - https://tvtropes.org/pmwiki/pmwiki.php/Main/TheKenBurnsEffect
90. Not used.
91. Creative Bloq, Disney's 12 principles of animation: https://www.creativebloq.com/advice/understand-the-12-principles-of-animation
92. Overused thumbnail and caption fonts:
    - https://thumbnailtest.com/guides/youtube-thumbnail-fonts/
    - https://x.com/TubeLabHQ/status/2044004706218061888
93. B-roll basics:
    - https://www.nfi.edu/b-roll/
    - https://www.descript.com/blog/article/using-b-roll-a-beginners-guide
