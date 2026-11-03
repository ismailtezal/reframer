import { type CritiqueRequest, critique } from "@/server/agent/critic";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Independent critic for a finished video (see server/agent/critic.ts). */
export async function POST(request: Request) {
  const body = (await request.json()) as CritiqueRequest & { model?: string };
  if (!body.brief || !body.sheet || !body.strip) return Response.json({ error: "brief, sheet and strip are required" }, { status: 400 });
  try {
    const verdict = await critique(body, body.model);
    if (!verdict)
      return Response.json({
        unavailable: "Claude Code isn't installed, so there is no independent critic; judge the frames yourself against the rubric.",
      });
    return Response.json({ verdict });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
