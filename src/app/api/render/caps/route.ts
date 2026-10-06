import os from "node:os";
import { prewarmRenderer } from "@/server/render";
import { getEncoderCaps } from "@/server/render-caps";

export const dynamic = "force-dynamic";

/** What the export dialog can offer on this machine (hardware encoders, cores). */
export async function GET() {
  // The dialog is open, so an export is likely: start the one-time setup now.
  prewarmRenderer();
  const nvenc = await getEncoderCaps().catch(() => ({ h264: false, h265: false }));
  return Response.json({
    nvenc,
    cores: os.availableParallelism?.() ?? os.cpus().length,
    memoryGB: Math.round(os.totalmem() / 1024 ** 3),
  });
}
