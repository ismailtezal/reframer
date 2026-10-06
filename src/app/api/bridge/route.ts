import { type BridgeEvent, bridge } from "@/server/bridge";

export const dynamic = "force-dynamic";

/** Server-sent events stream for an editor window. */
export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return new Response("projectId required", { status: 400 });
  const encoder = new TextEncoder();
  let clientId = "";
  let ping: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const send = (e: BridgeEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      clientId = bridge.connect(projectId, send);
      ping = setInterval(() => {
        try {
          send({ type: "ping" });
        } catch {
          clearInterval(ping);
        }
      }, 15_000);
      request.signal.addEventListener("abort", () => {
        clearInterval(ping);
        bridge.disconnect(clientId);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      clearInterval(ping);
      bridge.disconnect(clientId);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

type PostBody =
  | { type: "result"; requestId: string; ok: true; result: unknown }
  | { type: "result"; requestId: string; ok: false; error: string }
  | { type: "focus"; clientId: string };

/** Tool results (and focus pings) from the editor window. */
export async function POST(request: Request) {
  const body = (await request.json()) as PostBody;
  if (body.type === "focus") {
    bridge.focus(body.clientId);
    return Response.json({ ok: true });
  }
  const accepted = bridge.resolve(body.requestId, body.ok ? { ok: true, result: body.result } : { ok: false, error: body.error });
  return Response.json({ ok: accepted });
}
