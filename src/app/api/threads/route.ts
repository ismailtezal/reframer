import { deleteThread, listThreads, readThread } from "@/server/agent/threads";
import { assertSafeId } from "@/server/paths";

export const dynamic = "force-dynamic";

/** GET ?projectId=…  → thread list;  GET ?projectId=…&threadId=… → one thread with messages. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = assertSafeId(url.searchParams.get("projectId") ?? "");
  const threadId = url.searchParams.get("threadId");
  if (threadId) {
    const thread = await readThread(projectId, assertSafeId(threadId));
    return thread ? Response.json({ thread }) : Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ threads: await listThreads(projectId) });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  await deleteThread(assertSafeId(url.searchParams.get("projectId") ?? ""), assertSafeId(url.searchParams.get("threadId") ?? ""));
  return Response.json({ ok: true });
}
