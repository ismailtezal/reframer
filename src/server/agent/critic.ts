import "server-only";
import os from "node:os";
import { findClaudeExecutable } from "./harness-claude-code";

/**
 * An independent critic for finished videos: a fresh model call (the user's own Claude Code
 * login) that sees only what a viewer would see — a contact sheet and a motion strip — plus
 * the brief and frame measurements, and scores the video on a strict studio rubric. Agents
 * judge their own frames leniently because they know what they meant; the critic doesn't.
 */

export type CritiqueRequest = {
  brief: string;
  /** JPEG data URLs: one frame every few seconds, and consecutive frames from the middle. */
  sheet: string;
  strip: string;
  durationSec: number;
  targetDurationSec?: number;
  /** Measured problems (static stretches, repeated shots, near-empty frames). */
  findings: string[];
};

export type CritiqueVerdict = {
  scores: Record<string, number>;
  overall: number;
  problems: string[];
  fixes: string[];
};

const DIMENSIONS = ["style_fidelity", "craft", "composition", "typography", "color_light", "variety_pacing", "motion"] as const;

const RUBRIC = `You are a senior motion designer and creative director who has shipped work for Apple, Kurzgesagt-level studios and top YouTube channels. You judge strictly: 10 = indistinguishable from the best studio work in that style, 8 = clearly professional and would impress a client, 6 = competent template, 4 = amateur, 2 = broken.`;

const prompt = (r: CritiqueRequest) => `${RUBRIC}

The brief the video was made for:
<brief>
${r.brief}
</brief>

Image 1 is a contact sheet: one frame every few seconds across the whole ${r.durationSec.toFixed(0)}-second video${
  r.targetDurationSec ? ` (the brief asks for ${r.targetDurationSec.toFixed(0)} s)` : ""
} — timestamps top-left. Image 2 is a motion strip: consecutive frames from the middle, read left to right, top to bottom.
${r.findings.length ? `\nMeasured from the rendered frames:\n${r.findings.map((f) => `- ${f}`).join("\n")}\n` : ""}
Score each dimension 1–10, strictly, against the style the brief asks for:
- style_fidelity: does it look and feel like the requested style (not a generic imitation)?
- craft: illustration / render quality — lighting, gradients, texture, detail, depth.
- composition: framing, balance, focal point, negative space; nothing awkwardly cut or cramped; key subjects and text large enough.
- typography: hierarchy, size, font choice, legibility, typographic animation.
- color_light: palette harmony, contrast, use of light and glow.
- variety_pacing: shot variety and visual rhythm; no stretches of near-identical frames; the brief's length and structure met.
- motion: from the strip — easing, secondary motion, camera movement, smoothness; nothing holding still like a slideshow.
- overall: would a viewer believe a top studio made this?
Then list the 3–5 most damaging problems, worst first — concrete, visible in the frames, with timestamps — and for each one a concrete fix an editor agent can make (what to change, where, by how much). The first fix is the single change that would raise the overall score the most.
The agent builds scenes from a kit, so phrase fixes in its terms when they fit: LightStage (lit stage), Camera (push, focus on a point, zoom-through), Device (MacBook/iPhone product shots), RevealText (keynote type), FormatMorph (a frame changing aspect on screen), Critter/Person/Crowd (characters that look, hop, react, point), Sky/Hills/Forest/Planet (layered worlds) under one SceneLight (shared ambient and key light), Callout (anchored labels), Flow (particles moving along a path), real footage (search_stock with type video, which finds free-license clips even without a key; view_media to find the moment in a long clip) and real photos (picked from a contact sheet) brought to life with animate_photos (a 2.5D camera move through each photo's depth), one grade or LUT across all footage, Caption (designed captions: card, marker, outline), a narrated voiceover (generate_voiceover) with captions synced to it (add_captions), and music (generate_music / search_audio) fitted to the cut with fit_music (the track's own ending on the last frame, one seamless bar-aligned edit instead of a fade or a hand-made splice).
Return JSON only: {"style_fidelity":0,"craft":0,"composition":0,"typography":0,"color_light":0,"variety_pacing":0,"motion":0,"overall":0,"problems":["…"],"fixes":["…"]}`;

const imageBlock = (dataUrl: string) => {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("expected a JPEG/PNG data URL");
  return { type: "image" as const, source: { type: "base64" as const, media_type: m[1] as "image/jpeg", data: m[2] } };
};

/** Runs the critic with the user's Claude Code; null when Claude Code isn't installed or signed in. */
export const critique = async (r: CritiqueRequest, model = "opus"): Promise<CritiqueVerdict | null> => {
  const executable = await findClaudeExecutable();
  if (!executable) return null;
  const sdk = await import("@anthropic-ai/claude-agent-sdk");
  async function* messages() {
    yield {
      type: "user" as const,
      message: { role: "user" as const, content: [imageBlock(r.sheet), imageBlock(r.strip), { type: "text" as const, text: prompt(r) }] },
      parent_tool_use_id: null,
    };
  }
  let text = "";
  for await (const m of sdk.query({
    prompt: messages(),
    options: {
      systemPrompt: "You answer with JSON only.",
      tools: [],
      settingSources: [],
      model,
      effort: "high",
      maxTurns: 1,
      cwd: os.tmpdir(),
      pathToClaudeCodeExecutable: executable,
      env: { ...(process.env as Record<string, string>), CLAUDE_AGENT_SDK_CLIENT_APP: "reframer/0.1" },
    },
  })) {
    if (m.type === "assistant") for (const b of m.message.content) if (b.type === "text") text += b.text;
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`critic returned no JSON: ${text.slice(0, 200)}`);
  const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  const scores = Object.fromEntries(DIMENSIONS.map((d) => [d, Number(raw[d]) || 0]));
  return {
    scores,
    overall: Number(raw.overall) || 0,
    problems: Array.isArray(raw.problems) ? raw.problems.map(String) : [],
    fixes: Array.isArray(raw.fixes) ? raw.fixes.map(String) : [],
  };
};
