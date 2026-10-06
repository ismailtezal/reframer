import type { ExportSettings } from "@/core/export";
import type { Project } from "@/core/schema";
import { cancelRender, clearFinished, getJob, listJobs, startRender } from "@/server/render";

export const dynamic = "force-dynamic";

/** The original export options (format + quality + scale), still accepted from older clients and agents. */
const legacySettings = (body: { format?: string; quality?: string; scale?: number }, project: Project): Partial<ExportSettings> => {
  const quality = body.quality === "standard" || body.quality === "max" ? body.quality : "high";
  const scale = [0.5, 1, 2].includes(Number(body.scale)) ? Number(body.scale) : 1;
  const resolution = scale === 1 ? ("project" as const) : Math.round(Math.min(project.settings.width, project.settings.height) * scale);
  switch (body.format) {
    case "webm":
      return { format: "webm", videoCodec: "vp9", audioCodec: "opus", crf: { standard: 34, high: 28, max: 20 }[quality], resolution };
    case "gif":
      return {
        format: "gif",
        videoCodec: "gif",
        resolution: Math.round(Math.min(project.settings.width, project.settings.height) * Math.min(scale, 0.5)),
      };
    case "prores":
      return { format: "mov", videoCodec: "prores", proresProfile: "hq", audioCodec: "pcm", resolution };
    default:
      return { format: "mp4", videoCodec: "h264", crf: { standard: 23, high: 18, max: 14 }[quality], resolution };
  }
};

/** Queues a render of the project exactly as the editor has it. */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    project?: Project;
    settings?: Partial<ExportSettings>;
    presetName?: string;
    range?: [number, number];
    format?: string;
    quality?: string;
    scale?: number;
  };
  if (!body.project?.id) return Response.json({ error: "project required" }, { status: 400 });
  const range =
    body.range && body.range[1] >= body.range[0] ? ([Math.max(0, body.range[0]), body.range[1]] as [number, number]) : undefined;
  try {
    const job = startRender({
      project: body.project,
      origin: new URL(request.url).origin,
      settings: body.settings ?? legacySettings(body, body.project),
      presetName: body.presetName,
      range,
    });
    return Response.json({ job });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}

/** ?jobId=… for one job, or ?projectId=… for that project's queue (newest first). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const jobId = params.get("jobId");
  if (jobId) return Response.json({ job: getJob(jobId) ?? null });
  const jobs = listJobs(params.get("projectId") ?? undefined);
  return Response.json({ job: jobs[0] ?? null, jobs });
}

/** ?jobId=… cancels; ?clear=1[&projectId=…] forgets finished jobs. */
export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("clear")) {
    clearFinished(params.get("projectId") ?? undefined);
    return Response.json({ cleared: true });
  }
  const jobId = params.get("jobId");
  return Response.json({ cancelled: jobId ? cancelRender(jobId) : false });
}
