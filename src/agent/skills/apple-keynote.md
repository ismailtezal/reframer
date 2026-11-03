---
name: apple-keynote
description: Load when the user wants an Apple-style or keynote-style product film, a minimal premium hero reveal, or anything described as calm, confident, clean or Apple-like.
---

# Apple-keynote style

The look: the product as the hero on a lit stage, huge confident type, one idea per shot, a camera that never stops gliding, and the product visibly *doing* the thing. Controlled and sparse, never a slideshow or a template.

## Build every shot with the kit
Each shot is a code component (create_component) built from the `reframer` kit. Don't hand-draw devices, lights, camera moves or text reveals; spend your effort on what the screen shows.
- `<LightStage variant="dark" accent light floor>`: the stage, a black void under a soft key light. Use `variant="light"` for Apple's white room.
- `<Camera from to>`: every shot moves, with an 8–12% push or drift across the shot. For a close-up on part of the UI, set `scale` 1.8–2.4 and `focus: { x, y }`, the point of the frame (0–1) to move in on.
- `<Device kind="macbook" | "iphone">`: the hero. Its children are the live screen.
  - Screen size: a MacBook's is about 0.95 × 0.58 of its width in px; an iPhone's is about 0.94 × 2.0 of its width.
  - MacBook `tilt.x` is the camera's height: 10–20 for a product shot from above (the keyboard deck shows), 2–5 for close-ups. `tilt.y` turns it.
- `<RevealText text="… *accent* …" mode="mask" | "words">`: keynote type.

**Worked example: the hero shot.** Use the same component for two clips back to back: a wide shot, then a hard cut to `closeUp: true` with `t0` set to the frame where the wide shot was cut, so the UI's story continues across the cut. Give it the user's footage or stills through an `asset` prop (`still` here).

```tsx
import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { Camera, Device, LightStage, ramp, rgba, useFonts } from "reframer";

// One idea per shot: the product on a lit stage, its screen doing the feature mid-shot.
// Use it twice back to back: a wide shot, then a hard cut to closeUp with t0 so the story continues.
export default function ProductHero({ prompt = "Cut it to the beat", accent = "#6c8cff", still = "", closeUp = false, t0 = 0 }) {
  const frame = useCurrentFrame() + t0; // the UI's story time, continuous across the cut
  useFonts([{ family: "Inter", weight: 500 }, { family: "Inter", weight: 600 }]);
  const typed = prompt.slice(0, Math.round(ramp(frame, 2, 22, "linear") * prompt.length));
  const recut = ramp(frame, 40, 14); // the state change
  const done = ramp(frame, 54, 12);
  const before = [0, 0.17, 0.36, 0.55, 0.74, 1]; // cut points, off the beat…
  const after = [0, 0.2, 0.4, 0.6, 0.8, 1]; // …snapped onto it
  const cuts = before.map((c, i) => interpolate(recut, [0, 1], [c, after[i]]));
  // Without footage, a soft gradient; each timeline thumbnail crops the picture differently (wide, mid, close).
  const picture = (zoom = 1, pos = "50% 50%") =>
    still ? <Img src={still} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, transform: "scale(" + zoom + ")", transformOrigin: pos }} />
          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #2b3656, #0b0e17)" }} />;
  const camera = closeUp
    ? { from: { scale: 2, focus: { x: 0.5, y: 0.6 } }, to: { scale: 2.15, focus: { x: 0.52, y: 0.605 } } }
    : { from: { scale: 1 }, to: { scale: 1.08, y: 0.01 } };
  return (
    <LightStage variant="dark" accent={accent} light={{ x: 0.5, y: 0.2 }} floor={0.84}>
      <Camera {...camera}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Device kind="macbook" finish="silver" width={closeUp ? 1220 : 1000} glow={accent} reflection={0.14} screenBackground="#0d0e12"
            tilt={closeUp ? { from: { x: 4, y: -5 }, to: { x: 2, y: -2 } } : { from: { x: 18, y: -16 }, to: { x: 10, y: -5 } }}>
            <AbsoluteFill style={{ padding: 20, gap: 12, fontFamily: "Inter, sans-serif", color: "#eceef3" }}>
              <div style={{ height: 76, borderRadius: 14, background: "#191b21", border: "2px solid " + rgba(accent, 0.7),
                display: "flex", alignItems: "center", padding: "0 24px", fontSize: 40, fontWeight: 500 }}>
                {typed}<span style={{ color: accent, opacity: frame % 20 < 10 ? 1 : 0 }}>▍</span>
              </div>
              <div style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}>{picture()}</div>
              <div style={{ position: "relative", height: 130, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ position: "relative", height: 74 }}>
                {cuts.slice(0, -1).map((c, i) => (
                  <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: c * 100 + "%", width: (cuts[i + 1] - c) * 100 + "%", padding: "0 3px" }}>
                    <div style={{ height: "100%", borderRadius: 8, overflow: "hidden", boxShadow: "0 0 0 2px " + rgba(accent, 0.25 + 0.6 * recut) }}>
                      {picture(1 + (i % 3) * 0.7, ["50% 50%", "30% 40%", "70% 60%", "45% 70%", "60% 35%"][i])}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ position: "relative", height: 44, display: "flex", alignItems: "center", gap: 3 }}>
                {Array.from({ length: 90 }, (_, i) => (
                  <div key={i} style={{ flex: 1, borderRadius: 2, background: "#3a4152",
                    height: 8 + 30 * Math.abs(Math.sin(i * 1.3) * Math.sin(i * 0.21 + 1)) * (i % 18 < 3 ? 1.2 : 0.6) }} />
                ))}
              </div>
              {after.slice(1, -1).map((b) => (
                <div key={b} style={{ position: "absolute", left: b * 100 + "%", top: -6, bottom: -4, width: 3, marginLeft: -1.5, borderRadius: 2,
                  background: accent, opacity: ramp(frame, 28, 8) * (0.55 + 0.45 * ramp(frame, 40, 14)) }} />
              ))}
              </div>
              <div style={{ position: "absolute", left: "50%", bottom: 172, padding: "12px 24px", borderRadius: 14,
                background: "#17241b", color: "#9df0ad", fontSize: 34, fontWeight: 600, whiteSpace: "nowrap",
                opacity: done, transform: "translate(-50%, " + (1 - done) * 14 + "px)" }}>
                ✓ 5 cuts moved to the beat
              </div>
            </AbsoluteFill>
          </Device>
        </AbsoluteFill>
      </Camera>
    </LightStage>
  );
}
```

Its propsSchema has `prompt` (text), `accent` (color), `still` (asset), `closeUp` (boolean) and `t0` (number). Place the wide clip with create_component's `place`, then add the close-up right after it with add_clips (component `code:<id>`, props `{ closeUp: true, t0: <the wide clip's length in frames> }`).

**Worked example: a type beat.**

```tsx
import React from "react";
import { AbsoluteFill } from "remotion";
import { Camera, LightStage, RevealText } from "reframer";

// A type beat: one short line, big, landing in the first half second, while the camera keeps moving.
export default function TypeBeat({ text = "Edit by *describing* it.", accent = "#6c8cff" }) {
  return (
    <LightStage variant="dark" accent={accent} light={{ x: 0.5, y: 0.42 }} floor={null}>
      <Camera from={{ scale: 1.04 }} to={{ scale: 1.12 }}>
        <AbsoluteFill style={{ justifyContent: "center" }}>
          <RevealText text={text} size={140} mode="mask" accent={accent} />
        </AbsoluteFill>
      </Camera>
    </LightStage>
  );
}
```

## Rules
Each of these cost points in blind tests.
1. **Content on screen from frame 0.** Never fade up from black, fade a whole shot in, or leave an empty stage waiting for a title. Cut straight to a finished-looking frame, then animate the details. The first line should have landed by about 0.7 s.
2. **Nothing freezes.** Every shot has a camera move and a screen that keeps living (cursor, playhead, typing). Hold a landed line for at least 1.5 s so it can be read, while the camera keeps moving.
3. **The hero fills the frame.** At 1080p:
   - a MacBook seen from above is 950–1150 px wide (the deck adds height below the lid);
   - an iPhone is 380–460 px wide.
   In a wide shot, the whole device stays in frame, keyboard deck included: a 1000 px MacBook seen from above (tilt.x 14) is about 860 px tall. Beside a headline, shrink it rather than push it off the edge.
4. **UI reads on a phone.** People watch on phones, where a 1080p frame is about 400 px wide.
   - The line that matters (the prompt, the result) is at least 40 px at final size; everything else is at least 26 px.
   - Design the screen like a marketing UI: a few large elements (a prompt, a preview, a timeline), not a dense real app.
   - Detail goes in close-ups (Camera `scale` 1.8–2.4 with `focus` on it).
5. **Show the feature happening.** Every product shot has one visible change on screen, landing mid-shot, for example:
   - a prompt is typed and the timeline re-cuts;
   - a frame reflows;
   - clips snap to beats.
   A static screenshot, or a device with an empty screen, fails.
6. **Real content.** Design the UI like the real product: real labels and plausible data, with the user's footage or stills in previews and thumbnails.
   - Without footage, find real photos with search_stock (it works without a key), and use a different picture per clip and thumbnail. Never draw placeholder footage in code, and never repeat one picture everywhere.
   - No grey placeholder bars, lorem ipsum or fake logos.
   - Don't make up the user's product, features or claims: ask, or use what they gave you.
7. **Show a change as one continuous morph.** The same object changes size, shape or state on screen over 12–20 frames: a 16:9 frame narrows into 9:16, clips slide onto the beat. Never cut between a before and an after.
8. **At most one pure type card**, at the opening or the end. Put other headlines inside the product shots: big type in the empty third beside or above the device, or over a blurred full frame of the product. Three text-on-black cards read as a slideshow.
9. **Hard cuts on the music's beats.** No crossfades with two shots half visible. No dip-to-black between shots. No mask fragments left on screen.
10. **Vary the framing.** Follow a pattern like wide device → close-up on the UI → type beat → another device or angle. Never frame two consecutive shots the same way.
11. **Light.** Use a neutral-cool key light on black, or a white room. The accent appears only in one hero word per line and in the screen's glow. No muddy orange or brown glows, no generic gradient blobs.
12. **Pace.** Shots last 2–3.5 s (average about 2.5 s). A 20 s film has about 8 shots; a 60 s film about 22.

## Type and color
- Inter Tight 600–700, or the brand's font.
- Headlines: 110–150 px, at most 6 words, tracking −0.03 em, with one *accent* word.
- Supporting lines: 44–56 px at 60% opacity.
- One accent: a single color, or one 2-stop gradient.
- 1920×1080 at 30 fps unless asked otherwise.

## Structure (20 s; scale up for longer films)
| Time | Shot | Build |
|---|---|---|
| 0–2 s | Type: the promise | Type beat with a mask reveal from frame 0. |
| 2–5 s | Hero, wide | Hero shot: the device tilts in, the prompt types, and the change lands about 1.3 s in. |
| 5–7 s | Close-up | Hero shot with `closeUp`, `t0` = the wide shot's length. The result lands here: re-cut clips, a confirmation. |
| 7–9 s | Feature 2, headline | The headline sits beside the device or over a blurred frame of the product, not on black. |
| 9–12 s | Feature 2, shown | Its own state change, e.g. a frame reflows from 16:9 to 9:16, then a hard cut to the iPhone showing the vertical version. |
| 12–14.5 s | Feature 3, close-up | What it does, shown on screen. |
| 14.5–17 s | Payoff | The finished result playing full frame (the user's footage), or one big number. |
| 17–20 s | End card | Wordmark and URL with RevealText, held for at least 2 s. The camera keeps pushing and a light sweeps across the wordmark, so the last frames aren't a still. |

## Sound
- One music track at 90–120 BPM with a clear pulse; load the sound-design skill. Its character: minimal, bright and airy (piano, soft synth pads, light percussion, a clean build). Skip anything tagged dark, aggressive, driving rock, funky, jazzy or humorous: those read as a generic tech promo, not a keynote. Best: compose it with generate_music, one section per row of the structure table with that row's length (sparse intro, the beat lands on the hero, a lift for the features, one held chord under the end card). If there's no key, find a track with search_audio. Cut on beats.
- Use 3–5 SFX, kept low (volume 0.15–0.25 against music at 0.8–0.9; critique_video names any that stick out):
  - a soft whoosh as the hero enters;
  - a subtle click on the UI action;
  - at most a light shimmer on the end card.
  No sub drops, bass hits or booms: in a keynote film they sound cheap.
- End on the track's own final chord, at −14 LUFS. Don't splice the track to make it fit: pick a track whose ending you can reach by starting later in it, or fade out from a phrase end.

## Banned
- Particles, lens flares, camera shake and glitch.
- Bounce or elastic easing.
- Emoji, neon grids and abstract gradient blobs.
- Whip transitions.
- More than 3 specs on screen; text under 26 px; placeholder UI.

## Finish
Run review_frames and fix what it shows. Then call critique_video with the user's request verbatim. Fix the biggest problems first, and repeat until the overall score is 8 or more, or you have done 4 rounds.
