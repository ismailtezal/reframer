# Reframer

**The open-source AI video editor.** Describe a video, then watch an agent build it on a real timeline: clips land, titles animate, captions appear, the playhead moves to wherever it's working. Grab the controls at any time. Every change is yours to tweak, undo or keep.

Use any model: Claude, GPT, Gemini, Grok, open models through OpenRouter, local models through Ollama or LM Studio, or your own Claude Code and Codex logins. Everything runs on your computer.

## What it does

- **Watch the agent work.** Edits happen live in the editor. Changed clips glow, a violet playhead shows where the agent is working, each step appears as a row in the chat, and you can click a row to jump to that change. A plan shows what's next.
- **Work together.** The timeline, canvas and inspector stay fully manual. Once you change a clip the agent made, the agent leaves it alone unless you say otherwise. Every message creates a restore point.
- **Clone a style.** Pick from 48 built-in styles, including creators (MrBeast, Hormozi, MKBHD, Kurzgesagt…), brands (Apple keynote, Linear launch…) and genres (A24 trailer, documentary, lo-fi…). Or name any creator, film or brand and the agent studies it and rebuilds the look: grade, type, captions, cuts, transitions and sound.
- **Motion graphics.** 36 production-ready components: kinetic titles, lower thirds, charts, counters, device frames, terminal and code windows, chat bubbles, maps, logo reveals, backgrounds and film looks. Agents can also write new components on the fly.
- **Captions and audio.** Word-timed captions in 11 styles with on-device transcription (Whisper on your GPU) or a cloud engine. Remove filler words and silences, mark beats, generate voiceovers, and use 30 royalty-free sound effects made for the project (CC0).
- **Real export.** Renders run on your machine with Remotion and FFmpeg to MP4, WebM, GIF or ProRes, frame-exact with the preview.
- **Bring your own agent.** Claude Code, Codex, Cursor or any MCP client can drive the editor through the built-in MCP server (Connect agent in the top bar).

## Install

Download the desktop app for Windows, macOS or Linux from the [Releases](../../releases) page.

On first launch, open **Settings** and connect a model:

- **Model keys:** paste an API key for any provider. Keys are stored only on your computer and are sent only to that provider.
- **Local models:** start Ollama or LM Studio and Reframer finds them. Use a model with tool calling (Qwen 3, Llama 3.3…).
- **Claude Code & Codex:** if you have them installed and signed in, turn them on. Reframer runs your own unmodified CLI with your own login and never reads or stores your credentials. These agents get Reframer's editing tools only, with no file or shell access.

## Run from source

Requires Node.js 24+.

```bash
npm install
npm run dev        # editor at http://localhost:3000
npm run desktop    # the same editor in the Electron shell
```

Other scripts: `npm test` (Vitest), `npm run lint` (Biome), `npm run typecheck`, `npm run desktop:build` (installers in `dist/app`).

Local data (projects, media, renders, settings) lives in `.reframer/` when running from source and in your user data folder in the desktop app.

## How it works

```
 Editor UI (React)  ◀──────── bridge (SSE) ────────  Agent harnesses (server)
  timeline · canvas · inspector                       AI SDK (any provider)
  every edit = typed op on the project ──┐            Claude Code · Codex (your CLI)
                                         ▼            MCP server for external agents
                       Project JSON ──▶ Remotion composition ──▶ Player (preview) / renderer (export)
```

- **One edit API** (`src/core/ops.ts`): typed, undoable operations shared by the UI, the built-in agent and MCP. Agents edit the same project you do, through the same rules.
- **The bridge** (`src/server/bridge.ts`): agent tool calls run inside the open editor window, so changes animate in front of you. Results go back to the agent.
- **The composition** (`src/remotion`): the whole project is one Remotion composition, used for both the live preview and the final render.
- **Style DNA** (`src/core/styles`): a structured description of an editing style (pacing, grade, typography, captions, transitions, motion, sound) that applies deterministically and guides the agent.
- **Skills** (`src/agent/skills`): markdown playbooks agents load on demand (launch videos, shorts, explainers, Apple-style motion…).

## Privacy and security

- Local-first: no account, no telemetry, no cloud backend. Your media never leaves your machine unless you use a cloud service you configured (a model, transcription, stock or voice provider).
- The local server listens only on `127.0.0.1` and rejects cross-site requests and unknown host names, so websites in your browser can't drive it.
- The MCP endpoint requires a token (Connect agent → New token rotates it). Media imports from links are limited to public internet addresses.

## Licensing

Reframer's code is MIT licensed (see [LICENSE](LICENSE)).

Reframer uses [Remotion](https://www.remotion.dev) for preview and rendering. Remotion is free for individuals, non-profits and companies of up to three people; larger companies need a [Remotion company license](https://www.remotion.dev/license). If that applies to you, add your license key under Settings.

Other assets:
- **Sound effects:** synthesized from scratch by `scripts/generate-sfx.mjs` and released under CC0.
- **Fonts:** loaded from Google Fonts under their open licenses.
- **Stock search:** uses your own Pexels key and follows Pexels' terms. Credit is suggested, not required.

Style presets describe publicly visible editing techniques. Creator and brand names are used only to describe a style; Reframer isn't affiliated with them.

## Contributing

Presets, components, skills, sounds and providers are designed to be added as single files. See [CONTRIBUTING.md](CONTRIBUTING.md).
