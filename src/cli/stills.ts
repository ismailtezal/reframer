import { getProjectDuration } from "@/core/project-utils";
import type { Project } from "@/core/schema";
import { ensureRenderBrowser, getServeUrl } from "@/server/render";
import { readSettings } from "@/server/settings";
import type { CliContext } from "./context";
import { CliError } from "./errors";
import { startMediaServer } from "./media-server";

/**
 * Frames of a project as images, drawn by the same composition and headless Chrome as the export.
 * One session keeps a browser and the media server open across many frames.
 */
export type StillSession = {
  durationInFrames: number;
  fps: number;
  /** PNG of one frame; extra props switch on probes (text probe, layout probe). */
  png: (
    frame: number,
    opts?: { scale?: number; props?: Record<string, unknown>; onArtifact?: (filename: string, content: string) => void },
  ) => Promise<Buffer>;
  close: () => Promise<void>;
};

export const openStillSession = async (ctx: CliContext, project: Project): Promise<StillSession> => {
  const media = await startMediaServer(ctx.appRoot);
  let lastShown = -10;
  const serveUrl = await getServeUrl((p) => {
    if (p - lastShown >= 20) {
      lastShown = p;
      ctx.log(`Preparing the renderer (first run builds the composition)… ${Math.round(p)}%`);
    }
  }).catch((err) => {
    throw new CliError("E_ENV", `Couldn't build the composition: ${err instanceof Error ? err.message : err}`);
  });
  await ensureRenderBrowser().catch((err) => {
    throw new CliError("E_ENV", `Couldn't get the render browser: ${err instanceof Error ? err.message : err}`);
  });
  const { openBrowser, renderStill, selectComposition } = await import("@remotion/renderer");
  const { remotionLicenseKey } = await readSettings();
  // GPU WebGL where there is one (effects, parallax); Chrome's software path otherwise.
  let gl: "angle" | null = "angle";
  const browser = await openBrowser("chrome", { chromiumOptions: { gl }, logLevel: "error" }).catch(() => {
    gl = null;
    return openBrowser("chrome", { chromiumOptions: { gl: null }, logLevel: "error" });
  });
  const inputProps = { project, editor: false, mediaBaseUrl: media.origin };
  const composition = await selectComposition({ serveUrl, id: "reframer", inputProps, puppeteerInstance: browser, logLevel: "error" });
  const total = getProjectDuration(project);
  return {
    durationInFrames: composition.durationInFrames || total,
    fps: composition.fps,
    png: async (frame, opts = {}) => {
      const props = { ...inputProps, ...opts.props };
      const { buffer } = await renderStill({
        composition: { ...composition, props },
        serveUrl,
        frame: Math.max(0, Math.min(composition.durationInFrames - 1, Math.round(frame))),
        inputProps: props,
        imageFormat: "png",
        scale: opts.scale ?? 1,
        puppeteerInstance: browser,
        chromiumOptions: { gl },
        logLevel: "error",
        licenseKey: remotionLicenseKey || null,
        ...(opts.onArtifact
          ? {
              onArtifact: (a: { filename: string; content: string | Uint8Array }) =>
                opts.onArtifact?.(a.filename, typeof a.content === "string" ? a.content : new TextDecoder().decode(a.content)),
            }
          : {}),
      });
      if (!buffer) throw new CliError("E_RENDER", `Frame ${frame} came back empty`);
      return buffer;
    },
    close: async () => {
      await browser.close({ silent: true }).catch(() => undefined);
      await media.close();
    },
  };
};
