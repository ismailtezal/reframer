---
name: toon-3d-story
description: Load for animated story shorts with 2D cartoon characters in a toon-shaded 3D world (three.js), 9:16 or 16:9. Fits everyday or workplace comedy, tech stories, character-driven explainers and mascot ads.
---

# Toon 3D story: a 2D cast in a 3D world

The look:
- **The set** is a real 3D place (a room, a street, a city) in flat toon shading. It has dark ink lines, warm practical lights, bloom on lamps and screens, shallow lens blur, and a colour grade per time of day.
- **The cast** are 2D drawings on camera-facing cards. They act with face, pose, bob and tilt.
- **Objects with faces** can be characters too: screens, appliances, gadgets.

Everything is timed to the narrator's words. The set, the cast, the light and the pop-ups all serve one story beat at a time. The setting is yours to choose: office, kitchen, school, street, space station. The grammar below is what makes it look made by hand.

## Workflow (one short in about 30 minutes)
1. **Script, 60–75 s:** setup, escalation, a turn, then a button line. Short sentences, one image each.
2. **Voice:** one `generate_voiceover` call.
   - For Turkish narration use the designed narrator `voice: "2LPwhHdgJyebm8VbYZTJ"`. It is a warm, playful storyteller (the premade voices sound robotic in Turkish).
   - Its sentence and word times are the beat map. A beat's frame is `Math.round(sec * fps)`. Visual reactions land 0–3 frames *before* their word.
3. **Plan in writing, not in your head.** Right after the voiceover, write two things with `set_plan`:
   - the beat table: each key word and its frame;
   - the shot list: one line per shot with frames, place, camera, light, action and pop-up.

   Shots last 2–5 s. A change of place is a dissolve of 6–10 frames; a big jump in the same place is a cut. Don't design the whole film in one long think; the plan is the design.
4. **One `create_component`** with `<ToonFilm build={…} shots={…} dissolves={…} />` across the whole video. Set `width` and `height` to the canvas. Import from `"reframer/toon3d"` (and `three`). Write it once, completely, from the plan.
   - Always render through `ToonFilm`. It loads the fonts before building the world, frees the GPU between frame reviews, and runs the dissolves, motion blur and look.
   - A hand-made `ThreeCanvas` or engine bakes fallback fonts into every painted sign. If you truly need one, build its world only after `useToonFonts()` returns true.
   - Font strings in painted textures name the family and a generic: `"400 96px 'Lilita One', sans-serif"`.
5. **Fix with edits.** Every later change goes through `update_component` with `edits` (find and replace a few lines). Never resend the whole film: a 40,000-character rewrite costs minutes; an edit costs seconds.
6. **`add_captions` on the voice clip** with the caption style below. Music with `generate_music` (or `search_audio` + `fit_music`), ducked under the voice. Sound effects only on visible hits: pops, whooshes, typing.
7. **Check once.** Run one `review_frames` call on 4–6 hit frames. Fix framing with edits first: pop-ups inside the frame, faces in the middle third. Then run `critique_video` once and fix only what it marks wrong, with edits. For this style, at most **two** critique rounds in total, which overrides the general four-round loop. Each round re-renders the 3D film and costs minutes, and the critic's score barely moves after the first fixes. After round two, stop and report the score and what is still weak.

## The set
- Build it once in `build()`. It returns `{ root, rig: new Rig(), cards: [...], fx: new Fx(), reset?, onLight? }`.
- Units are metres. The floor is at y = 0, people are about 1.6–1.8 m tall, a counter or desk top about 0.75–0.95 m.
- Shapes are `RoundedBoxGeometry` and simple primitives with `toon({ color })` or `toon({ map })`. Set `castShadow` and `receiveShadow` on solid things.
- Painted textures come from `canvasTex(w, h, paint)` and the ready ones: `woodFloor()`, `rug(base, stripe)`, `wallPaint(base, seed)`, `skyline("morning" | "night" | "dawn")`, `neonTex(text, color)`, `posterTex(seed)`, `clockFace()`, `whiteboardTex()`, `keyboardTex()`, `bookSpine(seed)`.
- Lamps, screens and neon are `MeshBasicMaterial` with the colour multiplied above 1 (`new THREE.Color(c).multiplyScalar(2–3)`) and `toneMapped: false`, so the bloom picks them up.
- Windows show `skyline(mode)` on an unlit plane on layer `NOINK`. Swap the sky in `onLight: (p) => { mat.map = skies[p.sky]; }`.
- Fill the frame edges with life: plants, posters, shelves, a second room through a door. Never one object on an empty floor.
- `buildOffice()` and `buildCity()` are ready-made sets. Reuse them when the story happens there; learn the set dressing from them otherwise.

## The cast (2D on cards)
- A character is a card: `new Card(designW, designH, pxPerUnit)`. Design units are millimetres; `Card(1000, 1800, 1.0)` is a standing person and `Card(1000, 1400, 1.75)` a seated close one.
- Each frame call `card.draw(JSON.stringify(state), (ctx) => …)` (it redraws only when the state changes), then `card.place(x, 0, z, camera)`. Add a `contactBlob(0.36)` under people who stand.
- **`drawHero(ctx, state, palette)`** draws a young person: big head, glasses, hoodie, jeans.
  - Recolour it per character: `{ skin, hair, hoodie, hoodieDark, cuff, jeans, shoe }`. One rig makes many different people.
  - Poses: type, mug, scratch, panic, slump, sleep, back, stand, lookUp.
  - State fields: `face, blink, tilt, bob, typing, typeAmp, messy, slump`.
- **`drawElder(ctx, state, palette)`** draws an adult figure: a boss, a parent, a teacher. Palette: `{ skin, beard, blazer, blazerDark, tee, chinos, shoe, lanyard }`. Poses: idle, point, open, thumbs. State fields: `face, blink, tilt, bob, lean`.
- **Faces:** `face(name, overrides)` from neutral, tired, exhausted, shock, determined, confused, awe, panic, realize, sad, grin, beam, smile, focus, asleep. Overrides take values like `sweat: 0.9` or `open: talking`.
  - Blink with `blinkAt(f, seed, [forcedFrames])`.
  - Talk: open the mouth only on that character's own lines.
- **New kinds of characters:** draw them with the pen helpers (`pen.inked`, `pen.smoothPath`, `pen.taper`, `pen.ellipse`, `pen.INK`) and `drawFace(ctx, geometry, face, blink)`. Keep the thick ink outline, flat colour plus one shade, and big readable eyes.
- **A screen with a face:** `new AITerminal(body, accent)` gives you `.face({ eyes, mouth, smile, blink, code, scroll, tint })` and `.pose({ bob, tilt, bow, squash, glow })`.
  - Eyes: neutral, happy, wide, sorry, eager, closed, focus. Tint: cyan, red or green.
  - For other screens, `Screen(w, h).draw(key, (g, w, h) => …)` with `drawCode`, `drawError` or `drawAIFace`.

## Camera grammar
- Every shot's camera is a pure function of the frame: `cam: (f) => …` with `C(pos, look, fov, roll)`.
- **Glides:** `keys(f, [{ f, dur, cam }])`, symmetric smootherstep over 18–40 frames.
- **Holds creep in:** `push(cam, f, f0, 0.0015–0.0035)`; about 0.006 on a punch word.
- **Rolls:** 3–5° (0.05–0.09 rad) on a reaction or a turn.
- **Impacts:** `kick(cam, f, [hitFrames], 1–1.2)`, plus `post: (f) => ({ flash })` for 4 frames (0.8, 0.5, 0.3, 0.1).
- **Lens:** `lens: () => ({ at: [x, y, z], cInf: 6–12 })` on almost every shot, focused on the face or object that speaks. The background melts and the subject pops.
- **Framing:**
  - 9:16: the subject sits in the middle third; leave headroom for pop-ups; nothing that matters in the top 12% or the bottom 22% (captions and app buttons).
  - 16:9: thirds, with the speaker toward the frame's open side.
- **Shot sizes:** wide to set the place, medium for actions, close-ups on faces for reactions, a big punch-in on the turn. Never two near-identical framings in a row.
- Fast moves get motion blur for free.

## Light tells the time
- `light("morning" | "day" | "night" | "dawn" | "alarm" | "twist" | "city", { points: [six practicals] })`.
  - Give the six point lights of *your* set: lamp, screen glow, window, neon. Use `{ pos: [0, -50, 0], color: "#000000", intensity: 0, distance: 1 }` for unused slots.
  - Optional overrides: `bloom`, `exposure`, `keyColor`, `grade`, `cardTint`.
- **A time-of-day arc is the story clock:** a bright morning, warm day, a neon night when things go wrong, a soft dawn at the end. Show time passing with a clock or a window, or blend with `blendPreset(a, b, t)`.
- A turn in the story is a light change: red `alarm`, purple `twist`.
- Fade out at the end with `post: (f) => ({ fade })`. Hold the last image about 1 s after the last word.

## Pop-ups and effects
- Words, error windows and check marks live in the world (layer `NOINK`, `toneMapped: false`). They pop on their word with `backOut(ramp(f, hit - 2, hit + 8))` and face the camera (`lookAt(camera.position)`) with a small tilt.
- Paint a word with `canvasTex`: Lilita One, a thick #120c1c stroke, yellow #ffe14d or white fill.
- **Sparkles and glyphs:**
  - Glowing: `world.fx.glow.add(position, size, G["✦"], color.multiplyScalar(2.4), alpha)`.
  - Inked: `world.fx.ink.add(...)`.
  - Glyphs: { } => </> const ★ ✦ ✓ ! ? ♪ Z and more (`GLYPHS`).
  - Trajectories are analytic, from the frame and `hash(i)`, never `Math.random`.
- **One hit, one gesture:** pop, sparkles, kick and flash together, then let it breathe.

## Captions (add_captions on the voice clip)
One bold word at a time, hard-swapped with a small pop:

```json
{ "preset": "bold-pop", "style": { "fontFamily": "Lilita One", "fontWeight": 400, "fontSize": 116, "color": "#ffffff", "emphasisColor": "#ffe14d", "textTransform": "uppercase", "animation": "pop", "maxWordsPerPage": 1, "stroke": { "color": "#120c1c", "width": 16 }, "shadow": { "color": "rgba(18,12,28,0.55)", "blur": 0, "x": 0, "y": 8 }, "yPct": 0.66 }, "emphasize": ["the punch words"] }
```

Set `fontSize` for a 1080-wide frame; long words drop to 92–104.

## Rules
1. **Every shot is a pure function of the frame.** No state, no timers, no `Math.random`; use `hash()` and `pen.rng(seed)`.
2. **Reset what you pose.** Hide optional props in `reset()`. Cards are hidden before every pose; a shot shows only what it places.
3. **The voice is the clock.** Every action, light change and pop-up hangs on a word's frame.
4. **Act, don't just move.** A character looks first, reacts with a face change (blink, shock, sweat), then the world answers: a pop-up, a light shift, a kick.
5. **Variety:**
   - a new framing every shot;
   - the cast changes pose and expression in every beat;
   - the set changes at least once (a new room, the street, the city at night, an abstract space for the turn).
6. **Keep it renderable:** one `ToonFilm` per video, built once; under ~2,000 meshes; canvases at most 2048 px; draw cards only when their state changes.

## API (import from "reframer/toon3d")
- **Film:** `ToonFilm`, `TOON_FONTS`.
- **Shot fields:** `{ id, from, to, cam, light, lens?, post?, pose?, near?, far?, fog?, shadowAt? }`.
- **Camera:** `C`, `keys`, `push`, `dolly`, `mixCam`, `kick`, `ss`, `ramp`, `lerp`, `lv`, `backOut`, `hash`, `blinkAt`.
- **Light:** `Rig`, `PRESETS`, `light`, `blendPreset`.
- **Materials:** `toon`, `glow`, `NOINK`, `RoundedBoxGeometry`, plus the textures listed above.
- **Cast:** `Card`, `contactBlob`, `drawHero`, `HERO_DEFAULT`, `HERO_PALETTE`, `drawElder`, `ELDER_PALETTE`, `drawCoworker`, `FACES`, `face`, `drawFace`, `pen`.
- **Screens:** `AITerminal`, `Screen`, `drawCode`, `drawError`, `drawFixed`, `drawAIFace`.
- **Effects:** `Fx`, `G`, `GLYPHS`.
- **Sets:** `buildOffice`, `buildCity`.

## Worked example (lab-tested): a night kitchen, 9:16
A hungry student and a smart kitchen screen.
- **Shot 1:** a wide shot with a slow push; the student's face goes from tired to awe.
- **The dissolve:** shot 1 dissolves into shot 2, a close-up on the screen.
- **Shot 2:** the screen beams; "AÇ!" pops with sparkles, a kick and a flash.

The example shows a set built from primitives, a recoloured hero, set-specific practical lights, a window whose sky follows the preset, and a pop-up.

```tsx
import React from "react";
import * as THREE from "three";
import {
  AITerminal,
  backOut,
  blinkAt,
  C,
  Card,
  canvasTex,
  contactBlob,
  drawHero,
  face,
  Fx,
  G,
  keys,
  kick,
  light,
  NOINK,
  push,
  ramp,
  Rig,
  RoundedBoxGeometry,
  skyline,
  toon,
  ToonFilm,
  wallPaint,
  woodFloor,
} from "reframer/toon3d";

// A night kitchen, 9:16: a hungry student and a smart kitchen screen with a face.
// Shot 1 (wide, slow push) dissolves into shot 2 (close on the screen, which beams; impact kick + flash + a word pop).

const OFF = { pos: [0, -50, 0], color: "#000000", intensity: 0, distance: 1 } as const;
const PENDANT = { pos: [0.3, 2.1, -1.3], color: "#ffb26b", intensity: 2.4, distance: 5 };
const SCREEN = { pos: [1.0, 1.35, -1.5], color: "#7df3ff", intensity: 1.6, distance: 3 };
const MOON = { pos: [-1.5, 2.3, -2.0], color: "#9fb4ff", intensity: 1.0, distance: 5 };
// Light presets carry the practicals of this set (all six slots, so nothing leaks from another preset).
const NIGHT = light("night", { points: [PENDANT, SCREEN, MOON, OFF, OFF, OFF].map((p) => ({ ...p, pos: [...p.pos] as [number, number, number] })) });
const BEAM = light("night", { points: [{ ...PENDANT, intensity: 0.7 }, { ...SCREEN, intensity: 3 }, MOON, OFF, OFF, OFF].map((p) => ({ ...p, pos: [...p.pos] as [number, number, number] })), bloom: 0.95 });
const HUNGRY = { hoodie: "#4fa3ff", hoodieDark: "#2f6fd1", cuff: "#3b82e0", hair: "#5a3420", skin: "#e8b48f", jeans: "#2f3e66" };

const build = () => {
  const root = new THREE.Group();
  const rig = new Rig();
  const fx = new Fx();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), toon({ map: woodFloor() }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 0.1), toon({ map: wallPaint("#f0cfa0", 3) }));
  wall.position.set(0, 2, -2.65);
  wall.receiveShadow = true;
  // a window onto the skyline: its sky follows the light preset (morning / night / dawn)
  const skies = { morning: skyline("morning"), night: skyline("night"), dawn: skyline("dawn") };
  const sky = new THREE.MeshBasicMaterial({ map: skies.night, toneMapped: false });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.3), sky);
  win.position.set(-1.5, 2.15, -2.59);
  win.layers.set(NOINK);
  const frameMat = toon({ color: "#fff7ea" });
  for (const [w, h, x, y] of [[2.14, 0.08, -1.5, 2.8], [2.14, 0.08, -1.5, 1.5], [0.08, 1.38, -2.57, 2.15], [0.08, 1.38, -0.43, 2.15], [0.05, 1.3, -1.5, 2.15]]) {
    const bar = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.08, 2, 0.02), frameMat);
    bar.position.set(x, y, -2.56);
    root.add(bar);
  }
  // counter + top + a pendant lamp (HDR glow so the bloom picks it up)
  const counter = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.9, 0.72, 3, 0.04), toon({ color: "#4fb3a0" }));
  counter.position.set(0.7, 0.45, -2.15);
  const top = new THREE.Mesh(new RoundedBoxGeometry(3.5, 0.06, 0.8, 2, 0.02), toon({ color: "#fff1dc" }));
  top.position.set(0.7, 0.93, -2.15);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.22, 24, 1, true), toon({ color: "#2e3a5c", side: THREE.DoubleSide }));
  shade.position.set(0.3, 2.35, -1.3);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd9a0").multiplyScalar(3), toneMapped: false }));
  bulb.position.set(0.3, 2.24, -1.3);
  for (const m of [counter, top, shade]) m.castShadow = m.receiveShadow = true;
  // the screen character sits on the counter
  const bot = new AITerminal("#e3ecff", "#ff7a59");
  bot.group.position.set(1.0, 0.96, -2.1);
  // the hero: a standing 2D card in the 3D room, with a soft contact shadow
  const hero = new Card(1000, 1800, 1.0);
  const blob = contactBlob(0.36);
  // a word that pops off the screen
  const word = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.24),
    new THREE.MeshBasicMaterial({
      transparent: true,
      toneMapped: false,
      alphaTest: 0.1,
      map: canvasTex(720, 288, (g, w, h) => {
        g.font = "400 200px 'Lilita One'";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.lineJoin = "round";
        g.lineWidth = 34;
        g.strokeStyle = "#120c1c";
        g.strokeText("AÇ!", w / 2, h / 2 + 10);
        g.fillStyle = "#ffe14d";
        g.fillText("AÇ!", w / 2, h / 2 + 10);
      }),
    }),
  );
  word.layers.set(NOINK);
  root.add(rig.group, floor, wall, win, counter, top, shade, bulb, bot.group, hero.mesh, blob, word, fx.group);
  return {
    root,
    rig,
    fx,
    cards: [hero],
    hero,
    blob,
    bot,
    word,
    reset: () => {
      word.visible = false;
      blob.visible = false;
    },
    onLight: (p: { sky: "morning" | "night" | "dawn" }) => {
      sky.map = skies[p.sky];
    },
  };
};
type World = ReturnType<typeof build>;

const setHero = (w: World, cam: THREE.Camera, x: number, z: number, st: Parameters<typeof drawHero>[1]) => {
  w.hero.mesh.visible = true;
  w.hero.draw(JSON.stringify(st), (ctx) => drawHero(ctx, st, HUNGRY));
  w.hero.place(x, 0, z, cam);
  w.blob.visible = true;
  w.blob.position.set(x + 0.05, 0.006, z + 0.05);
};

const HIT = 96;
const shots = [
  {
    id: "wide",
    from: 0,
    to: 64,
    cam: (f: number) => push(C([0.4, 1.5, 3.0], [0.45, 1.2, -1.3], 44, 0), f, 0, 0.0028),
    light: () => NIGHT,
    lens: () => ({ at: [0.0, 1.45, -0.9] as [number, number, number], cInf: 9 }),
    pose: (w: World, f: number, cam: THREE.PerspectiveCamera) => {
      setHero(w, cam, 0.0, -0.9, { pose: "stand", face: face(f < 34 ? "tired" : "awe"), blink: blinkAt(f, 3), tilt: f < 34 ? -0.04 : 0.03, bob: 0 });
      w.bot.face({ eyes: f < 34 ? "closed" : "wide", mouth: 0, smile: 0.4, blink: 0, code: 0, scroll: 0, tint: "cyan" });
      w.bot.pose({ bob: 0.025 * backOut(ramp(f, 34, 44)), squash: 1, glow: 1.8 });
    },
  },
  {
    id: "beam",
    from: 64,
    to: 130,
    cam: (f: number) =>
      kick(
        keys(f, [
          { f: 64, dur: 1, cam: C([1.0, 1.55, 0.0], [1.0, 1.52, -2.05], 38, 0) },
          { f: 78, dur: 30, cam: C([0.95, 1.52, -0.3], [1.0, 1.52, -2.05], 36, -0.04) },
        ]),
        f,
        [HIT],
        1.2,
      ),
    light: () => BEAM,
    lens: () => ({ at: [1.0, 1.3, -1.9] as [number, number, number], cInf: 11 }),
    post: (f: number) => ({ flash: f >= HIT && f < HIT + 4 ? [0.8, 0.5, 0.3, 0.1][f - HIT] : 0 }),
    pose: (w: World, f: number, cam: THREE.PerspectiveCamera) => {
      const happy = f >= HIT - 2;
      w.bot.face({ eyes: happy ? "happy" : "eager", mouth: happy ? 0.6 : 0.1, smile: 1, blink: 0, code: 0, scroll: 0, tint: "cyan" });
      w.bot.pose({ bob: happy ? 0.03 * backOut(ramp(f, HIT, HIT + 8)) : 0, squash: 1 + 0.07 * Math.sin(ramp(f, HIT, HIT + 10) * Math.PI), glow: 2.2 });
      if (happy) {
        const at = new THREE.Vector3(1.0, 1.8, -1.95);
        w.word.visible = true;
        w.word.position.copy(at);
        w.word.scale.setScalar(Math.max(0.001, backOut(ramp(f, HIT - 2, HIT + 8))));
        w.word.lookAt(cam.position);
        w.word.rotateZ(-0.1);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + f * 0.03;
          const r = 0.36 + 0.08 * backOut(ramp(f, HIT, HIT + 10));
          w.fx.glow.add(at.clone().add(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.6, 0)), 0.09, G["✦"], new THREE.Color("#ffe066").multiplyScalar(2.4), ramp(f, HIT, HIT + 6));
        }
      }
    },
  },
];

export default function NightKitchen() {
  return <ToonFilm build={build} shots={shots} dissolves={[[64, 8]]} />;
}
```
