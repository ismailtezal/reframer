import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import { getJob } from "@/server/render";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  gif: "image/gif",
  mov: "video/quicktime",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
};

/** Downloads a finished render. */
export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId");
  const job = jobId ? getJob(jobId) : undefined;
  if (!job || job.status !== "done") return Response.json({ error: "Render not found" }, { status: 404 });
  const stat = await fs.stat(job.outputPath).catch(() => null);
  if (!stat) return Response.json({ error: "The file was moved or deleted" }, { status: 404 });
  const ext = job.fileName.split(".").pop() ?? "mp4";
  const inline = new URL(request.url).searchParams.get("inline") === "1";
  return new Response(Readable.toWeb(createReadStream(job.outputPath)) as ReadableStream, {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Content-Length": String(stat.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${job.fileName}"`,
    },
  });
}
