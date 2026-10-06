# Contributing to Reframer

Thanks for helping. Most contributions are a single file: a style, a motion component, a skill or a sound.

## Setup

```bash
npm install
npm run dev       # http://localhost:3000
npm test          # Vitest
npm run lint      # Biome (format + lint)
npm run typecheck
```

Before opening a pull request, run `npm run lint`, `npm run typecheck` and `npm test`. CI runs the same checks plus a production build.

## Project map

| Path | What lives there |
| --- | --- |
| `src/core` | Project schema, the edit API (`ops.ts`), time, easing, keyframes, captions, LUTs, styles. No React, no DOM. |
| `src/remotion` | The composition: one layer per clip type, effects, transitions, motion components, code-component runtime. |
| `src/editor` | The editor UI: stores, timeline, canvas, inspector, library, agent chat, dialogs. |
| `src/agent` | Agent tool schemas, the system prompt, project summaries and skills (markdown playbooks). |
| `src/server` | Local server: projects, settings, the editor bridge, agent harnesses, rendering. |
| `src/app/api` | HTTP routes for the above, including the MCP endpoint. |
| `electron` | Desktop shell. |

## Add a style

Styles are Style DNA objects (`src/core/styles/schema.ts`). Add one to `src/core/styles/presets/creators.ts`, `brands.ts` or `genres.ts`, usually starting from an archetype base with `getArchetypeBase(...)`.

- Describe techniques, not people: what makes the edits recognizable (pacing, grade, type, captions, transitions, sound).
- `signature` lists the 3–5 tells, and `avoid` lists what the style never does.
- Use Google Fonts, and record the original typeface in `originalFont`.
- Reference sounds by their ids in `src/core/sfx.ts`.

The catalog tests validate every preset against the schema and check its sound ids.

## Add a motion component

1. Create a file under `src/remotion/components/<category>/`. Export `defineMotionComponent({ id, name, description, category, schema, defaultDuration, component })`.
2. Add it to `MOTION_COMPONENTS` in `src/remotion/components/registry.ts`.

That's all: the inspector builds controls from `schema`, the library shows a live preview, and agents see it in their catalog.

Rules:

- Drive animation from `useCurrentFrame()` only. Never use CSS animations or timers.
- Use the box size and clip length from props (`BoxProps`), not `useVideoConfig()`, which describes the whole video.
- Don't name props `width`, `height` or `durationInFrames`; the clip box overwrites them.
- Keep it fast: avoid full-frame SVG blur filters and per-frame `feTurbulence`. For grain, use `getGrainTile` from `helpers`.
- Check it at 16:9, 9:16 and 1:1, on dark and light footage.

## Add a skill

Skills are markdown playbooks in `src/agent/skills/`, with frontmatter `name` and `description`. Agents load them with `load_skill`. Make them concrete: structure, timings, which tools to call and in what order, and how to review the result.

## Add a sound

Sounds are generated, never sampled. Add a recipe to `scripts/generate-sfx.mjs`, run `npm run sfx -- <id>`, and add an entry to `src/core/sfx.ts` with the measured duration and a description that says where the peak is.

## Add a model provider

Providers come from the AI SDK. Add the provider id to `API_PROVIDERS` in `src/server/settings.ts`, add its factory to `resolveLanguageModel` in `src/server/agent/models.ts`, and add its key help in the Settings dialog.

## Code style

- Biome formats at 140 columns. Run `npm run format`.
- Prefer the edit API (`src/core/ops.ts`) for any project change. UI actions call `run(label, draft => op(...))` so they're undoable and attributed.
- UI: 13 px text, 28 px controls, one accent color (`brand`). The agent's violet (`ai`) appears only while an agent is acting. Animate only transform and opacity, and never animate scrubbing, dragging or playback.
