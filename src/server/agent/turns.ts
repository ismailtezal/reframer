import "server-only";

/**
 * Running agent turns, so a turn can be stopped from anywhere: the Stop
 * button, Esc, or the editor window closing (which doesn't always abort the
 * HTTP request on its own).
 */
const g = globalThis as unknown as { __reframerTurns?: Map<string, AbortController> };
const running: Map<string, AbortController> = g.__reframerTurns ?? new Map();
g.__reframerTurns = running;

const key = (projectId: string, threadId: string) => `${projectId}:${threadId}`;

/** Starts tracking a turn. A newer turn in the same thread stops the older one. */
export const beginTurn = (projectId: string, threadId: string, requestSignal: AbortSignal): AbortController => {
  const k = key(projectId, threadId);
  running.get(k)?.abort(new Error("Superseded by a newer message"));
  const controller = new AbortController();
  requestSignal.addEventListener("abort", () => controller.abort(requestSignal.reason), { once: true });
  running.set(k, controller);
  return controller;
};

export const endTurn = (projectId: string, threadId: string, controller: AbortController) => {
  const k = key(projectId, threadId);
  if (running.get(k) === controller) running.delete(k);
};

/** Stops one thread's turn, or every turn in the project when no thread is given. */
export const stopTurns = (projectId: string, threadId?: string): number => {
  let stopped = 0;
  for (const [k, controller] of running) {
    if (k === key(projectId, threadId ?? "") || (!threadId && k.startsWith(`${projectId}:`))) {
      controller.abort(new Error("Stopped by the user"));
      running.delete(k);
      stopped++;
    }
  }
  return stopped;
};
