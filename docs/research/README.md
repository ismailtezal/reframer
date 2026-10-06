# Research notes

Condensed findings that shaped Reframer's product decisions (October 2026).
Numbers marked "measured" come from small published frame-by-frame studies; treat them as
starting points, not ground truth.

## 1. What people actually make (and love) with Remotion + AI

Ranked by observed demand during the Remotion Agent Skills wave (Jan 2026 → today):

1. **SaaS / product launch & demo videos** for a launch tweet (≈ half of top-performing AI videos).
   Product visible in the first 3 s, real UI rebuilt as components, dark background + one accent,
   no-bounce springs, 50 ms staggers, 3D tilt, animated cursor with zoom-to-click, 15–37 s, CTA end.
2. **Motion-design showreels** — 15 s, dark, music-only, beat cuts, shape morphs, kinetic type.
3. **Apple-keynote-style product films** — one continuous camera, huge tightly tracked type,
   sparse layout, eased overlapping keyframes; *no* particles/lens flares/shake.
4. **Narrative explainers & history timelines** — strong style hook (doodle, paper, Wes Anderson).
5. **Data stories** — counters with K/M/% formatting, staggered bars, line draw-ons, glass cards.
6. **Map / travel-route animations** — #1 in Remotion's prompt gallery.
7. **Vertical shorts with animated captions** — 1–3 words per page, top safe zone, progress bars.
8. **"Documentary" article highlight** — blurred article, slow 3D tilt, highlighter sweep.
9. **Cinematic intros & logo reveals** — light leaks, grain, glow, chromatic aberration, sound hits.
10. **App Store previews**, 11. **social ads / testimonials**, 12. **model-vs-model comparisons**,
13. **music visualizers / lyric videos** (under-served), 14. **"Wrapped" recaps**,
15. **polishing real footage** (screencasts, talking heads, podcasts).

## 2. Pain points we design against

- The default "AI look": centred headline on a purple→blue gradient fading up; tweening inside one
  scene instead of cutting between shots; look-alike outputs.
- Agents can't *see* timing — "it compiles" ≠ "it's good". Needs frame/contact-sheet review + linting.
- Chat iteration is tedious (Remotion's viral 8 s clip took 35 prompts, ~15 were value nudges) →
  every AI value must be a slider/colour picker the user can grab.
- AI output can't be hand-edited; Studio interactivity greys out on complex code.
- Slow renders; audio sync; captions not bound to their clip; fonts falling back; tiny text on phones.
- Real assets matter (logos, screenshots, recordings) — never invent UI.
- Remotion's company license comes up repeatedly — document it clearly.

## 3. Premium vs amateur (designer consensus)

**Premium:** springs with restrained or no overshoot on UI; hard cuts on downbeats; extreme type
scale contrast; one accent on neutrals; masked text reveals; depth/parallax; camera holds while
the viewer reads; something new every 2–4 s; sound hits on the beat; −14 LUFS; headlines ≥ 56 px,
body ≥ 36 px, labels ≥ 28 px (at 1080p); mobile safe zones; restrained grain/light leaks.

**Amateur:** everything fades in; nothing moves in the first seconds; random shake, particles and
neon; bouncy UI chrome; slideshow of static scenes; unreadable labels; text overlaps; dead beats.

## 4. Competitive landscape

- Category consensus (2026): the agent drafts → the result is a **real, editable timeline**
  (Descript Underlord, Kapwing Kai, Premiere AI Assistant, ChatCut, Cardboard).
- Open-source agentic editors exist (Diffusion Studio, VEED OpenEdit, OpenChatCut) — none combines
  a **live, visible agent** with a **first-class manual editor**. That is Reframer's wedge.
- MCP is now table stakes (Descript, Runway, Rive, Figma, DaVinci Resolve 21.1).
- Users hate: unpredictable credits, export-time paywalls, "success!" lies, lost projects,
  generic taste, no feedback while waiting, lock-in.

## 5. T3 Code lessons (the "any model" control surface)

- A control surface, not a model: drive the harness/model the user already has.
- One typed command API; capability flags instead of provider-name branching ("capability honesty").
- Each turn = checkpoint + diff + one undo; collapsible activity log; plan mode; queue vs steer.
- Model picker: provider rail, favourites, fuzzy search, capability badges (from models.dev).
- Focus-scoped shortcuts — playback keys must never leak into the composer.
- Inject a session-scoped MCP server into agent sessions; never proxy consumer subscription tokens.

## 6. Style DNA

The full creator/brand compendium lives in code: [`src/core/styles/presets`](../../src/core/styles/presets).
Each preset records pacing, grade, typography (with Google Fonts fallbacks), captions,
transitions, motion, overlays, sound, and the 3–5 "signature tells" that make it recognisable.

### Sources (selection)

- Remotion prompts gallery — https://www.remotion.dev/prompts
- Remotion Editor Starter features — https://www.remotion.dev/docs/editor-starter/features
- Measured creator styles — https://www.writepanda.ai/blog/retention-editing-7-laws
- MKBHD measured — https://www.writepanda.ai/blog/mkbhd-editing-style-measured/
- Hormozi shorts measured — https://www.writepanda.ai/blog/hormozi-style-shorts-editing
- DOAC podcast clips — https://www.writepanda.ai/blog/how-diary-of-a-ceo-edits-podcast-clips/
- Apple-style animation — https://trydemotion.com/blog/apple-style-animation-guide
- Linear / Vercel / Raycast aesthetic — https://studiomaydit.com/blog/linear-vercel-raycast-aesthetic
- T3 Code — https://github.com/pingdotgg/t3code
- Anthropic legal & compliance (subscriptions in third-party apps) — https://code.claude.com/docs/en/legal-and-compliance
- MCP spec 2026-07-28 — https://blog.modelcontextprotocol.io/posts/2026-07-28/

## Deep dives (October 2026)

Full reports with sources, behind the editing, sound and transition work:

- [Editing and directing taste](editing-taste.md): Murch's priorities, pacing as a distribution
  (median ≈ 0.5–0.85 × mean), hooks, AI-slop patterns with timeline tests, a director's workflow
  and a 100-point critique rubric. Source of the `editor-taste` skill and the rhythm lint rules.
- [Sound design and music](sound-and-music.md): Chion, Murch, Viers and creator practice turned into
  event → sound rules, timing (ITU-R BT.1359), density and loudness targets; the legal music and SFX
  sources usable from code (Openverse, incompetech, Freesound, Kenney). Source of the `sound-design`
  skill, `search_audio`, ducking and export loudness.
- [Transitions at plugin quality](transitions.md): what editors actually use (Film Impact is now
  Premiere's default set), why plugins look expensive (velocity-peaked cuts, velocity motion blur,
  exponential zooms, no revealed edges), 28 recipes, gl-transitions licensing and sound pairing.
