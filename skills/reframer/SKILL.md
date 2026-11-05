---
name: reframer
description: Make and edit videos with the reframer CLI (headless Reframer video editor): create projects, import media, apply typed edit ops, look at frames, run quality checks, make hook variants and render MP4s. Use for any video, reel, short, promo or podcast clip task on this machine.
---

# reframer CLI

Reframer is a local AI-native video editor (Remotion + React). The `reframer` CLI drives it without
its window. Every command prints **one JSON document on stdout** (`{"ok":true,...}` or
`{"ok":false,"error":{"code","message","hint","details"}}`), writes progress to stderr, never asks a
question, and exits with a meaningful code:

| exit | code | meaning |
| --- | --- | --- |
| 0 | — | ok |
| 2 | E_USAGE | bad command or flag (see `hint`) |
| 3 | E_NOT_FOUND | project, clip, asset or file missing |
| 4 | E_INVALID | an op was refused: `details` says which op and why; nothing was applied |
| 5 | E_RENDER | render failed |
| 6 | E_CHECK | `check --strict` found errors (the full result is in `details`) |
| 7 | E_CONFLICT | the project is open in the editor and the command can't go through it |
| 8 | E_ENV | missing ffmpeg/browser/library (`reframer doctor`) |

`reframer --help` lists commands; `reframer <command> --help` lists flags. Projects can be named by
id, exact name or id prefix.

## The loop

1. `reframer new --format 9:16 --name "Reel" [--style <id>]` → `projectId`. Formats: 16:9, 9:16, 1:1, 4:5.
2. `reframer import <project> clip.mp4 music.mp3 logo.png` → `assetId`s (files or URLs, all or nothing).
3. `reframer apply <project> ops.json` (or `-` for stdin, or inline JSON). Validated first, atomic.
4. Look: `reframer still <project> --every 1 --scale 0.5 --sheet` → PNGs + one contact sheet. Read them.
5. Measure: `reframer check <project> --brief "what it's for" --target 30`. Fix every error, re-check.
6. `reframer render <project> --out out.mp4 --priority low` (low keeps a game or call smooth).

`reframer undo <project>` restores the state before the last apply. `reframer show <project>` prints the
timeline (tracks, clips with ids, times, boxes, text); add `--range 0,5` to zoom in.

## Ops

An op is `{"op": "<tool>", ...input}`. Times are seconds; `transform.x/y` are the box **center** in px
(1080×1920 for 9:16). Omit `trackId`: clips are layered automatically (backgrounds at the bottom,
footage above, titles and graphics on top). Field reference: `reframer schema <op>`.

```json
[
  { "op": "add_clips", "clips": [
    { "type": "background", "fill": { "type": "linear", "angle": 160, "colors": ["#0b1033", "#1d2a6b"] }, "startSec": 0, "durationSec": 8 },
    { "type": "video", "assetId": "asset_ab12", "startSec": 0, "durationSec": 5, "trimStartSec": 12 },
    { "type": "text", "name": "Hook", "text": "Bunu kimse söylemiyor", "startSec": 0, "durationSec": 2.5,
      "transform": { "y": 760 }, "style": { "fontSize": 104, "fontFamily": "Montserrat", "fontWeight": 800 } },
    { "type": "component", "component": "counter", "props": { "to": 128, "suffix": "K", "label": "kullanıcı" }, "startSec": 3, "durationSec": 3 },
    { "type": "audio", "assetId": "asset_music", "startSec": 0, "durationSec": 8, "role": "music", "duck": true }
  ] },
  { "op": "update_clips", "updates": [ { "id": "clip_x", "patch": { "text": "Yeni metin", "startSec": 1 } } ] },
  { "op": "set_transition", "id": "clip_y", "transition": { "type": "whip", "durationSec": 0.3 } }
]
```

Edit ops: add_clips, update_clips, delete_clips, split_clip, trim_clip, ripple_delete_range,
set_keyframes, set_transition, apply_style, add_markers, set_canvas, set_brand, create_component,
update_component, add_captions.

- Components (charts, counters, lower thirds, device frames, social posts…): `reframer components --json`
  gives each one's props with types and defaults. Set every text prop: `check` flags sample copy left in.
- Styles (looks, type, motion, palette): `reframer styles`, then `{"op":"apply_style","styleId":"…"}`.
- Style packs (whole looks a film is made in: Art Deco, CRT terminal, 1930s rubber hose, 80s anime, sci-fi
  sitcom, liminal camcorder, Vox collage…): `reframer packs` lists them, `reframer packs <id> --guide` prints
  the rules, the template inputs and the beats. `reframer packs <id> --inputs '{…}'` checks the inputs and
  prints the op that adds the film (a `page-film` clip that draws every frame itself). Voice each narration
  line on its beat, then the pack's music and caption style on top; never cover the film's own type.
- Captions need a transcript: `reframer tool <project> transcribe '{"assetId":"…"}'` (needs the editor
  open), then `{"op":"add_captions","clipId":"<the video or voice clip>"}`.
- Any other agent tool (remove_silences, detect_beats, fit_music, search_audio, generate_voiceover…):
  `reframer schema <tool>` for its input, `reframer tool <project> <tool> '<json>'` to call it (in the editor).
- Expert playbooks (the editor agent's own): `reframer playbook` lists them, `reframer playbook shorts-captions`
  prints one. Read the matching one before a big edit.

## Seeing and checking

- `still` renders exact frames: `--frames 0,30,90`, `--at 1.5,3`, `--every 2`, `--count 8`, `--sheet`.
- `check` renders about one frame a second and measures: text off the frame, cut off, overlapping,
  too small, low contrast against the picture, under TikTok/Reels/Shorts buttons (9:16), letters the font
  can't draw (Turkish ğ ş ı İ in a Latin-only font), broken encodings, sample text left in components,
  frozen stretches, repeated shots, pace and mood against `--brief`, footage grades that don't match,
  and the soundtrack (silence, music cut off mid-phrase, cuts off the beat, effects too loud).
  Findings carry `clipId` and `atSec`: fix that clip. `--fast` skips the frames; `--strict` exits 6 on errors.

## Variants (A/B hooks, trial reels)

```bash
reframer variants <project> --hooks hooks.json --check --render --out ./reels --priority low
```

`hooks.json` is `["hook one", "hook two"]` or `[{ "name": "soru", "text": "…", "ops": [ … ] }]`. The hook is
the clip named "hook" (else the first words on screen in the first 3 s; `--target <clipId>` to choose).
Variants stay in memory unless `--save`. The result lists each variant's file and its own findings.

## Notes

- Write op and hook files as **UTF-8** (PowerShell: `Set-Content -Encoding utf8`); a wrong encoding shows
  up as `BugÃ¼n` and `check` reports it.
- When the project is open in the Reframer editor, `apply` and `tool` go through it live (the user sees
  the change, and it lands in the editor's undo). `--headless` writes the file anyway.
- Chain with other CLIs: `reframer render p --out reel.mp4 && postiz upload reel.mp4 …`.
- `reframer doctor` reports ffmpeg, the render browser, the data folder and a running editor.
  `--desktop` uses the desktop app's projects; `--data-dir <dir>` any other folder.
