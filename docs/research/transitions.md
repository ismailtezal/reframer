# Video transitions at plugin quality: what editors use and how to build it

*Research for Reframer, 2026-10-06. It covers which transitions pros and creators use (2024–2026), how the plugin versions are built, shader sources and their licenses, sound pairing, and an implementation plan for Reframer's Remotion stack.*

> **Method and caveats.** I used vendor docs (Adobe HelpX, Boris FX Sapphire docs, MotionVFX, Mister Horse, VideoHive), tutorials (Motion Array, AEJuice, 4K Shooters, Kyler Holland, Olaf Motion), forums (Creative COW), a trailer editor's blog (Derek Lieu), Remotion docs and source, and the gl-transitions repo. I downloaded the full `gl-transitions.json` and parsed every license.
> **Reddit could not be reached.** WebSearch rejects the domain and the browser pane blocks it, so Creative COW and Adobe Community threads stand in for r/editors.
> **Film Impact's site is gone.** Since the Adobe acquisition, every filmimpact.com product page returns 301 to Adobe HelpX, and the Wayback Machine was offline. Details that come only from search-engine snippets of the old Film Impact pages are marked *(snippet)*.
> **Labels.** Values marked **[rec]** are my engineering defaults. They are derived from the sourced numbers but are not quoted from a source.

---

## 0. Executive summary

1. **The pro plugin market has consolidated.** Adobe acquired **Film Impact**, the best-known Premiere transition plugin. Its 90+ GPU transitions became part of **Premiere 25.5** (Sept 2025), and in **Premiere 26.0** they *replaced* the native set:
   - The old transitions were renamed "(Legacy)".
   - Page Peel/Turn, Checker/Checkerboard, Venetian Blinds, Spiral Boxes, Pinwheel, Random Blocks/Wipe, Wedge/Band/Zig-Zag wipes and Paint Splatter were moved to **Obsolete**.
   - **Cube Spin, Flip Over and Gradient Wipe were removed.**

   Adobe's new list is the best available public signal of what a modern professional transition set looks like, and of what is now considered dated. [Adobe 26.0 list]
2. **What gets used, by tier:**
   - **Pros (documentary, commercial, narrative):** cuts and J/L cuts, cross dissolves (including 3–12-frame "soft cuts"), dips to black or white, and flash frames in trailers.
   - **Creators:** the "seamless" family on top of that: zoom-through, whip/push with motion blur, spin, stretch and shake. Also light leaks and film burns, glitch/RGB split, and flashes.
   - **Brand and social work:** graphic matte, shape and ink wipes. These are the two largest categories in Mister Horse's 468-transition pack.
3. **What makes a plugin look expensive is the optics, not the geometry.** Plugins get six things right:
   - The speed curve peaks at the cut.
   - Motion blur comes from the actual velocity: directional, radial or rotational, at a 180°+ shutter.
   - Edges are never revealed. Plugins use Reflect/mirror wrap or overscan; Sapphire's default `Edge Mode`/`Wrap` is **Reflect**.
   - The A→B swap is hidden inside peak blur or peak brightness. It lasts 1–3 frames instead of a long crossfade.
   - Light is handled in linear light: exposure flashes, screen/add leaks, film dissolve.
   - Secondary optics are layered on top (chromatic aberration along the motion, lens bend, rolling-shutter skew, glow), plus a sound effect whose peak sits on the cut.
4. **Shaders:**
   - **gl-transitions** has **125 transitions: 123 MIT, 1 BSD-3-Clause (InvertedPageCurl, HP), 1 BSD-2-Clause (StereoViewer).** It defines a clean interface: `transition(uv)`, `getFromColor`, `getToColor`, `progress`, `ratio`.
   - **Remotion 4.0.533** (already in Reframer's `package.json`) ships WebGL "HTML-in-canvas" ports such as zoomBlur, crossZoom, blurSlide, filmBurn and linearBlur.
   - **License warning:** `@remotion/transitions` and `@remotion/effects` are under the **Remotion License** (`"license": "UNLICENSED"`, source-available), not MIT. Port from the MIT gl-transitions originals instead of copying Remotion's shader code.
5. **Architecture recommendation.** Use one `TransitionRecipe` model (curves, cut point, per-side transforms, optics envelopes, SFX) with two back-ends:
   - **(a) Media ↔ media:** a WebGL2 compositor that takes both frames as textures. It uses a gl-transitions-compatible API, generic *motion blur computed from the transform*, mirrored sampling, linear-light helpers and deterministic noise.
   - **(b) DOM / text / shapes:** the same curves, plus:
     - SVG streak blur along the velocity vector;
     - `mix-blend-mode: plus-lighter` compositing, which removes the dark seam you otherwise get when two blurred layers meet;
     - CSS gradient masks (a conic mask for a real clock wipe);
     - screen or plus-lighter light overlays;
     - `@remotion/motion-blur`'s `<CameraMotionBlur>` (MIT) for hero moments.

   For (b), about 90% of plugin quality comes from **curve + velocity blur + seam-free compositing + a 1–2-frame light hit + SFX**.

---

## 1. Popularity: what is used, by whom, and what is now dated

### 1.1 Market snapshot (2024–2026)

| Tool / vendor | Status and scale | Go-to transitions inside |
|---|---|---|
| **Film Impact → Adobe Premiere** | Acquired by Adobe. Built into Premiere 25.5 (Sept 2025), GPU-accelerated, with a "Surprise Me" randomizer. In 26.0 the FI versions became the main entries (e.g. "FI: Cross Dissolve Impacts" became "Cross Dissolve") and the originals became "(Legacy)". | HelpX "Essentials": Mosaic, Star Wipe, Chaos, Burn Alpha, **Flash**, **Blur to Color**, **Roll**, **Stretch**, **Dissolve**, **Push**, Burn Chroma, **Blur Dissolve**, Neon Wipe, **Luma Fade**, Clock Wipe, Linear Wipe, Frame. Historic flagships: the 2012 Transition Pack 1 was Flash, Roll, Push, Blur to Color, Burn Alpha, Burn White, Blur Dissolve, Stretch, Copy Machine, Chaos, and the free set was Blur to Color, Dissolve, Push, Roll *(snippet)*. ProVideo Coalition calls the FI cross dissolve "a much, much better alternative" to the old default. |
| **Mister Horse: Premiere Composer / Animation Composer** | Free extension, "used by more than 400,000 editors" (aescripts *(snippet)*); Animation Composer for Premiere claims 500,000+. The transitions pack has **468 transitions in 15 categories**. | Category sizes show where demand is: **Shapes 101, Glitch 54, Matte 54, Camera Pan 48, Camera Pan & Rotate 42, Camera Zoom 27**, Light Leaks 20, Zoom & Twirl 20, Camera Rotate 19, Split 18, Zoom & Rotate 17, Camera Roll 14, Creative 13, Blurs & Fades 11, Camera Shake 10. |
| **Videolancer "Handy Seamless Transitions" (Motion Bro)** | The most popular item on VideoHive: **41,545 sales, 4.90★** (AE); **18,474 sales, 4.82★** (Premiere). **Sound effects come with each transition** (Premiere version). | Zoom (Simple, Shake, Hit, Swinging, Spin, **Optics**), Flight Pan, Pan & Offset, Glitch (11 variants), Stretch, Spin, 3D Box/Surface, VR Warp, Shape, Shake, Perspective, Light Leaks, Warp, Split. |
| **MotionVFX** (FCP / Resolve) | Product line rather than a single plugin. | mTransition **Zoom** vols 1–3 (50 each), **Distortion** (glitch), **Light 2** (50 light leaks), Shine, Fade, Noise, Kinetic, Movie, Tear, Film Roll. |
| **Boris FX Sapphire** (broadcast/promo; Avid/AE/Resolve/Premiere) | High-end standard, 50+ transitions. | DissolveGlow, DissolveBlur, **SwishPan**, Swish3D, **WhipLash**, **HyperPush**, DissolveLightLeak, DissolveDigitalDamage, DissolveLuma, FilmRoll, ParallaxStrips, PixelSort, etc. |
| **DaVinci Resolve built-ins** | About 44 presets. Cross Dissolve is the default with a **1 s default** length. | Cross Dissolve (Video/Film/Additive/… styles), Dip to Color, Blur Dissolve, **Smooth Cut** (optical flow), Iris/Shape/Wipe (flagged as "retro/stylized"), Push/Slide, plus Fusion transitions (Slice Push). |
| **Final Cut Pro built-ins** | Default transition is a 1 s cross dissolve. | Cross Dissolve ("most used"), **Flow** (jump-cut morph, fixed **6 frames**), Bloom, Movements, Wipes. |
| **CapCut** (short-form) | 1B+ Google Play downloads (Jan 2025). Categories: Trending, Basic, Camera, Overlay, Light Effect, Split, Distortion, Glitch, Blur, Social Media, Slide, MG, Mask. | **"Pull in"** (zoom; the "fan favorite"), Black fade, White flash, Mix/Dissolve, Slide/Swipe, Wipe, Blur, **Zoom Shake 2**, **Blur & Zoom**, Tremble Zoom, **Rotate CCW II**, Vertical Blur, **Glare**, Glitch, Horizontal/Diagonal Slice, Blinds, Hexa Mosaic, Cube, 3D Flip, Page Turning. 2026 trend write-ups stress **velocity (speed-ramp) edits, beat sync, glitch, smooth zoom, swipe/spin**. |
| **Remotion** (`@remotion/transitions` 4.0.533, already a dependency) | CSS: fade, slide, wipe, flip, clockWipe, iris, **pushCut**, none. WebGL HTML-in-canvas: blurSlide, bookFlip, crossZoom, crosswarp, dissolve, dreamyZoom, filmBurn, linearBlur, ripple, swap, zoomBlur, zoomInOut. | — |

### 1.2 Ranking: the transitions that matter

Tiers combine NLE defaults, vendor flagships, pack category sizes, CapCut naming and editor commentary.

| # | Transition | Main users | Evidence | Taste |
|---|---|---|---|---|
| 1 | **Cut** (+ **J/L cut**, cut on action) | Everyone; doc and narrative almost exclusively | Wikipedia: "The cut is the most basic and common type of transition." Documentary guides lean on J/L cuts and cutting on action. | Tasteful baseline |
| 2 | **Cross dissolve** (video / film / soft cut) | Everyone | Default in Premiere, Resolve and FCP (1 s). Dissolves "typically 1 to 2 seconds (24–48 frames)"; soft cuts 6–12 frames. | Tasteful |
| 3 | **Dip / fade to black** | Doc act breaks, trailers | Derek Lieu calls it a "palate cleanser", but overuse "can be a sign of a less experienced editor". | Tasteful when sparing |
| 4 | **Dip to white / flash / flash frame** | Trailers, music, sports, social | FI Flash (TP1 and Essentials), Sapphire DissolveGlow, CapCut White flash; trailer cuts to white pair with hits and whooshes. | Tasteful on beats; cheesy when constant |
| 5 | **Zoom-through (zoom in/out, "Pull in")** | Travel/vlog, social, hype | Sam Kolder style, CapCut "Pull in", Videolancer's first category, MotionVFX Zoom ×3, FI Zoom Blur / Cross Zoom | Creator staple; tasteful when motivated |
| 6 | **Whip / swish pan, push with motion blur** | Travel, action, comedy, corporate | FI Push (TP1, free), Sapphire SwishPan/WhipLash, Mister Horse Pan 48 + Pan & Rotate 42 | Tasteful when it matches a camera move |
| 7 | **Light leak / film burn / glare** | Weddings, travel, lifestyle, music | FI Light Leak / Chroma Leak / Burn, Mister Horse Light Leaks 20, MotionVFX Light 2/Shine, Sapphire DissolveLightLeak, CapCut Glare | Tasteful if subtle; dated if heavy |
| 8 | **Glitch / RGB split / datamosh** | Tech, gaming, music, hype | Mister Horse Glitch 54, Videolancer Glitch, MotionVFX Distortion, FI Glitch/Chaos/VHS, CapCut Glitch category | Context-only. Inside Editors: "can feel dated quickly". |
| 9 | **Spin / roll** | Travel, music, sports | FI Roll (TP1, free), Mister Horse Rotate/Roll, CapCut Rotate CCW II | Creator; cheesy if slow |
| 10 | **Blur dissolve / directional blur dissolve** | Corporate, wedding, YouTube | FI Blur Dissolve (TP1) and Directional Blur, Sapphire DissolveBlur, CapCut Blur | Tasteful |
| 11 | **Camera-shake / "earthquake" transitions** | Hype, gaming, trailers | Mister Horse Camera Shake, Videolancer Zoom Shake, CapCut Zoom Shake 2 / Tremble Zoom, FI Earthquake | Context |
| 12 | **Stretch / warp / lens (optics) zoom** | Social, music | FI Stretch (TP1) and Warp, Videolancer Stretch / Warp / Optics zoom | Creator |
| 13 | **Shape / matte / ink wipes** | Branding, explainers, social | Mister Horse Shapes 101 + Matte 54 (largest two), CapCut MG / Mask | Tasteful if on-brand |
| 14 | **Slide / split / slice / louver** | Explainers, social | CapCut Slide/Split/Slices/Blinds, FI Split/Slice/Panel/Louver | Neutral |
| 15 | **Luma fade** | Landscape, travel, music | FI Essentials (Luma Fade), Sapphire DissolveLuma, a classic for keying away skies | Tasteful |
| 16 | **Soft / linear wipe, light sweep, neon wipe** | Corporate, promo | FI Linear/Soft/Neon Wipe, Light Sweep | Soft is fine; hard wipes are "retro" |
| 17 | **Push-cut / punch-in on a jump cut** | Talking heads, YouTube | Remotion pushCut ("A hard editorial cut with a short punch-in… and a brief flash") | Tasteful |
| 18 | **Morph Cut / Smooth Cut / Flow** | Interviews | Built into all three NLEs; FCP Flow is fixed at 6 frames | Tasteful if invisible |
| 19 | **Mosaic / pixelate, kaleidoscope, chaos** | Gaming, retro, music | FI Mosaic/Kaleidoscope/Chaos, CapCut Hexa Mosaic | Novelty |
| 20 | **3D flip / cube / page peel / star / heart / checker / barn doors / iris shapes** | Kids, ironic or retro | Adobe 26.0 obsoleted or removed the classics. On Creative COW a "Letterman list" put the 3D cube spin at #1 worst, and "Nothing screams 'amateur' more than star wipes… page curls" (Film Editing Pro *(snippet)*). | **Dated / cheesy** (FI keeps modernized Page Peel and Star Wipe as novelty) |

### 1.3 Tasteful vs cheesy, in practice

| Generally tasteful | Context-dependent | Dated / cheesy unless ironic |
|---|---|---|
| Cut, J/L cut, cut on action, dissolve (incl. film dissolve), soft cut, dip to black, flash *on a beat*, blur dissolve, luma fade, push/whip *matched to camera motion*, zoom-through between matched shots, subtle light leak, push-cut, morph cut | Glitch/RGB split/VHS, shake, spin, stretch/warp, film burns, pixelate, slices, shape mattes, chroma leaks, kaleidoscope | Page peel/curl, cube spin, 3D card flip, star/heart/iris shapes, checkerboard, barn doors, venetian blinds, spiral boxes, "fly-away" boxes, spin-aways with trails, hard-edged colored wipes |

Rules of thumb that editors repeat:
- "Cut, dissolve, and fade to black are still the most pleasing and appropriate" (Creative COW).
- Glitch and strobe "can feel dated quickly" (Inside Editors).
- Overusing *any* one device becomes predictable (Derek Lieu).

Olaf Motion suggests a "signature transition" used about 70% of the time with a secondary style about 30%. For Reframer's AI, make taste a lint rule: cap the number of flashy transitions per minute, require motivation (motion direction matches the camera move), and hide or flag dated types unless the style asks for retro.

---

## 2. Cross-cutting principles (the "plugin-quality" checklist)

### 2.1 Cut at peak velocity, and align every peak to it
- Seamless transitions put the A→B swap where motion is fastest, because "when motion is fastest, details are harder to perceive". Position, scale, blur and exposure should **peak on the same frame** (Olaf Motion).
- Sam Kolder-style zooms "align [the velocity] peak to the cut" (4K Shooters).
- Sapphire Swish3D crossfades at `Fade Mid Time 0.5`. Remotion's `blurSlide` crossfades with `smoothstep(0.3, 0.7, p)`. The gl `Revolve_Left` swaps between `switchStart 0.30` and `switchEnd 0.50`.
- **[rec]** Hide the swap in a 1–3-frame window centered on the velocity peak. Use a hard swap for whip and zoom, ≤20% of the duration for spin and push. A long crossfade under fast motion reads as ghosting.

### 2.2 Easing curves (cubic-bezier) and their peak-speed multiplier
The peak multiplier is max(dy/dx). Multiply it by the average speed to get peak speed, which sets blur length. Values were computed numerically; bezier values are from easings.net.

| Curve | cubic-bezier | Peak speed × avg | Typical use |
|---|---|---|---|
| AE **Easy Ease** (speed 0, **33.33%** influence) | (0.333, 0, 0.667, 1) | 1.50 | Default AE ease; too soft for seamless moves |
| AE 50% influence | (0.5, 0, 0.5, 1) | 2.0 | — |
| AE 75% influence | (0.75, 0, 0.25, 1) | 4.0 | Snappy push |
| AE 90% influence | (0.9, 0, 0.1, 1) | 10.0 | Extreme whip |
| easeInOutSine | (0.37, 0, 0.63, 1) | 1.59 | Dissolves, light leaks |
| easeInOutCubic | (0.65, 0, 0.35, 1) | 2.86 | Gentle push/slide |
| easeInOutQuart | (0.76, 0, 0.24, 1) | 4.17 | Push, spin |
| **easeInOutQuint** | (0.83, 0, 0.17, 1) | 5.88 | **Default "seamless"** (zoom-through, spin) |
| easeInOutCirc | (0.85, 0, 0.15, 1) | 6.67 | Whip |
| **easeInOutExpo** | (0.87, 0, 0.13, 1) | 7.69 | Whip, cross zoom (gl CrossZoom uses exponential in-out for its dissolve) |
| gl `tangentMotionBlur` KeySpline | (0.68, 0.01, 0.17, 0.98) | 4.08, peak at t≈0.435 (slightly early) | Spin with tangent blur |
| easeOutBack | (0.34, 1.56, 0.64, 1) | — | **≈9.8% overshoot** (Penner s = 1.70158) |
| easeInOutBack | (0.68, −0.6, 0.32, 1.6) | — | ±10.5% overshoot |

- An AE ease of influence *I* at speed 0 on both keys is exactly `cubic-bezier(I, 0, 1−I, 1)` for a 1-D two-key move, with peak multiplier 1/(1−I). Tutorials pushing "make the curve more dramatic" (Motion Array) are moving *I* from 33% toward 75–90%.
- **Asymmetric "into the cut / out of the cut"** is the editorial pattern Remotion's `pushCut` uses: `Easing.in(quad)` before the cut and `Easing.out(quad)` after. Sapphire exposes it as `Slow In` / `Slow Out` (SwishPan and Swish3D default 0.5 / 0.5, HyperPush 1 / 1, DissolveLightLeak 0.2 / 0.2).
- **Overshoot / bounce:** FI Slide has "bounce"; Sapphire WhipLash has `Whip Out: Smooth / Bounce / Snap`.
  - **[rec]** Settle B with 3–6% overshoot for camera-like moves: scale the easeOutBack overshoot down, or use a spring with ~1–2 visible oscillations.
  - Reserve 10% overshoot for graphics.

### 2.3 Motion blur: make it from velocity, not from a fixed number
- **Shutter.** The film standard is a 180° shutter (1/48 s at 24 fps). AE's comp default is **180°, phase −90°** (Creative COW).
  - Tutorials set the Premiere/AE Transform effect's own shutter: Motion Array uses **180**, the Sam Kolder recipe uses **≥300**, and AEJuice's spin uses 180 (360 for more blur).
  - Remotion `<CameraMotionBlur>` defaults to `shutterAngle 180`, `samples 10`.
- **Blur length** = |screen-space velocity per frame| × (shutterAngle / 360).
  - *Example:* push 1 W over 15 frames with easeInOutQuint: peak = 5.88 × W/15 ≈ 0.39 W/frame. At 180° that is a **0.2 W streak (~380 px at 1920 wide)**.
  - A whip that travels 2 W in 10 frames with expo peaks at ~1.5 W/frame, so the frame fully smears at the cut. That is how real whip pans look.
- **Kernel shape.**
  - Constant velocity across the shutter produces a **box (uniform) streak**, not a Gaussian.
  - Gaussian (CSS `blur()`, `feGaussianBlur`, separable GPU blur) looks like *defocus* and loses the streak ends.
  - Plugins integrate along the path. gl `CrossZoom` and glfx `zoomBlur` use 40 jittered taps weighted `4(t − t²)`. Remotion `blurSlide` uses a 32-coarse × 32-fine two-pass **box** kernel "which avoids the moiré".
- **Generic approach (best).** Sample the per-side **inverse transform at N sub-frame times** inside the shutter window and average.
  - This gives directional (push/whip), radial (zoom), rotational (spin) and mixed blur from one code path.
  - gl `Revolve_Left` does exactly this: 17 temporal taps, triangle-weighted, span `0.06 × motionBlur × envelope`.
  - gl `tangentMotionBlur` finite-differences the rotation between frames to get a per-pixel speed vector.
- **[rec] Samples:** 16–32 taps with per-pixel hash jitter for the GPU path; 6–10 sub-frames for `CameraMotionBlur`.

### 2.4 Edge handling: never reveal black
| Situation | Plugin / tutorial approach | Shader equivalent |
|---|---|---|
| Push / slide | Incoming B fills the gap (film-strip adjacency) | Sample `fract(uv + offset)` and choose A or B per region (gl `Directional`) |
| Whip travelling >1 W, shake, zoom-out (scale <1), spin, lens warp | AE **Motion Tile + Mirror Edges**; Premiere **Replicate + Mirror ×4**; Sapphire `Wrap/Edge Mode: Reflect` (default) | Mirrored repeat: `uv = 1.0 - abs(mod(uv, 2.0) - 1.0)` or `MIRRORED_REPEAT` |
| Blur near frame edges | Premiere/AE "Repeat Edge Pixels" | `CLAMP_TO_EDGE` for blur taps. CSS `filter: blur()` on a full-frame layer pulls in transparency and leaves dark borders, so avoid it on full-bleed media. |
| Rotation without tiling | Overscan | Scale by the cover factor `|cos θ| + ar·|sin θ|` (Remotion `zoomBlur` `coverScale`) |
| Barrel / lens warp | Animate curvature "without showing white edges" (Kyler Holland) | Mirrored sampling. `@remotion/effects` `barrelDistortion` returns transparent outside [0,1], so pair it with overscan. |

WebGL1 only allows `CLAMP_TO_EDGE` on non-power-of-two textures. Use WebGL2, or do the in-shader mirror.

### 2.5 Light and color
- **Linear light.**
  - Premiere's **Film Dissolve** "blends in a linear color space (where gamma equals 1.0)". It looks more photographic, but bright areas lead, which some editors find "abrupt" on fades from black (RenderBreak / Odederell).
  - Do exposure (`× 2^stops`), additive glow, leaks and flashes in linear, then encode.
- **Additive dissolve:** A+B goes above 1 mid-transition, which gives a brightness bump (OBS forum / Adobe).
- **Light overlays:** **Screen** is the default for leaks (Sapphire DissolveLightLeak `Combine Mode: Screen`). Use Screen "90% of the time"; **Add / Linear Dodge** gives a hotter glow (Enchanted Media *(snippet)*).
- **Glow.** Sapphire DissolveGlow defaults: brightness 6, threshold 0.2, width 0.4. Per-channel widths are R 1 / G 1.2 / B 1.4, so blue spreads further and the glow looks lens-like.
- **Banding.** **[rec]** Add 1-LSB blue-noise dither before output. Flashes, leaks and dark dissolves band badly in 8-bit H.264.

### 2.6 Zoom must be exponential
- Linear scale keys feel fast-then-slow because 1→2 is a doubling while 9→10 barely changes. AE's **Exponential Scale** keyframe assistant exists for this (Adobe; Motion Design School).
- **[rec]** Animate `ln(scale)` with the easing: `z(t) = exp(ln(Z) · e(t))`.
  - For a continuous zoom through a cut, run one curve across both sides: A shows `z(t)` while t < c; B shows `z(t)/Z`, which ends at 1.
  - Example with Z = 4: A goes 1→2 by the cut, B goes 0.5→1.

### 2.7 Temporal texture and determinism
- **Glitch, flicker and grain** must step at a *rate in Hz*, not per frame. gl `StripDatamoshGlitch` uses `frame = floor(progress*30)`; `Drop_Zone_Flicker` hard-codes a 24-frame reveal table. **[rec]** Hold glitch states for 8–15 Hz, so every 2–3 frames at 24/30 fps and every 4–6 at 60 fps.
- **Seed all noise** from (clip id, integer frame), never wall-clock time or `Math.random`, so preview matches render.

### 2.8 Typical durations

Values are seconds, with frames at 24 / 30 / 60 fps. Sourced anchors are named; ranges are **[rec]** consolidations.

| Transition | Seconds | @24 | @30 | @60 | Anchor |
|---|---|---|---|---|---|
| Soft cut ("hard soft cut") | 0.12–0.5 | 3–12 | 4–15 | 8–30 | 3–4 f / 6–12 f (Wikipedia) |
| Cross dissolve | 0.5–2 | 12–48 | 15–60 | 30–120 | 24–48 f standard; NLE default 1 s |
| Dip to black / white | 0.5–1.5 | 12–36 | 15–45 | 30–90 | — |
| Flash / exposure | 0.2–0.5 | 5–12 | 6–15 | 12–30 | Remotion pushCut flash = 2 f |
| Whip pan | 0.25–0.5 | 6–12 | 8–15 | 15–30 | "8–12 frames for whip and push-ins" (Olaf Motion) |
| Push / slide with blur | 0.33–0.7 | 8–17 | 10–21 | 20–42 | 6–12 f (Olaf Motion) |
| Zoom-through | 0.33–0.6 | 8–14 | 10–18 | 20–36 | Sam Kolder: 6 f + 6 f around the cut |
| Spin | 0.5–0.85 | 12–20 | 15–25 | 30–50 | AEJuice: 20 f (10 + 10) |
| Stretch | 0.5–0.85 | 12–20 | 15–25 | 30–50 | AEJuice: 10 f + 10 f |
| Shake / distortion | 0.5–0.85 | 12–20 | 15–25 | 30–50 | Kyler Holland: 20 f window |
| Glitch | 0.2–0.6 | 5–14 | 6–18 | 12–36 | "Short bursts" |
| Light leak / film burn | 0.75–2 | 18–48 | 22–60 | 45–120 | Overlays run 1–16 s with 3–4 f fades at the ends |
| Luma fade, ink / matte | 0.75–1.5 | 18–36 | 22–45 | 45–90 | — |
| Wipes / iris / clock / slices | 0.5–1 | 12–24 | 15–30 | 30–60 | — |
| Morph cut / Flow | ≈0.2–0.4 | 6 | 6–8 | 12 | FCP Flow fixed at 6 f |

---

## 3. Recipes for the ~25 transitions that matter

Notation:
- A = outgoing, B = incoming, p = linear progress 0→1, e(p) = eased progress, c = cut point (default 0.5), W/H = frame size, ar = W/H.
- "Env(p)" is an envelope that is 0 at the ends and 1 at c, e.g. `sin(πp)` or two smoothsteps.
- `lin()` / `enc()` are sRGB decode / encode.

### R1. Cross dissolve (video and film)
- **Math.**
  - Video: `out = mix(A, B, e)`.
  - Film: `out = enc(mix(lin(A), lin(B), e))`.
  - Offer both: "Dissolve" and "Film dissolve".
- **Layers.** B over an opaque A with `opacity = e`. If either side can be transparent (titles, overlays), composite **A·(1−e) + B·e additively** (`plus-lighter`). Two "over"-composited fades dip to 75% alpha at the midpoint. The W3C View Transitions spec uses plus-lighter for exactly this "correct cross-fade".
- **Curve.** Linear or easeInOutSine.
- **Duration.** See 2.8.
- **Audio.** Constant-power crossfade of equal length, or offset as a J/L cut.
- **Shader.** gl `fade` (gre, MIT).

### R2. Additive dissolve / glow dissolve / overexposure
- **Additive.**
  - Add B onto A, then fade A out: `out = A·min(1, 2(1−e)) + B·min(1, 2e)`, clamped.
  - Brightness bumps at mid. Do it in linear light for a "film" feel.
- **Glow dissolve** (Sapphire DissolveGlow):
  - Dissolve plus a bloom pass whose gain is Env(p).
  - Defaults: `Glow Brightness 6`, `Glow Threshold 0.2`, `Glow Width 0.4`, RGB width scales 1 / 1.2 / 1.4.
  - `Dissolve Speed 3` makes a snappier mid-swap.
- **gl `Overexposure`** (Ben Zhang, MIT, `strength 0.6`):
  ```
  from·(1−p + sin(πp)·s) + to·(p + sin(πp)·s)
  ```
- **Duration:** 10–20 f @24.

### R3. Dip to black / white (dip to color)
- **gl `fadecolor`** (MIT):
  ```
  mix(mix(color, A, smoothstep(1−φ, 0, p)), mix(color, B, smoothstep(φ, 1, p)), p)
  ```
  with `colorPhase φ = 0.4`, the share of time at the solid color.
- **Trailer variants** **[rec]**: fast fade-out (8–12 f), hold 2–8 f of black, quicker fade-in (4–8 f). Or a hard **cut to black** on a hit.
- **White version.** Do it in linear light with the exposure ramp from R7 so highlights clip first. That reads as "light", not "paint".
- **Gotcha.** Premiere notes that dip affects lower tracks. In Reframer, apply it to the composite frame, not per layer.
- **Sound.** Hits, bass drops and booms on cuts to black; hits or whooshes on cuts to white (Derek Lieu).

### R4. Blur dissolve, directional-blur dissolve, blur-to-color
- **Sapphire DissolveBlur.** A blurs and fades out while B unblurs and fades in.
  - `Blur Amount 2`, `Blur Rel X 1`, `Blur Rel Y 0` (horizontal by default; set either to 0 for a pure directional blur dissolve).
  - `Blur Rel From/To 1`, `Blur Filter: Gauss` (also Box, Triangle).
- **[rec] Envelopes.**
  - `rA = R·smoothstep(0, c, p)`, `rB = R·(1 − smoothstep(c, 1, p))`, mix at `smoothstep(c − 0.15, c + 0.15, p)`.
  - R ≈ 2–4% of the frame diagonal for a dissolve, 8–15% along an axis for directional.
- **Blur to color** (FI): blur A while fading to a solid, then reverse into B.
- **Quality.** A defocus (bokeh) kernel looks more "lens" than a Gaussian:
  - gl `DefocusBlur` (12-tap Poisson, `blurSize 0.02`);
  - glfx `lensBlur` (MIT);
  - gl `LinearBlur` (6×6 taps, `intensity 0.1`), which Remotion ported as `linearBlur()`.

### R5. Luma fade (luma dissolve)
- **Behavior.**
  - Per-pixel threshold on luminance: bright (or dark) areas switch first.
  - FI's version "keys away either the brighter or darker areas"; a classic is to dissolve skies first.
- **Sapphire DissolveLuma defaults.**
  - `Softness 0.1` ("increase for softer and slower").
  - `Use Luma Of: Difference` (six modes, e.g. from-clip or to-clip luma), `Invert Pattern`.
  - `Smooth Pattern` blurs the luma map so edges aren't noisy.
- **[rec] Math.**
  ```
  Y = blur(luma(lin(A)), ~0.5–1% W)
  t' = e·(1 + 2s) − s
  m = smoothstep(1 − t' − s, 1 − t' + s, Y)   // brights first; flip for darks first
  out = mix(A, B, m)
  ```
  Add a 1–2 f global crossfade at the end so the darkest pixels can't pop.
- **Shaders.** gl `luma` (needs a luma map texture) and `luminance_melt` (luminance-gated melt with simplex noise).
- **Duration.** 18–36 f @24.

### R6. Flash / exposure burst (dip to white, done right)
- **Plugin behavior.**
  - FI Flash is "a bright flash or overexposure burst that smoothly hides the cut".
  - Remotion `pushCut` draws a **2-frame `#f5f2ed` flash at 20% opacity** at the cut on top of a 4–7% punch-in.
- **[rec] Recipe (linear light):**
  - `exposure(p) = Smax · pow(Env(p), k)` with peak **+3 to +5 stops**, which drives the image to white.
  - Make it asymmetric: rise over ~30% of the duration (easeIn), swap at the peak, decay over ~70% (easeOutCubic). Real light dies away slower than it arrives.
  - Add bloom: threshold 0.6, radius 2–4% W, gain ∝ exposure.
  - Optional: zoom-blur 1–2% and a ×1.02–1.05 scale punch on B.
- **Duration.** 6–12 f; a pure flash frame is 1–2 f.
- **SFX.** Hit, camera shutter, or bass hit on the peak frame.

### R7. Light-leak transition
- **Sapphire DissolveLightLeak** (the most explicit pro reference). It "transitions between two input clips while adding light leaks to the dissolve result".
  - `Combine Mode: Screen`, `Transition Brightness 1.5`, `Scale Lights 1.1`.
  - `Dissolve Speed 11`: the under-swap is nearly hard and hidden under the leak.
  - `Slow In/Out 0.2`, `Flicker Amp 0.2`, `Flicker Freq 4`.
  - Glow: brightness 0.5, width 0.4, threshold 0.8. Three leak elements, each with its own size, color gradient and noise.
- **Footage workflow.** Put the leak clip over the cut in **Screen** (or **Add** for hotter light), with 3–4-frame fades at its ends.
- **[rec] Procedural version:**
  - 2–4 large soft blobs: Gaussian or radial gradients with fbm-warped edges, radius 30–80% of H.
  - Warm palette with hue jitter (amber ~30°, magenta ~330°, yellow ~50°).
  - Blobs drift 5–20% W across the duration. Intensity envelope peaks at c; add flicker at ~4 Hz.
  - Under-layer swap with `smoothstep(c − 0.05, c + 0.05, p)`; +0.3 stop global lift at the peak.
  - Screen in linear light.
- **Reframer.** Reframer already uses `@remotion/effects` `lightLeak({progress, seed, hueShift})`. The key fix is to time the A→B swap to the leak's brightest frames.

### R8. Film burn
- Hotter and more destructive than a leak: orange-red edges, a white-hot core that briefly blows to full white, film grain and gate weave.
- **gl `FilmBurn`** (Anastasia Dunbar, MIT):
  - 13 moving light blobs plus sine fields, tinted `(1, 0.7, 0.6)` with per-channel gamma.
  - Envelope `sin(πp)`, 50-tap jittered blur up to 0.03, ~5% scale pulse.
  - A/B mix uses `sigmoid(p, 10)`, a very sharp mid swap.
  - Remotion ported it as `filmBurn()`.
- **Footage workflow.** Burn plates in Screen or Overlay.
- **Use.** Weddings, music videos, nostalgia.

### R9. Push (with motion blur, CA, rolling shutter)
- **Geometry.** A and B are adjacent like a filmstrip. A offset `+d·e·W`, B offset `−d·(1−e)·W`. No edge problem.
- **FI Push** ("slides the following clip over the previous one in any direction"):
  - Direction, Blur, Stretch and Slide controls *(snippet)*.
  - **Visual Curve Editor** for acceleration *(snippet)*.
  - "Motion Blur and Chromatic Aberration features" *(snippet)*.
  - Since 2025.2, a **rolling-shutter** option on Push and Roll *(snippet)*.
- **[rec] Defaults.**
  - Curve: easeInOutQuart/Quint.
  - Blur: auto from velocity (2.3), along d.
  - CA along d, peak 0.3–0.6% W. three.js `RGBShiftShader` defaults to 0.005 W; AE tutorials offset channel layers 5–15 px.
  - Rolling shutter: `x += k·v·(y − 0.5)` with k ≈ 0.1–0.2 frame-height per unit velocity.
  - Optional "stretch": scale along d by `1 + 0.05–0.15·|v|norm`.
- **Shaders.** gl `Directional`, `directional-easing` (`sqrt((2−p)p)` circular ease-out), `DirectionalScaled` (dips to 0.7 scale mid-push, eased `sin(pπ/2)^3`).

### R10. Slide / cover / reveal
- Only one layer moves: B covers a static A, or A uncovers B.
- Blur the moving layer only. A 20–40 px soft shadow on the leading edge sells depth.
- Curves: easeOutQuint / Expo for UI-like snaps. A "bounce" variant uses easeOutBack (≈10% overshoot; ≤5% for footage).
- FI Slide has "speed, bounce, and direction" controls.

### R11. Whip pan (swish pan)
- **Sapphire SwishPan.**
  - Slides A off and B on "and adding motion blur to give the appearance of a quick pan".
  - `Blur Amount 2`, `Slow In 0.5`, `Slow Out 0.5`, `Overlap` ("screened together where overlapping").
- **Sapphire WhipLash.**
  - `Shift X −4` (four frame widths of travel), `Motion Blur 1`, `Whip Out: Smooth/Bounce/Snap`.
  - RGB split: `Shift RGB 2`, `Blur Amount 1.25`.
  - **`Edge Mode: Reflect`**.
- **AE build.** Adjustment layer with **Motion Tile** (Tile Center keyed so a fresh tile fills the frame ~5 f after the cut), mirror edges optional, Easy Ease. Blur keys go 0 → peak at mid → 0 (Photofocus via search; Carl Larsen via ProVideo Coalition).
- **[rec] Defaults.**
  - Total travel 2 W with mirrored world: A 0→1 W by the cut, B −1→0 W after.
  - Curve: easeInOutExpo. Duration 8–12 f.
  - Blur: auto (the frame fully streaks at the cut), capped at ~1 W.
  - Hard swap at the cut. 2–4% overshoot settle on B. CA along motion ≈0.5% W at the peak.
- **SFX.** "whip" centered on the cut.

### R12. Zoom-through in (punch / "Pull in" / Sam Kolder)
- **Sam Kolder recipe in Premiere** (4K Shooters):
  - Adjustment layer with **Replicate (count 3)** and **Mirror** to fill edges.
  - Transform scale **100% at −6 f → 300% at +6 f**.
  - **Shutter ≥300°** ("Use Composition's Shutter Angle" off).
  - Velocity peak on the cut.
- **AE** (Motion Array): Transform zoom on an adjustment layer, **Motion Tile Mirror Edges** on the clip, Transform shutter 180°, Easy Ease then "make the curve more dramatic".
- **[rec] Recipe.**
  - Exponential zoom across the cut (2.6), total Z = 3–5.
  - Zoom center = subject point (FI Zoom Blur lets you "reposition the zoom's center"). B's center can differ for match cuts.
  - Radial blur from log-velocity: sample `center + (uv − center)·z(t_i)/z(t)` over sub-frames.
  - Mirrored sampling for B's <1 scale. Swap at the cut.
  - Extras at the peak: +0.3 stop exposure, radial CA (scale R by 1 + δ and B by 1 − δ, δ ≈ 0.003–0.006), slight barrel (k ≈ 0.1–0.2).
  - Duration 10–14 f; easeInOutQuint.
- **Shaders.** gl `SimpleZoom` (`zoom_quickness 0.8`), `zoomInOut`, `DreamyZoom` (`rotation 6°`, `scale 1.2`, whitening at mid), `CrossZoom`. glfx `zoomBlur` (MIT). Remotion `zoomBlur()` (16 samples, strength 0.35, optional rotation with cover scale).
- **SFX.** Fast whoosh with its peak on the cut, plus an optional bass hit on the beat.

### R13. Zoom out (pull-back)
- Mirror of R12: A shrinks by `1/z(t)` and the revealed area is filled by **mirrored tiles of A**. That reveal is the whole look, which is why Motion Tile / Replicate are essential. B starts zoomed in (Z′ ≈ 2–3) and settles to 1.
- Radial blur points outward.
- Sam Kolder's trademark is "rapidly zooms out to a new scene… layering quick snap zoom outs".

### R14. Cross zoom (classic)
- **gl `CrossZoom`** (rectalogic, MIT; ported by Remotion):
  - The zoom-blur center travels linearly from x = 0.25 → 0.75.
  - Blur strength follows a sinusoidal up-down to `strength 0.4`.
  - The dissolve uses **exponential ease-in-out**, i.e. a near-hard mid swap.
  - 40 jittered taps weighted `4(t − t²)`.
- Corresponds to FI Cross Zoom and Premiere's legacy Cross Zoom.

### R15. Spin / roll (2-D, with rotational blur)
- **AEJuice build.** Motion Tile on an adjustment layer; rotation **0 → 360° over 20 f** (10 before the cut, 10 after); Easy Ease; Transform shutter 180° (use 360° for more blur).
- **gl `tangentMotionBlur`** (MIT):
  - Rotates 180° about pivot (1, 0) with `KeySpline(.68,.01,.17,.98)`.
  - Blur weight `exp(−20(t − 0.5)²)`.
  - Velocity is the finite difference between this frame and the next; 20 taps along it.
- **gl `Revolve_Left`** (bread, MIT), a high-end reference:
  - `maxRotation 1.95 rad` (~112°), `peakZoom 2.22`, `swirl 2.85` (the center spins more than the edges), `barrel 0.38`.
  - **Temporal motion blur over 17 sub-samples**, swap between 0.30 and 0.50, vignette `shadow 0.16`.
  - Envelope: smoothstep rise from 0.10–0.43, fall from 0.43–0.72.
- **[rec] Defaults.**
  - Total θ = 180°–360° split across the cut (A 0→θ/2, B −θ/2→0).
  - Curve: easeInOutQuint. Rotational blur auto.
  - Mirror edges or cover-scale `|cos θ| + ar·|sin θ|`.
  - Optional ×1.1–1.3 zoom pulse at the cut. 15–20 f.
- **Gentle variant.** `DreamyZoom`: rotation 6° and scale 1.2, swap at mid under a white lift.
- FI Roll ("natural spinning or rolling motion"); CapCut "Rotate CCW II".

### R16. 3-D spin / flip / roll / "spinback"
- **FI 3D Spinback.** "Rotate the clip in 3D space… using motion blur and adjustable easing". 3D Roll adds perspective depth.
- **[rec] To keep it modern.**
  - Fast (≤12 f), heavy motion blur, perspective 1200–2000 px.
  - Darken A by up to 30–40% as it turns away (Lambert falloff), fill the background with a blurred, darkened copy instead of black, slight unzoom mid-way (gl `cube` `unzoom 0.3`).
- **Dated forms.** Slow card flips, cube spins with reflections (gl `cube`, `swap`, `doorway`), page peel (gl `InvertedPageCurl`, BSD-3).

### R17. Stretch
- **AEJuice build.**
  - Motion Tile output 300 × 300.
  - **CC Scale Wipe** `Stretch 5` along 90° on adjustment layer 1 (A, keyed to 0 at −10 f) and along −90° on layer 2 (B, keyed to 0 at +10 f).
  - **Directional Blur 90°, length 100 at mid** (0 at ±10 f). Easy Ease.
- **[rec] Shader.** A `scaleX 1 → 4–5` anchored at the trailing edge with a directional streak along the axis; B mirrors this (5 → 1 anchored at the leading edge). Swap at the peak. easeInOutQuart.
- FI Stretch: "stretch and pull the footage across the screen"; Stretch Wipe is the masked version.

### R18. Warp / lens (optics) zoom / liquid
- Barrel distortion `r' = r·(1 + k·r²)` with `k = kmax·Env(p)` (kmax 0.3–0.6), combined with a zoom-through. Sample with mirror.
- Radial CA: per-channel k (`k_R = k(1 + δ)`, `k_B = k(1 − δ)`).
- **Sapphire HyperPush** pushes A forward in Z, then dissolves:
  - `Z Dist To 5`, `Wrap: Reflect`, motion blur on.
  - `Glow Brightness 3` (threshold 0.2), **`Warp Chroma: On`**, `Dissolve Speed 5`, `Slow In/Out 1`.
- **Sapphire Swish3D** has a `Chroma Warp` mode (spectral smear across `Steps 8` with R/G/B colors) and `Rel Amp From 1 / To −1`: B starts at the opposite transform, so the motion continues across the cut.
- Liquid / wave: gl `crosswarp`, `directionalwarp`, `morph`, `displacement` (needs a map), `ripple`, `WaterDrop`. FI Liquid Distortion / Wave / Glass.

### R19. Camera shake / earthquake transition
- **Kyler Holland (Premiere), three adjustment layers across a 20 f window (10 + 10):**
  1. Shake: Offset, **Replicate 2**, **Mirror ×4** (0°, 90°, −90°, 180°, one per edge), **Transform scale 200%**, shutter ~200°, aggressive position keys at the cut.
  2. **Lens Distortion** curvature animated in and out.
  3. **Color Emboss** for "a handful of frames on the cut".
- **[rec] Shake model.**
  - `offset(t) = A·exp(−λ|t − c|)·noise(f·t)` with A = 3–8% W, f = 10–15 Hz, λ so it decays in ~6 f.
  - Rotation ±1–3°, directional blur along the instantaneous velocity.
- FI Earthquake; CapCut Zoom Shake 2 / Tremble Zoom; Mister Horse Camera Shake.

### R20. Glitch / datamosh / RGB split
- **Ingredients:**
  1. **Band / block displacement.** Rows quantized to 20–45 bands, each shifted by `hash(row, step)` up to 5–15% W; occasional block tiles.
  2. **RGB split.** R and B offset in opposite directions, 0.3–3% W, pulsing.
  3. **Scanlines and noise.**
  4. **Temporal stepping** at 8–15 Hz.
  5. **Non-monotonic reveal.** Flick back to A at least once. gl `Drop_Zone_Flicker` encodes a 24-frame table, e.g. reveal 0 → .28 → .46 → .38 → .48 → .26 → 0 → … → 1.
  6. **Strobe / exposure pulses.**
  7. **Datamosh residue.** Smear old pixels through bands.
- **gl `StripDatamoshGlitch` defaults** (bread, MIT): `horizontalBars 42`, `verticalSlits 18`, `tear 0.18`, `chroma 0.032`, `residue 0.62`, `noiseAmount 0.16`, `scanAmount 0.13`, `flashAmount 0.2`, burst `sin(πp)^0.42`, state `floor(p·30)`.
- **gl `GlitchMemories`.** 16 px blocks; channel offsets 0.2 / 0.3 / 0.5 × displacement.
- **Sapphire DissolveDigitalDamage.** Freeze-frame, block-shifting (amount 0.1), bright noise, pixelation (frequency 40), block noise, inversion and flow layers. `Slow In/Out 0.2`.
- **AE native.** Fractal Noise `Block` type with Scale Width ≫ Height drives a **Displacement Map** ("Wrap Pixels Around"). **Shift Channels** ×3 in Screen with 5–15 px offsets. Wave Warp `Square` gives quick slices.
- **Duration.** 6–15 f. **SFX** must be synced to the state changes.

### R21. VHS damage / TV power-off / static
- **VHS.** A rolling tracking band of noise, horizontal chroma bleed (blur and offset chroma), head-switching tear at the bottom 5%, desaturation, wobble.
- **TV power-off.** Collapse `scaleY → ~0.005` (4–6 f), then `scaleX → 0`, with brightness up to white and a glow dot.
- **Sources.** gl `TVStatic`, `old_tv_lost_signal`, `static_wipe`; `@remotion/effects` `tvSignalOff`, `scanlines`; FI VHS Damage / TV Power.

### R22. Linear / soft wipe, light sweep, neon wipe
- **Mask edge.**
  ```
  s(p) = e·(1 + 2f) − f
  m = smoothstep(s − f, s + f, dot(uv − 0.5, n) + 0.5)
  ```
  Feather f = 2–15% W; any angle n.
- **Modern variants.**
  - FI Light Sweep: an additive bright band riding the edge, 3–8% W wide.
  - FI Neon Wipe: a colored glow line on the edge.
  - FI Soft Wipe: a lens-blurred edge.
- gl `directionalwipe` (`smoothness 0.5`), `wipeLeft/Right/Up/Down`, `wind` (ragged, `size 0.2`).
- Hard-edged wipes are retro on purpose.

### R23. Clock (radial) wipe
- **Mask.** `a = fract((atan(y, x) − a0)/2π)`; reveal where `a < e`.
  - Feather in angle space (~1–3°). Scale feather by 1/r for constant pixel softness.
  - Optionally add an additive light line on the hand.
- **Shader.** gl `angular` (`startingAngle`).
- **CSS.** `mask-image: conic-gradient(from <a0> at 50% 50%, #000 0 calc(var(--a) − 2deg), transparent calc(var(--a) + 2deg))`.
- Reframer currently fakes this with iris plus rotation; replace it with the conic mask.

### R24. Iris / shape reveal
- **Circle.** Radius grows from 0 to `0.5·sqrt(1 + ar²)` (in H units, to cover the corners). Feather 1–5% H. Optional B scale 1.1→1 and a ring of edge blur.
- **Shader.** gl `circleopen` (`smoothness 0.3`).
- **Dated.** Star, heart and diamond shapes (Adobe obsoleted or relegated them; gl `heart`, `StarWipe`).

### R25. Split / slice / louver / panel
- **[rec]** N strips (4–12): vertical, horizontal or diagonal. Each strip moves with a staggered delay (stagger spread 20–40% of the duration), blur along the strip motion, and alternate directions for "split".
- **Shaders.** gl `windowslice` (`count 10`, `smoothness 0.5`), `splitSlide*`, `BowTie*`.
- **Plugins / apps.** FI Slice / Split / Panel Wipe / Louver; CapCut Horizontal/Diagonal Slice and Blinds; Mister Horse Split.

### R26. Ink / brush / matte / shape-matte transitions
- **Footage-matte method.** A black-and-white matte clip drives B's visibility: white reveals, black hides, gray is partial.
  - Premiere: **Track Matte Key → Composite Using: Matte Luma**, with *Reverse* for ink mattes; AE luma/alpha mattes.
  - Ink footage used as a luma matte "flows" B in.
- **[rec] Procedural method.**
  ```
  n = fbm(uv·scale + flow(t)) + radialBias(uv)
  m = smoothstep(t' − s, t' + s, n)
  ```
  - Add an edge-darkening fringe `(m·(1 − m))·k` for an "ink bleed".
  - Brush strokes: SDF stroke paths that grow along a path (via `@remotion/paths`) as the mask.
- **Shaders.** gl `perlin` (`scale 4`, `smoothness 0.01`), `randomNoisex`, `crosshatch`, `undulatingBurnOut`, `luma` (with a matte texture); Sapphire WipeBlobs / WipeClouds / WipePlasma.
- Mister Horse **Shapes 101 + Matte 54** are its biggest categories. This family is how brands do on-brand transitions: shapes in brand colors sweep across, then B appears behind the last shape.

### R27. Mosaic / pixelate
- Pixel size peaks at c with quantized steps.
- gl `pixelize` (`squaresMin 20`, `steps 50`); FI Mosaic; CapCut Hexa Mosaic (gl `hexagonalize`).
- Retro, game or tech vibe.

### R28. Push-cut (editorial punch) and morph cut
- **Remotion `pushCut`** (CSS) defaults:
  - `cutProgress 5/11`.
  - Outgoing scale 1 → **1.04** (easeInQuad); incoming **1.04 → 1.07** (easeOutQuad).
  - **2-frame flash** `#f5f2ed` at 20% opacity.
  - Great for jump cuts in talking heads.
- **Morph Cut / Smooth Cut / Flow.** All three use optical flow (Premiere's also uses face tracking) to interpolate across a jump cut. FCP's is fixed at 6 frames. They work best with a locked-off camera and minimal head motion (Larry Jordan).
- Building this requires optical flow (e.g. a RAFT-class model in the render worker). It is a natural future "AI transition".

---

## 4. Open-source shader sources

### 4.1 The GL Transition interface (spec v1)
```glsl
// Provided by the host: float progress (0→1), float ratio (= width/height)
// vec4 getFromColor(vec2 uv), vec4 getToColor(vec2 uv)
uniform float strength; // = 0.4      ← default parsed from the comment
vec4 transition(vec2 uv) { return mix(getFromColor(uv), getToColor(uv), progress); }
```
- At `progress 0.0` the output must be *exclusively* `from`; at `1.0`, exclusively `to`. Parameters are constant over a run.
- The host implements `getFromColor` / `getToColor`. That is where you put **aspect-correct fit and the out-of-bounds policy**: mirror wrap, so imported shaders never show black.
- **Remotion's HTML-in-canvas port convention.** `draw({prevImage, nextImage, width, height, time, passedProps})` with `time` running 1 → 0. Port with `float progress = 1.0 - u_time;`, `getFromColor → texture(u_prev, uv)`, `getToColor → texture(u_next, uv)`.

### 4.2 gl-transitions worth shipping (all from `gl-transitions@1.71.0`; 125 total)

| Name | Author | License | What it gives you (defaults) | Verdict |
|---|---|---|---|---|
| fade | gre | MIT | Dissolve | Pro |
| fadecolor | gre | MIT | Dip to color (`colorPhase 0.4`) | Pro |
| fadegrayscale | gre | MIT | Dissolve through B&W (`intensity 0.3`) | Pro |
| colorphase | gre | MIT | Per-channel staggered dissolve | Pro / creative |
| LinearBlur | gre | MIT | Blur dissolve (`intensity 0.1`) | Pro |
| DefocusBlur | Sergey Kosarevsky | MIT | Bokeh-ish dissolve (`blurSize 0.02`) | Pro |
| Overexposure | Ben Zhang | MIT | Exposure flash (`strength 0.6`) | Pro |
| burn | gre | MIT | Colored additive burn | Creator |
| luma | gre | MIT | Luma-map wipe (needs texture) | Pro (with good maps) |
| luminance_melt | 0gust1 | MIT | Luminance-gated melt | Creative |
| perlin | Rich Harris | MIT | Noise dissolve (`scale 4`) | Pro / creative |
| directionalwipe | gre | MIT | Soft wipe (`smoothness 0.5`) | Pro |
| circleopen | gre | MIT | Feathered iris (`smoothness 0.3`) | OK |
| angular | Fernando Kuteken | MIT | Clock wipe | OK |
| windowslice | gre | MIT | Slices (`count 10`) | OK |
| Directional / directional-easing | gre / Max Plotnikov | MIT | Push (eased) | Pro base |
| DirectionalScaled | Thibaut Foussard | MIT | Push with scale dip (`scale 0.7`) | Creator |
| CrossZoom | rectalogic | MIT | Cross zoom (`strength 0.4`) | Creator |
| SimpleZoom / zoomInOut / ZoomInCircles | 0gust1 / OllyOllyOlly / dycm8009 | MIT | Zoom transitions | Creator |
| DreamyZoom | Zeh Fernando | MIT | Rotate + zoom + white lift (`6°`, `1.2`) | Creator |
| tangentMotionBlur | chenkai | MIT | Spin with tangential blur | Creator |
| Revolve_Left | bread | MIT | Spin + swirl + barrel + temporal blur | Creator (high quality) |
| crosswarp / directionalwarp / morph | Eke Péter / pschroen / paniq | MIT | Warp / morph wipes | Creative |
| displacement | Travis Fischer | MIT | Map-driven displacement (needs map) | Creative |
| FilmBurn | Anastasia Dunbar | MIT | Film burn | Creator |
| GlitchMemories / GlitchDisplace | Gunnar Roth / Matt DesLauriers | MIT | Glitch | Creator |
| StripDatamoshGlitch / Drop_Zone_Flicker | bread | MIT | Datamosh / flicker glitch (rich params) | Creator (high quality) |
| parametric_glitch | Yoni Maltsman | MIT | Parametric glitch | Novelty |
| pixelize / hexagonalize | gre / F. Kuteken | MIT | Mosaic | Novelty |
| squeeze | gre | MIT | Squeeze + color separation | Novelty |
| ripple / WaterDrop / Dreamy | gre / P. Płóciennik / mikolalysenko | MIT | Liquid | Novelty |
| TVStatic / static_wipe / old_tv_lost_signal | various | MIT | TV / static | Retro |
| EdgeTransition | Woohyun Kim | MIT | Edge-detect morph | Creative |
| cube / doorway / swap / InvertedPageCurl / heart / StarWipe / PolkaDotsCurtain / pinwheel / BowTie* | various | MIT (**InvertedPageCurl: BSD-3-Clause, Hewlett-Packard**) | 3-D cube, doors, page curl, shapes | **Dated** |
| StereoViewer | Ted Schundler | **BSD-2-Clause** | Stereo "viewer" | Novelty |

The JSON includes `paramsTypes` and `defaultParams` for UI generation (`https://unpkg.com/gl-transitions@1/gl-transitions.json`). BSD transitions need their notice reproduced.

### 4.3 Other building blocks

| Library | License | Useful pieces |
|---|---|---|
| **glfx.js** (Evan Wallace) | MIT | `zoomBlur` (40 jittered taps, premultiplied), `triangleBlur`, `lensBlur`, `tiltShift`, `swirl`, `bulgePinch`, `hexagonalPixelate`, `noise`, `vignette` |
| **Jam3/glsl-fast-gaussian-blur** | MIT | `blur5/9/13(image, uv, resolution, direction)`, a separable directional Gaussian using linear-sampling taps |
| **three.js examples** | MIT | `RGBShiftShader` (`amount 0.005`, `angle`), `DigitalGlitch` (`amount 0.08`, …), `FilmShader`, `Horizontal/VerticalBlurShader` |
| **pmndrs/postprocessing** | Zlib | ChromaticAberration, Glitch, Scanline, Noise, Bloom, ShockWave, Kawase blur |
| **ashima/webgl-noise** | MIT | Simplex / Perlin noise (used by `luminance_melt`) |
| **FFmpeg `xfade`** | LGPL-2.1+ (C, not GLSL) | 50+ named transitions (fade, wipe*/slide*/smooth*, circleopen/close, dissolve, pixelize, **hblur**, fadegrays, squeezeh/v, **zoomin**, wind*, cover*/reveal*). Useful as a naming reference or server fallback. |
| **@remotion/transitions**, **@remotion/effects** (4.0.533, installed) | **Remotion License** (source-available; free for individuals and companies with ≤3 people, otherwise a company license) | Use them as dependencies, but **don't copy their code** into Reframer's own permissive code. Effects available: `blur` (axis toggles), `zoomBlur`, `chromaticAberration(amount, angle)`, `barrelDistortion`, `exposure(stops)`, `glow`, `lightLeak`, `lightTrail`, `tile`, `mirror`, `noiseDisplacement`, `pixelDissolve`, `tear`, `tvSignalOff`, `scanlines`, `wave`. |
| **@remotion/motion-blur** | MIT | `<CameraMotionBlur shutterAngle samples>` (sub-frame accumulation; "destructive to colors"), `<Trail>` |
| **LYGIA** | Prosperity (non-commercial) + Patron | **Avoid** unless you sponsor |
| **Shadertoy** code | Default CC BY-NC-SA 3.0 unless the author states otherwise (widely documented; the terms page was blocked to my fetcher, so verify) | **Avoid copying** |

---

## 5. Sound pairing

### 5.1 Timing rules
- **Peak on the cut.** A whoosh's loudest point lands on the swap frame. "Match the length of the whoosh to the length of the move."
- **Risers end on the cut.** "The effect's peak should land on a strong beat"; effects should "end on the cut rather than starting on it" (MixClap).
- **Impacts start on the cut.** Reframer's `impact` and `vine-boom` "land on [their] first frame".
- **Mix level.** Sit transition SFX "3–6 dB below the main track", and alternate SFX families to avoid repetition (MixClap).
- **Trailers.** Cuts to black pair with "hits, bass drops, and cavernous hits"; cuts to white with hits and whooshes. "Music stop downs" are "the bread and butter of trailer transitions" (Derek Lieu).
- **Packs ship SFX.** Videolancer's Premiere pack includes SFX with each transition, so creators expect the pairing.

**Reframer's built-in IDs** (`src/core/sfx.ts`) and their peaks:
- `whoosh`: 0.70 s, peak ~0.45 s. Start it 0.45 s before the cut.
- `whoosh-fast`: peak ~0.19 s.
- `swoosh`: peak ~0.17 s.
- `whip`: centered ~0.12 s.
- `glitch`, `static`.
- `riser` (2 s) and `riser-short` (1 s): end on the cut.
- `impact`, `boom`, `sub-drop`, `bass-hit`, `braam`, `shutter`, `pop`, `paper`, `sparkle`, `vine-boom`.

### 5.2 Transition → sound

| Transition | SFX family | Reframer id(s) | Placement |
|---|---|---|---|
| Cut / J-L cut / dissolve | None. Use an audio crossfade or J/L overlap. | — | Constant-power crossfade |
| Dip to black | Hit, boom, sub-drop, or silence / music stop-down | `impact`, `boom`, `sub-drop`, `braam` | Hit on the first black frame, or on the cut back in |
| Flash / dip to white | Hit, camera shutter, short whoosh; riser into it | `impact`, `bass-hit`, `shutter`, `riser-short` | Hit on the flash peak; riser ends there |
| Whip pan | Whip / swish | `whip`, `whoosh-fast` | Center on the cut |
| Push / slide | Whoosh / swoosh / paper | `whoosh`, `swoosh`, `paper` | Peak on the cut; length = move |
| Zoom-through | Fast whoosh (+ bass hit on beat), or riser into the cut | `whoosh-fast`, `bass-hit`, `riser-short` | Peak or end on the cut |
| Spin / roll | Swoosh (doppler-y) | `swoosh`, `whoosh` | Peak on the cut |
| Stretch / warp | Zip / fast whoosh | `whoosh-fast` | Peak on the cut |
| Shake / earthquake | Impact / boom / sub | `impact`, `boom`, `sub-drop` | First shake frame |
| Glitch / RGB / datamosh | Glitch stutter, data chirps | `glitch` | Bursts synced to state changes |
| VHS / TV power / static | Static, CRT click / thunk | `static`, `switch` | On collapse / snap |
| Light leak / film burn | Soft whoosh, reverse cymbal, shimmer, or nothing | `whoosh`, `sparkle`, `riser-short` | Swell peaks with the leak |
| Luma fade / ink / matte | Soft whoosh, brush or paper, or nothing | `whoosh`, `paper` | Swell to the midpoint |
| Shapes / slices / wipes (graphic) | Swoosh, pop, click per element | `swoosh`, `pop`, `click` | Each element's entrance |
| Push-cut / punch-in | Bass hit, or meme boom for comedy | `bass-hit`, `vine-boom` | On the cut |
| Morph cut | None | — | — |

### 5.3 Edit style → transition palette

| Style / genre | Palette |
|---|---|
| Documentary, interview, corporate | Cuts, J/L cuts, cut on action, 12–24 f dissolves for time passing, dip to black between acts, push-cut or morph cut for jump cuts, B-roll covers |
| Trailer / promo | Hard cuts on beats, cut / dip to black, flash frames and dips to white, title cards, impacts and risers, music stop-downs; glitch for tech |
| Travel / vlog (Sam Kolder school) | Zoom-throughs, whips, spins, speed ramps, match cuts, light leaks |
| Wedding / lifestyle | Dissolves, film dissolve, blur dissolve, light leaks, film burns, slow luma fades |
| Music video / hype | Flash, strobe cuts on beats, glitch / RGB split, shake, stretch, velocity ramps |
| Gaming / esports | Glitch, shake, zoom blur, impact flashes, pixelate |
| Short-form social (CapCut) | Pull-in zoom, shake, flash, swipe / whip, velocity edits, glitch, blur; beat sync |
| Tech / product / SaaS | Push / slide with blur, mask reveals, zoom-throughs into UI, light sweep, clean soft wipes, push-cut |
| Kids / comedy | Shapes, pops, spins, cartoon SFX; dated shapes acceptable ironically |

---

## 6. Implementation guidance for Reframer

### 6.0 What the codebase does today (read-only observations)
- **Transitions** live in `src/remotion/transitions.ts`:
  - `transitionVisual()` returns a per-layer `AnimState` (`dx`, `dy`, `scale`, `blur`, `opacity`, `rotate`, `rotateY`, `skewX`, `inset`, `circle`) plus an overlay or light-leak flag.
  - The entering clip owns the transition and the exiting clip borrows tail frames.
- **A `TransitionFx` model is in progress** (uncommitted when I looked: `motionBlur {x, y}`, `zoomBlur`, `rgbSplit {amount, angle}`, `exposure`, `lens`):
  - `transitionCanvasEffects()` maps it onto `@remotion/effects` (`blur` with axis toggles, `zoomBlur`, `chromaticAberration`, `exposure`, `barrelDistortion`) for media layers.
  - `TransitionFilter.tsx` (untracked) builds an SVG filter for DOM layers: `feGaussianBlur stdDeviation="x y"` plus a `feColorMatrix`/`feOffset` RGB split recombined with `feBlend screen`.
  - The recipes in `transitionVisual` still use the old constants: whip blur = `sin(πp)·40`, glitch = per-frame random jitter, clock wipe = iris + rotate.
- **Render** passes `gl: "angle"` when a GPU is detected and `null` otherwise. WebGL transitions need `angle`, or `swangle` on GPU-less machines.

### 6.1 One recipe model for both back-ends
```ts
type TransitionRecipe = {
  id: string; taste: "pro" | "creator" | "novelty" | "dated";
  duration: { seconds: number };          // frames derived per fps (2.8)
  cut: number;                             // swap point, default 0.5
  curve: [number, number, number, number]; // cubic-bezier for e(p); per-side overrides allowed
  side: {                                  // transform of each side as a function of eased t
    A: (t: number) => Xform;               // {tx, ty (in W/H), logScale, rotate, skewX, scaleX, anchor}
    B: (t: number) => Xform;
  };
  optics: {
    shutter: number;                       // 180 default; blur is DERIVED from Xform velocity
    rgbSplit?: Env; exposure?: Env; lens?: Env; glow?: Env; shake?: ShakeSpec; grain?: number;
  };
  swap: { kind: "hard" | "mix" | "mask"; window: number; mask?: MaskSpec }; // luma, linear, conic, noise…
  edge: "mirror" | "repeat" | "clamp" | "transparent";
  sfx?: { id: string; align: "peak-on-cut" | "end-on-cut" | "start-on-cut" };
};
```
- **Motion blur is computed, not authored.** For each side, evaluate `Xform(t ± shutter/360 · 1/frames)` and derive the screen-space velocity field (translation → directional, d(logScale) → radial, d(rotate) → tangential). This removes every hand-tuned `blur: sin(πp)·40`.
- **One recipe, two renderers.** The GPU renderer samples the inverse transform at sub-frames. The DOM renderer converts the same velocity into an SVG streak or `CameraMotionBlur`. The look stays consistent across clip types.

### 6.2 (a) Full-frame media → media: WebGL2 transition compositor
1. **Inputs.**
   - Both sides as textures. Video frames come from `@remotion/media` `<Video onVideoFrame>` (or `<OffthreadVideo onVideoFrame>`), which passes a `CanvasImageSource`.
   - Ideally each side's *already-effected* output canvas (clip transform, crop and color effects applied), so the transition operates on what the user sees.
2. **Frame sync in headless render.**
   - Take a `delayRender` handle per frame and draw only when **both** sides have delivered the frame for the current timestamp; then call `continueRender`.
   - Otherwise renders will intermittently capture stale textures.
3. **Shader API.**
   - Accept **gl-transitions v1 code unchanged** (`transition(uv)`, `getFromColor`, `getToColor`, `progress`, `ratio`, `// = default` uniforms) so all 125 MIT shaders import directly.
   - Add a Reframer prelude with:
     - `resolution`, `frame`, `fps`, `durationFrames`, `seed`, `cut`, `shutter`, `direction`, `center`;
     - `getFromColor`/`getToColor` doing **cover/contain fit and mirrored wrap** (`uv = 1 − abs(mod(uv, 2) − 1)`);
     - `toLinear`/`toSRGB`, `hash(vec3)` seeded by frame, `fbm`, a directional **box streak** helper;
     - `sampleSide(side, uv, t)` that applies the recipe's inverse transform.
4. **Generic temporal motion blur.**
   - `color = Σ_i w_i · getSide(T_side(t_i)⁻¹(uv))` over N = 16–32 sub-times with per-pixel jitter (the `Revolve_Left` pattern).
   - Sub-samples that straddle the cut automatically produce a physically plausible 1-frame swap.
5. **Multi-pass.** Support FBO passes for bloom (threshold → H blur → V blur at half resolution → add) and two-pass coarse/fine streaks, as Remotion's `blurSlide` does with 32 × 32 taps.
6. **Color.**
   - Upload as sRGB (`SRGB8_ALPHA8` on WebGL2) or decode in-shader, and composite in linear.
   - Use premultiplied alpha for clips with transparency.
   - Add 1-LSB dither at output.
7. **Determinism and performance.**
   - No time or `Math.random`.
   - 1080p with 2 × 32 taps is a few ms on a GPU. SwiftShader is far slower but works. For GPU-less renders, use `gl: "swangle"` or fall back to path (b).
   - The Remotion docs require `--gl=angle` for WebGL shaders in render.
8. **HTML-in-canvas (optional upgrade).**
   - Remotion's `makeHtmlInCanvasPresentation` rasterizes *whole scenes*, DOM included, into `prevImage`/`nextImage`.
   - Rendering works out of the box since **4.0.455** (Remotion's Chrome build has the flag on).
   - Preview needs **Chrome 149+ with `chrome://flags/#canvas-draw-element`**; nesting needs Chrome 157+.
   - It's experimental ("Chrome may change the API or even remove it"), and Electron's Chromium support is unverified. Treat it as progressive enhancement.

### 6.3 (b) Transitions involving text, shapes and React layers

What gives about 90% of plugin quality, in order of impact:

1. **The same curve and cut-at-peak timing as the GPU version.** Exponential scale, swap hidden at the velocity peak, settle with ≤5% overshoot. This alone separates "crude CSS" from "plugin".
2. **Velocity-derived directional blur.**
   - *Best:* an SVG filter **streak**. Take 8–12 `feOffset` taps along the velocity vector (any angle) and sum them with `feComposite operator="arithmetic" k2/k3` at 1/N weights. That is a true box motion blur.
   - *Cheap:* `feGaussianBlur stdDeviation="sx sy"`, axis-aligned only and Gaussian-soft (what `TransitionFilter.tsx` does now). Enlarge the filter region (`x="-50%" width="200%"`) along the motion so streaks aren't clipped.
   - *Hero:* `<CameraMotionBlur shutterAngle={180} samples={6–10}>`, mounted **only during the transition window**. It is exact for any transform, including zoom and spin, at N× render cost, and slightly "destructive to colors".
3. **Seam-free compositing.**
   - When A and B abut (push, whip) or cross-fade, two blurred layers composited with normal "over" leave a **dark seam / alpha dip**. With complementary alphas, total alpha is αB + (1 − αB)², which is 0.75 at the midpoint.
   - Set **`mix-blend-mode: plus-lighter`** on both sides during the transition so alphas sum to 1. This is the W3C View Transitions rationale.
4. **A light hit at the cut.**
   - 1–2 frames of exposure or flash: an overlay with `mix-blend-mode: screen` or `plus-lighter`, or `filter: brightness()` on the layer.
   - Or a full-frame procedural light leak (`@remotion/effects` `lightLeak` on a `<Solid>`). It hides whatever imperfection remains.
5. **Sound** with its peak on the cut (section 5).

The remaining ~10% is polish:
- **RGB split.** SVG `feColorMatrix` → `feOffset` per channel, recombined with arithmetic add rather than `feBlend screen`, which fringes on anti-aliased alpha edges. Or render red and cyan text copies in `plus-lighter`.
- **Radial / zoom blur on DOM.** 5–8 stacked copies at successive scales with decaying opacity (an echo / trail), or `CameraMotionBlur`.
- **Masks.** CSS `mask-image` with `linear-gradient` (soft wipes), `radial-gradient` (iris), `conic-gradient` (**real clock wipe**). Luma or ink mattes via an SVG `<mask>` (luminance by default) or `mask-mode: luminance` over a matte image or video.
- **Lens and displacement.** SVG `feTurbulence` + `feDisplacementMap` for liquid or glitch warps on DOM. It's CPU-heavy, so limit it to transition frames.
- **Glitch on DOM.** 3–6 duplicates clipped to bands with `clip-path: inset()`, each with an x-offset, plus an RGB split. Change state at 8–15 Hz using a frame-seeded hash.
- **Edges on full-bleed DOM backgrounds.** Overscan (scale 1.1–1.2) or mirrored duplicates (`scaleX(-1)` neighbors), the DOM equivalent of Motion Tile.
- **Text-specific rule.** Keep text legible: blur only near peak velocity and keep overshoot "very small" (Olaf Motion). Prefer per-element in/out animation over full-frame optics when the incoming scene is mostly typography.

### 6.4 Concrete issues in the current recipes
- **whip / push / zoom.** CSS `blur()` is isotropic and pulls transparency into frame edges (dark borders). Blur is hand-tuned (`sin(πp)·40`) instead of derived from velocity. Swap the media path to directional streaks and the DOM path to SVG streaks, and use `plus-lighter` for the abutting layers.
- **zoom-in / zoom-out.**
  - Linear scale with opacity crossfades reads as ghosting. Use an exponential zoom across the cut with a hard swap at the peak and radial blur.
  - `zoom-out` scales A below 1 and reveals black. Mirror-tile it (GPU) or overscan.
- **spin.** ±180° with scale 0.5 and opacity fades reveals corners and ghosts. Use rotational blur, cover-scale or mirror, and a swap at the peak.
- **glitch.** Per-frame random `dx`/`skewX` plus random opacity is "crude". Step states at 12 Hz and add band displacement, RGB split, a non-monotonic reveal, scanlines and noise (gl `StripDatamoshGlitch` parameters as a template).
- **clock-wipe.** Replace the faked iris + rotate with a conic mask (CSS) or `angular` (GL).
- **flash / dips.** Use a linear-light exposure ramp with asymmetric rise and decay plus bloom, rather than a flat white overlay.
- **light-leak.** Swap A→B under the leak's brightest frames, not on a linear opacity ramp.
- **flip.** Keep it as a "dated/novelty" tier. If it stays, make it fast with motion blur and a filled background.
- **barrelDistortion** returns transparent outside the frame, so pair it with overscan when `fx.lens > 0`.

### 6.5 Suggested build order
1. Recipe model + curve library (section 2.2 presets) + velocity-derived blur on both back-ends, with `plus-lighter` compositing. This upgrades push, slide, whip, zoom and spin immediately.
2. WebGL compositor for media↔media: gl-transitions loader (MIT subset, BSD notices), mirror and fit, linear light, temporal motion blur, bloom pass.
3. Pro set first: film dissolve, blur dissolve, luma fade, flash (exposure), dip, light leak (swap under the peak), whip, zoom-through, push with CA + rolling shutter.
4. Creator set: spin / roll, stretch, shake (+ lens), glitch (12 Hz), film burn, ink/shape mattes (procedural + matte clips), slices, clock and iris (feathered).
5. SFX auto-pairing using the table in 5.2, with peak alignment from each SFX's documented peak time, plus taste lint (tiers, frequency caps, motivation).
6. Optional: HTML-in-canvas path for mixed scenes; optical-flow morph cut.

---

## 7. Sources

**Popularity / vendors / NLEs**
- Adobe: Effects and transitions changes in Premiere 26.0: https://helpx.adobe.com/premiere/desktop/add-video-effects/effects-and-transitions-library/list-of-effects-and-transitions.html
- Adobe: Modern transitions in Premiere: https://helpx.adobe.com/premiere/desktop/add-video-effects/types-of-effects/transitions.html
- Adobe: Video dissolve transitions (Film Dissolve = linear, gamma 1.0): https://helpx.adobe.com/premiere/desktop/add-video-effects/effects-and-transitions-library/list-of-video-dissolve-transitions.html
- Adobe blog, 90+ effects (25.5): https://blog.adobe.com/en/publish/2025/09/09/introducing-more-than-90-new-effects-transitions-animations-in-premiere-pro
- ProVideo Coalition, Adobe acquires Film Impact: https://www.provideocoalition.com/adobe-acquires-film-impact-premiere-pro-25-5/
- postPerspective, Premiere 25.5: https://postperspective.com/an-editors-take-top-5-features-in-adobe-premiere-pro-25-5/
- Digital Production, 90+ Film Impact effects: https://digitalproduction.com/2025/09/09/premiere-pro-gains-90-film-impact-effects-plug-in-now-built-in/
- Photography Bay, FilmImpact TP1 (2012): https://photographybay.com/2012/07/17/filmimpact-nets-transition-pack-1-for-premiere-pro-released/
- Film Impact Push / changelog (now redirect to Adobe; snippets): https://www.filmimpact.com/premiere-pro-transitions/essentials-collection/push-impacts, https://www.filmimpact.com/changelog/version-2025-2
- Mister Horse transitions pack: https://misterhorse.com/products/filmmakers-transitions/3266 · Premiere Composer: https://misterhorse.com/premiere-composer · aescripts listing: https://aescripts.com/transitions-for-premiere-composer/
- VideoHive Videolancer AE: https://videohive.net/item/handy-seamless-transitions-pack-script/18967340 · Premiere: https://videohive.net/item/handy-transitions-for-premiere-pro/22125468
- MotionVFX: https://www.motionvfx.com/store,mtransition-light-2,p2494.html · https://www.motionvfx.com/collections/mtransition-zoom-vol-3 · https://www.motionvfx.com/store,mtransition-distortion-dvr,p3973.html
- Boris FX Sapphire docs: index https://borisfx.com/documentation/sapphire/ae/ · SwishPan https://borisfx.com/documentation/sapphire/ae/swishpan/ · DissolveGlow https://borisfx.com/documentation/sapphire/ae/dissolveglow · DissolveBlur https://borisfx.com/documentation/sapphire/ae/dissolveblur/ · WhipLash https://borisfx.com/documentation/sapphire/ae/whiplash/ · HyperPush https://borisfx.com/documentation/sapphire/ae/hyperpush/ · DissolveLuma https://borisfx.com/documentation/sapphire/ae/dissolveluma/ · DissolveLightLeak https://borisfx.com/documentation/sapphire/ae/dissolvelightleak/ · DissolveDigitalDamage https://borisfx.com/documentation/sapphire/ae/dissolvedigitaldamage/ · Swish3D https://borisfx.com/documentation/sapphire/ae/swish3d/
- Resolve transitions guide: https://tryuncle.com/learn/davinci-resolve/transitions
- Larry Jordan, Flow vs Morph Cut: https://larryjordan.com/articles/making-the-best-of-a-bad-transition-flow-vs-morph/
- Apple FCP transitions: https://support.apple.com/guide/final-cut-pro/intro-to-transitions-ver2833f6b2/mac · default duration: https://support.apple.com/guide/final-cut-pro/set-the-default-duration-for-transitions-verad58cdd16/mac
- CapCut: https://www.capcut.com/tools/free-video-transitions · https://www.capcut.com/help/capcut-transitions · https://www.capcut.com/resource/youtube-transitions · https://contentcreatortemplates.com/learn/capcut/best-capcut-transitions · https://sendshort.ai/guides/capcut-transitions/ · https://beverlyboy.com/film-technology/top-5-must-try-transitions-in-capcut-for-pro-level-edits/ · https://en.wikipedia.org/wiki/CapCut
- Creative COW, most overused transitions: https://creativecow.net/forums/thread/most-overused-transitions/ · Film Editing Pro: https://www.filmeditingpro.com/editing-101-avoid-cheesy-video-effects/
- Inside Editors: https://insideeditors.com/video-editing-transitions/ · Wikipedia Film transition: https://en.wikipedia.org/wiki/Film_transition · Dissolve: https://en.wikipedia.org/wiki/Dissolve_(filmmaking)
- Derek Lieu: https://www.derek-lieu.com/blog/2018/2/24/good-transitions-make-great-trailers · https://www.derek-lieu.com/blog/2019/3/27/the-dip-to-black
- PremiumBeat, documentary editing: https://www.premiumbeat.com/blog/video-editing-tips-cutting-documentary/

**Technique**
- 4K Shooters, Sam Kolder zoom: https://www.4kshooters.net/2017/02/18/creating-the-appealing-sam-kolders-smooth-zoom-in-and-zoom-out-transition-effects-in-premiere-pro-cc/
- Motion Array, zoom blur transition (AE): https://motionarray.com/learn/after-effects/zoom-blur-transition-after-effects/
- Olaf Motion, smooth transitions: https://olafmotion.com/tutorials/how-to-create-smooth-transitions-in-after-effects-step-by-step-guide/
- Adobe AE speed / Easy Ease (33.33%): https://helpx.adobe.com/after-effects/using/speed.html · Exponential scale: https://motiondesign.school/blog/exponential-scale-in-after-effects/
- AEJuice spin: https://aejuice.com/blog/how-to-do-a-spin-transition-on-after-effects/ · stretch: https://aejuice.com/blog/how-to-create-a-smooth-stretch-transition-in-after-effects/
- Kyler Holland, distortion shake: https://www.kylerholland.com/blog/distortion-shake-transition-premiere-pro
- ProVideo Coalition, whip pans: https://www.provideocoalition.com/whip-swish-pans-in-after-effects-premiere/
- Motion blur shutter defaults (Creative COW): https://creativecow.net/forums/thread/motion-blur-shutter-angle-phase/ · Transform shutter (Cinecom): https://www.cinecom.net/adobe-premiere-pro-tutorials/video-effects/motion-blur-with-the-transform-tool-in-premiere-pro/
- Glitch / RGB split tutorials: https://motionarray.com/learn/after-effects/glitch-transition-after-effects/ · https://schoolofmotion.com/blog/how-to-create-a-glitch-effect-in-after-effects · https://glitchology.com/rgb-split/ · https://cgi.tutsplus.com/how-to-create-chromatic-aberration-in-after-effects--cms-31288t
- Light leaks (Screen vs Add): https://www.enchanted.media/how-to-use-light-leaks-in-premiere-pro/ · Film burns: https://www.videomaker.com/how-to/editing/editing-technique/a-beginners-guide-to-the-art-of-film-burns/
- Luma / ink mattes: https://www.nobledesktop.com/learn/after-effects/creating-dynamic-transitions-with-luma-and-alpha-mattes-in-adobe-after-effects · https://www.adobe.com/fi/learn/premiere-pro/web/ink-transition · Luma fade: https://beverlyboy.com/filmmaking/what-is-luma-fade/
- Linear-light dissolves: http://www.renderbreak.com/2013/10/premiere-pro-linear-compositing-and-single-source-cross-dissolves/ · https://odederell3d.blog/2018/04/25/premiere-composite-in-linear-color-breaks-dissolve-transitions/ · Additive dissolve: https://obsproject.com/forum/threads/additive-dissolve-transition-as-premiere-has.150057/
- Easings (cubic-bezier values): https://easings.net/
- W3C CSS View Transitions (plus-lighter cross-fade rationale): https://www.w3.org/TR/css-view-transitions-1/

**Shaders / libraries / Remotion**
- gl-transitions: https://github.com/gl-transitions/gl-transitions · https://gl-transitions.com · https://www.npmjs.com/package/gl-transitions · JSON: https://unpkg.com/gl-transitions@1/gl-transitions.json
- glfx.js: https://github.com/evanw/glfx.js · Jam3 blur: https://github.com/Jam3/glsl-fast-gaussian-blur · pmndrs/postprocessing: https://github.com/pmndrs/postprocessing · three.js RGBShiftShader: https://github.com/mrdoob/three.js/blob/dev/examples/jsm/shaders/RGBShiftShader.js · LYGIA: https://github.com/patriciogonzalezvivo/lygia · FFmpeg xfade: https://github.com/FFmpeg/FFmpeg/blob/master/libavfilter/vf_xfade.c
- Remotion: custom HTML-in-canvas presentations https://www.remotion.dev/docs/transitions/presentations/custom-html-in-canvas · makeHtmlInCanvasPresentation https://www.remotion.dev/docs/transitions/make-html-in-canvas-presentation · linearBlur https://www.remotion.dev/docs/transitions/presentations/linear-blur · HTML-in-canvas https://www.remotion.dev/docs/html-in-canvas · video frames https://www.remotion.dev/docs/video-manipulation · effects https://www.remotion.dev/docs/effects · CameraMotionBlur https://www.remotion.dev/docs/motion-blur/camera-motion-blur · presentation sources https://github.com/remotion-dev/remotion/tree/main/packages/transitions/src/presentations · license https://github.com/remotion-dev/remotion/blob/main/LICENSE.md · browser support https://html-in-canvas.dev/docs/browser-support/

**Sound**
- MixClap transition SFX guide: https://www.mixclap.com/en/blog/transition-sound-effects · FlexClip: https://www.flexclip.com/learn/transition-sound-effects.html · Derek Lieu (above)
