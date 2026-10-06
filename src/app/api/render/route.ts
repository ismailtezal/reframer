import type { Project } from "@/core/schema";
import { cancelRender, getJob, latestJobFor, type RenderFormat, type RenderQuality, startRender } from "@/server/render";

export const dynamic = "force-dynamic";

const FORMATS = new Set<RenderFormat>(["mp4", "webm", "gif", "prores"]);
const QUALITIES = new Set<RenderQuality>(["standard", "high", "max"]);

/** Starts a render of the project exactly as the editor has it. */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    project?: Project;
    format?: RenderFormat;
    quality?: RenderQuality;
    scale?: number;
    range?: [number, number];
  };
  if (!body.project?.id) return Response.json({ error: "project required" }, { status: 400 });
  const format = body.format && FORMATS.has(body.format) ? body.format : "mp4";
  const quality = body.quality && QUALITIES.has(body.quality) ? body.quality : "high";
  const scale = [0.5, 1, 2].includes(Number(body.scale)) ? Number(body.scale) : 1;
  const range = body.range && body.range[1] > body.range[0] ? ([Math.max(0, body.range[0]), body.range[1]] as [number, number]) : undefined;
  try {
    const job = startRender({ project: body.project, origin: new URL(request.url).origin, format, quality, scale, range });
    return Response.json({ job });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}

/** ?jobId=… for one job, or ?projectId=… for the project's latest render. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const jobId = params.get("jobId");
  const projectId = params.get("projectId");
  const job = jobId ? getJob(jobId) : projectId ? latestJobFor(projectId) : undefined;
  return Response.json({ job: job ?? null });
}

export async function DELETE(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId");
  return Response.json({ cancelled: jobId ? cancelRender(jobId) : false });
}
