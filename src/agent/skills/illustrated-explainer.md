---
name: illustrated-explainer
description: Load for Kurzgesagt-style or any illustrated, animated explainer (flat-vector worlds and characters for science, history, politics, satire or how-it-works videos).
---

# Illustrated explainer (Kurzgesagt-level craft)

The bar is an illustrated animated film, not text cards with icons. Every beat is a composed illustration where something happens and something reacts.

## Build with the illustration kit (`reframer`)
- **World:**
  - `<Sky top bottom stars>`.
  - `<Hills color air layers horizon>`: ridges that fade into the air with distance.
  - `<Forest>` and `<Tree kind="pine|round|tall|bush">`: varied trees, never one shape stamped in a row.
  - `<Planet surface="bands|continents|craters" atmosphere rings>`.
  - `<Cloud>`, `<Glow>` and `<Dust>`.
- **Characters:**
  - `<Critter>`: an expressive creature. Props: `color`, `height`, `ears`, `look`, `mood`, `pose`/`arms`, `talk`, `squash`, `lift`, `lean`.
  - `<Person>`: same acting props, plus `skin`, `hair`, `hairColor`, `shirt`, `jacket`, `tie`, `mustache`, `beard`, `glasses`, `build`, and `hero` for big eyes.
  - `<Crowd rows perRow reactAt reaction air>`: an audience of distinct people who react in a ripple.
  - Children of Critter or Person draw in the character's own units (100 = its width or height). Use them for hats, signs and tools.
- **Acting helpers:**
  - `hop(frame, start, { height })`: anticipation, stretch, then a landing squash.
  - `take(frame, at)`: a surprise reaction.
  - `lookAt(x, y, tx, ty)`: points the eyes at a point.
- **Labels:** `<Callout x y text sub side length start>` ties a label to the thing it names with a dot and a leader line.
- **Captions:** `<Caption text={"line one\nline two"} variant="card|marker|outline|scrim" color box accent font start exitAt>`: whole lines in the film's font and palette, inside the safe area. With a voiceover, caption the voice with add_captions instead (synced to every word).
- **Mechanisms:** `<Flow d="M … C …" color size speed guide>` streams particles along an SVG path (water up a trunk, air into a leaf, money between accounts, data down a wire), entering unevenly from the start of the path.
- **Your own drawings:**
  - Wrap SVG shapes in `<Shade>` to give their silhouette a shadow crescent and a lit rim.
  - `tone(color, light, hue)` and `mix(a, b, t)` make related colors.
- **Light:** wrap each scene in `<SceneLight ambient light side>`: ambient is the sky's (or room's) dominant tone, light the key light's color, side where it comes from. Trees, hills and their shading then share one light instead of looking pasted on; paint your own shapes with `useScenePaint()` (`base`, `shadow`, `lit`) to join it.
- **Space:** use `<Camera>` with `<Layer depth>`. Background layers sit at depth 0.15–0.3, midground at 0.8–1, foreground at 1.2–1.5. Put a Callout in the same Layer as its object.

**Worked example: one beat.**

```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Callout, Camera, Critter, Dust, Forest, Hills, Layer, Planet, RevealText, Sky, hop, lookAt, take } from "reframer";

// One beat = a composed style frame + one primary action + a visible reaction, on a moving camera.
export default function PlanetBeat({ title = "What is a *planet*\nmade of?", accent = "#ffc93c" }) {
  const f = useCurrentFrame();
  const hero = { x: 760, y: 930 };
  const planet = { x: 1480, y: 330 };
  const eyes = f < 12 ? { x: 0.2, y: 0 } : lookAt(hero.x, hero.y - 250, planet.x, planet.y); // looks first…
  const jump = hop(f, 34, { height: 140 }); // …then acts: crouch, stretch, landing squash
  const friend = take(f, 54); // …and the other one reacts after
  return (
    <AbsoluteFill style={{ background: "#0d1240" }}>
      <Camera from={{ scale: 1.02 }} to={{ scale: 1.12, focus: { x: 0.52, y: 0.6 } }}>
        <Layer depth={0.15}>
          <Sky top="#0b1033" bottom="#4153a8" stars={120} />
        </Layer>
        <Layer depth={0.25}>
          <Planet x={planet.x} y={planet.y} size={240} color="#ff9566" atmosphere="#ffc9a1" surface="bands" />
          <Callout x={planet.x - 120} y={planet.y} text="A gas giant" sub="no solid ground at all" side="left" length={170} start={64} accent={accent} />
        </Layer>
        <Hills color="#173a5e" air="#5367bd" layers={4} horizon={0.52} />
        <Layer depth={0.9}>
          <Forest ground={0.82} count={15} color="#1d7a62" air="#3e56a8" haze={0.25} />
        </Layer>
        <Layer depth={1.05}>
          <div style={{ position: "absolute", left: -200, right: -200, top: 875, bottom: -200, background: "linear-gradient(#1a5c4c, #0f3a33)" }} />
          <Critter x={hero.x} y={hero.y} size={280} color="#ff7a59" look={eyes} mood={f > 40 ? "happy" : "neutral"} arms={f > 44 ? { right: 132 } : undefined} {...jump} />
          <Critter x={1190} y={935} size={210} color="#58c4f5" height={1.2} flip ears="antenna" seed={5}
            look={f < 54 ? { x: -0.7, y: -0.2 } : lookAt(1190, 700, planet.x, planet.y)} {...friend} />
        </Layer>
        <Layer depth={1.4}>
          <Dust count={26} />
        </Layer>
      </Camera>
      <AbsoluteFill style={{ justifyContent: "flex-start", padding: "80px 0 0 110px" }}>
        <RevealText text={title} size={92} font="Montserrat" weight={800} accent={accent} align="left" start={2} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
```

## Rules
Each of these cost points in blind tests.
1. **Illustration first.** Build each beat as a style frame before animating it:
   - foreground, midground and background layers;
   - one clear focal point, with negative space around the action;
   - one light direction.
   Check stills with review_frames before you add motion.
2. **Characters big enough to act.** Hero characters are 220–450 px wide (Critter) or 350–700 px tall (Person). Nobody who matters is under 120 px. Eyes and mouths must read at 720p.
3. **Act, don't just move.** Each beat has one primary action, and someone or something reacts to it.
   - Characters look at what's about to happen 6–10 frames before it happens (`lookAt`).
   - Then they act, with anticipation and follow-through (`hop`, `arms`).
   - Then the reaction: `take`, a mood change, or a crowd ripple.
   - Don't give everything the same spring.
4. **Show cause and effect.** When the story says X causes Y, show X pushing, pulling or transforming into Y on screen: if pores open, animate them opening; if a molecule escapes, show it squeezing through and the camera following it. Use `<Flow>` for anything that moves through something.
5. **Never repeat a composition.** Each beat gets a new framing, scale or place. A sequence travels: wide world → object → inside the object → back out. Shift the palette per chapter, but keep each concept's color.
6. **Transitions explain.** Zoom through an object into the next scale: Camera to scale 8–30 with `focus` on it, then cut on the matching color. Or match-cut shapes, or let a character or object wipe the frame. No generic crossfades.
7. **Type.**
   - Show the title by 5 s: Montserrat 800, 90–130 px, one accent word.
   - Labels are Callouts of at least 44 px, anchored to what they name.
   - Numbers are big and animated.
8. **Color.**
   - Deep navy grounds (#0b1033–#1d2a6b).
   - Two saturated accents per scene, and one color per recurring concept.
   - Warm light against cool shadows.
9. **Pace.** A new beat every 4–7 s. Alternate energetic beats with calmer ones; the camera keeps drifting. With a voiceover, time the beats to its measured length.
10. **Every character acts, every time.** A recurring mascot gets a new pose, place and job in each beat (pointing, carrying, hiding, measuring), not the same idle stance in the same corner.
11. **Micro worlds need depth too.** Inside a leaf, a cell or a machine: a blurred foreground layer, a midground with the action, a darker background, `<Shade>` on the shapes and `<Dust>` drifting. Never a flat color with a few circles.
12. **Captions are part of the design.**
    - With a voiceover: add_captions on the voice clip, styled from the film: its font, its light color for the text, `emphasize` the one word per sentence that carries it (drawn in the accent color), and a box or outline from its palette. Never the default preset look.
    - Without a voice: `<Caption>` with the variant that matches the film (card for explainers, outline for cartoon worlds, marker for punchlines), in the film's palette.
    - Either way: whole lines, never word-by-word ghosts; inside the safe area; in the brief's language; in one consistent place the compositions leave free.
13. **No twin frames.** Two beats that look alike (same layout, same characters, same place) read as a loop: change the scale, the angle or the place.
14. **Crowds are people.** Use `<Crowd>` (distinct skin, hair, clothes and heights) with a reaction ripple, never one figure copied in rows.
15. **Satire.** Build the joke into the picture:
    - scale contrasts (a giant chair, a tiny microphone);
    - deadpan reactions, and absurdity that escalates beat by beat;
    - caricature through hair, mustache, build, clothing and props, at hero size.

## Structure
- **0–5 s:** a hook image with the title or question.
- **Chapters:** 2–4 beats each. Every beat has a purpose, a composition, an action, a reaction and a transition.
- **End:** a synthesis image that pays off the recurring metaphor, then a title card.

## Finish
1. Run review_frames on a still of each beat, to check composition first, then on the animation.
2. Call critique_video with the user's request. Fix the biggest problems first, and repeat until the overall score is 8 or more, or you have done 4 rounds.
