import "server-only";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { UIMessage } from "ai";
import { assertSafeId, threadsDir } from "../paths";

export type ThreadRecord = {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelRef?: string;
  messages: UIMessage[];
  /** Resume handles for local agent harnesses. */
  harness: { claudeSessionId?: string; codexThreadId?: string };
};

const file = (projectId: string, threadId: string) => path.join(threadsDir(projectId), `${assertSafeId(threadId)}.json`);

export const readThread = async (projectId: string, threadId: string): Promise<ThreadRecord | null> => {
  try {
    return JSON.parse(await fs.readFile(file(projectId, threadId), "utf8")) as ThreadRecord;
  } catch {
    return null;
  }
};

export const writeThread = async (thread: ThreadRecord) => {
  await fs.mkdir(threadsDir(thread.projectId), { recursive: true });
  const target = file(thread.projectId, thread.id);
  const tmp = `${target}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(thread), "utf8");
  await fs.rename(tmp, target);
};

export const listThreads = async (projectId: string) => {
  const dir = threadsDir(projectId);
  if (!existsSync(dir)) return [];
  const out: Omit<ThreadRecord, "messages">[] = [];
  for (const f of await fs.readdir(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const t = JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as ThreadRecord;
      const { messages, ...meta } = t;
      out.push({ ...meta, title: meta.title || firstUserText(messages).slice(0, 60) || "New chat" });
    } catch {
      // skip corrupt
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const deleteThread = async (projectId: string, threadId: string) => {
  await fs.rm(file(projectId, threadId), { force: true });
};

export const firstUserText = (messages: UIMessage[]) => {
  const m = messages.find((x) => x.role === "user");
  return m ? textOf(m) : "";
};

export const textOf = (m: UIMessage) =>
  m.parts
    .filter((p): p is Extract<UIMessage["parts"][number], { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
