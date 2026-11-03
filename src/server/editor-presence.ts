import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./paths";

/**
 * Tells the `reframer` CLI which projects are open in an editor window (`editors.json` in the data
 * folder): an edit to an open project goes through that editor, live and undoable there, instead of
 * into the file the editor would save over. The CLI checks `pid` to ignore a file a dead app left.
 */

let origin: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

/** The address editor windows reach this server at (the CLI calls the same one). */
export const setPresenceOrigin = (value: string) => {
  origin = value;
};

export const writePresence = (open: { projectId: string; since: number }[]) => {
  if (!origin) return;
  const at = origin;
  // Windows connect and reconnect in bursts: write once they settle.
  clearTimeout(timer);
  timer = setTimeout(() => {
    const file = path.join(DATA_DIR, "editors.json");
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFile(tmp, JSON.stringify({ pid: process.pid, origin: at, updatedAt: Date.now(), open }))
      .then(() => fs.rename(tmp, file))
      .catch(() => undefined);
  }, 100);
};
