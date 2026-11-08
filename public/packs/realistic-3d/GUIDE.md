## The look

Viral "what if…" 3D shorts: a believable person in a believable place, shot like a documentary on a phone. The realism comes from real assets and an imperfect camera, not from detail you add by hand.

- **Camera:** one straight move per shot (a slow dolly in or out, a rise), eased in and out; never an orbit or drift. About one cut in seven is a hard cut; the rest are motion transitions (whip, zoom in, zoom out) in the edit. Aerial establishing shots, close-ups of hands and screens, over-the-shoulder shots.
- **Light:** a real HDRI sky with the sun placed per shot (`set_sun_azimuth`) for a warm key on the face; Khronos PBR Neutral view transform.
- **Post:** soft bloom, a touch of lens dispersion and a vignette (`camera_look`, on at final quality); motion blur on final renders; grain in the edit (Reframer's `film-grain` component, amount ~0.26) because grain must move.
- **Assets:** if a real asset exists, download it (Poly Haven, CC0). Build only what doesn't exist (the island palm is procedural: Poly Haven has no palm).
- **Script:** a hypothetical opener ("If you…"), about 2.8 words a second, one joke beat with a silent reaction. Loud mix (around -10 LUFS), ambience under everything, effects stacked on every action.

## Before you start

- **Ask first.** Rendering uses the GPU for minutes to hours (the user may be gaming: use `--priority low`, one worker). Downloads (Blender add-on, MakeHuman, Poly Haven) need the user's yes: `fetch.mjs` only lists them until it gets `--yes`.
- **Permissions:** the agent runs shell commands. In Reframer, Codex needs "Full access"; Claude Code needs its Bash tool allowed.
- **Needs:** Blender 4.2+ (tested on 5.1), an NVIDIA RTX or Apple Silicon GPU (Cycles on CPU is far too slow), Node.
- The kit is in this pack's folder: run `node public/packs/realistic-3d/kit/<script>.mjs` from the Reframer app folder. Its Blender profile and assets live in `REFRAMER_REAL3D_HOME` (default `~/.reframer/real3d`), never in the user's own Blender settings.

```
node kit/setup.mjs                  # what is installed and what is missing (JSON)
node kit/fetch.mjs makehuman        # lists MPFB + MakeHuman downloads (~327 MB); add --yes once the user agreed
node kit/setup.mjs --install        # installs MPFB into the kit's profile, loads the MakeHuman packs (a few minutes)
node kit/setup.mjs --list           # skins, hair, clothes, eyebrows a character can use
node kit/fetch.mjs polyhaven kloofendal_43d_clear_puresky:4k:hdri damp_beach_sand:2k:tex   # assets by id:res:kind
```

## Making a film

1. **Voice first.** Write the narration, generate it (`generate_voiceover`; the pack's voice is `eleven_v3`), and let the word timings set each shot's length. Plan 6–10 shots, 2–8 s each.
2. **The character:** a JSON spec for `kit/blender/rf3d_human.py` (see its header and `examples/island/hero.json`): phenotype (gender, age, weight…), MakeHuman targets for the face, hair, clothes, skin, eye texture, stubble.
   - For a printed shirt, run `kit/garment-print.mjs --text "…"` first and pass the PNG as `garment_textures`.
   - Build with `blender -b --python kit/blender/rf3d_human.py -- spec.json hero.blend`; `examples/island/build.mjs` shows the whole chain.
   - The rig gets the 52 ARKit face shape keys.
3. **The set:** a Python script that opens `hero.blend`, builds the world and saves `scene.blend` (`examples/island/island.py`: HDRI sky, terrain from a height function, ocean, palm, shells).
4. **The shots:** one script renders any shot (`examples/starter/shots.py` is the smallest; `examples/island/shots.py` is a full 8-shot short).
   - **Contract:** it receives `-- <shot> <outdir> <start> <end> <step> <scale%> <samples> [extra…]` (`rf3d_common.shot_args()`), builds that shot's props, poses, faces, sun and camera, and writes `NNNN.png` frames with `rf3d_common.render_frames`.
   - Put `shots.json` (`{"shot": frames}`) beside it.
   - **Posing** (`rf3d_rig.Rig("Hero")`): `place`, `key_pose(frame, "idle" | "phone_up" | "laptop" | "stick" | "stop" | "wave" | "hands_on_hips", head=(dir), yaw=deg)`, `key_face(frame, "worried" | "shock" | "proud" | "happy" | …)`, `blinks`, `attach(prop, "wrist.R")`. Aim bones along directions; add your own poses to `POSES`. Keep expressions subtle (under 0.8).
   - **Camera:** `rf3d_common.camera()` and `key_camera(cam, [(frame, pos, target, lens), …])`, two keys on one axis.
5. **Look, then render.**
   - **Preview** (`render.mjs --profile preview`): first, middle and last frame of every shot plus `preview-sheet.jpg`. Look at it, fix and repeat.
   - **Draft** (720p, 24 samples) checks timing and acting.
   - **Final** (1080 x 1920, 64 samples, OIDN, motion blur, camera look) is for delivery. `render.mjs` resumes where it stopped, and `--workers 2` gives about 1.4x throughput on one 8 GB GPU.
   ```
   node kit/render.mjs --blend scene.blend --script shots.py --out frames --profile preview -- <extra args>
   node kit/render.mjs --blend scene.blend --script shots.py --out frames --profile final --workers 2 --priority low -- <extra args>
   node kit/encode.mjs frames/s1 shots/s1.mp4        # H.264 CRF 12 per shot
   ```
6. **Edit in Reframer.**
   - Import the shot MP4s and lay them on the voice with whip or zoom transitions (0.28–0.4 s).
   - Add the captions (`add_captions`, the pack's caption style), the `film-grain` component on top, ambience under every shot, one effect per action and a music bed around -8 dB under the voice.
   - Then run `check`.

## Measured times (RTX 5060 8 GB, Blender 5.1, 9:16)

- Island example, from nothing to `island.blend`: about 15 s. Its preview (24 stills at half size, 16 samples): 63 s, 1.4 s a still.
- 720p at 24 samples: 1.5–2.5 s a frame, but grainy (the founder: "a bit bad"). Final at 64 samples with OIDN and motion blur: 10–15 s a frame. A 37 s short (1,127 frames) took about 2 hours with two workers.
- The first render on a machine compiles Cycles kernels (a minute or two). Later renders reuse them.

## Other looks of the same scene (`kit/blender/rf3d_looks.py`)

- **Claymation:**
  - `clay_material`, and `clay_from_texture` (with `split=` for casual suits, whose jeans otherwise turn cyan); `clay_lumps` for hand-made bumps that change every 2 frames; `stop_motion_camera`.
  - Render every 2nd frame (`--step 2`) and `encode.mjs --hold 2`, giving 15 drawings a second.
  - Examples: `examples/starter` (shot `clay`), `examples/clay-chef`.
- **Miniature (tilt-shift):** `miniature(scene, cam, focus)` gives a high, far camera, an 85 mm lens and f/0.09. Speed water and crowds up. Example: `examples/mini-town`.

## Gotchas

- **Water:**
  - It must be transparent to shadow rays (Light Path "Is Shadow Ray" into a Transparent BSDF), or Cycles leaves the seabed black.
  - Shore foam comes from a baked height-map depth. A far ring plane hides the horizon edge.
- **Displaced detail:** sand writing and footprints are real displaced geometry. Lower the terrain under the patch (by about 3 cm), or the grooves hide below the ground.
- **Eyes:** MPFB's procedural eyes render as see-through holes in EEVEE. `rf3d_human.py` uses the MAKESKIN eye material with a real iris texture.
- **Images:** never `pack()` generated float images (they save as 8-bit and clamp). With sharp, read the real channel count, because `.greyscale().raw()` can still return 3 channels.
- **Blender 5.x compositor:** `scene.compositing_node_group` (a CompositorNodeTree with a NodeGroupOutput). Glare, Lensdist and EllipseMask settings are input sockets, not properties (`rf3d_common.camera_look`).
- **Windows:** MakeHuman's poses01 pack fails on long paths. Pose with `rf3d_rig` directions instead.

## Examples

- `examples/island/`: the stranded-developer short (8 shots, also `c_clay` and `c_mini` teasers). `node build.mjs` builds it, then render it with `render.mjs`. The on-screen words are the example's (Turkish UI); write your own in `textures.mjs`.
- `examples/starter/`: three shots (wave, proud, clay) over `hero.blend`, with no set. Copy it to start a new story.
- `examples/clay-chef/`, `examples/mini-town/`: self-contained looks (`blender -b --factory-startup --python <file> -- <outdir>`; see each file's header).
