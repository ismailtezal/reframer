import { stopTurns } from "@/server/agent/turns";
import { assertSafeId } from "@/server/paths";

export const dynamic = "force-dynamic";

/** Stops running agent turns. Accepts JSON or a sendBeacon payload. */
export async function POST(request: Request) {
  const body = JSON.parse((await request.text()) || "{}") as { projectId?: string; threadId?: string };
  if (!body.projectId) return Response.json({ error: "projectId required" }, { status: 400 });
  const stopped = stopTurns(assertSafeId(body.projectId), body.threadId ? assertSafeId(body.threadId) : undefined);
  return Response.json({ stopped });
}
