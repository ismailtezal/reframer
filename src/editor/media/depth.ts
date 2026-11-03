"use client";

import { updateAsset } from "@/core/ops";
import { getProject, transact } from "../store/project-store";
import { uploadToProject } from "./import";

/**
 * Depth maps for photos, estimated in the browser (Depth Anything V2 small, WebGPU when available,
 * WASM otherwise). The model downloads once and is cached by the browser. Bright = near.
 */

const MODEL = "onnx-community/depth-anything-v2-small";

type DepthPipeline = (input: unknown) => Promise<{ depth: { toCanvas: () => OffscreenCanvas | HTMLCanvasElement } }>;

let pipe: Promise<DepthPipeline> | null = null;

const load = (onProgress?: (text: string) => void) => {
  pipe ??= (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const webgpu = typeof navigator !== "undefined" && "gpu" in navigator;
    const progress = (p: { status?: string; progress?: number }) => {
      if (p.status === "progress" && typeof p.progress === "number")
        onProgress?.(`Downloading depth model ${Math.round(p.progress)}% (first time only)`);
    };
    const make = (device: "webgpu" | "wasm") =>
      pipeline("depth-estimation", MODEL, { device, dtype: device === "webgpu" ? "fp16" : "q8", progress_callback: progress });
    try {
      return (await (webgpu ? make("webgpu") : make("wasm"))) as unknown as DepthPipeline;
    } catch {
      return (await make("wasm")) as unknown as DepthPipeline;
    }
  })();
  pipe.catch(() => {
    pipe = null;
  });
  return pipe;
};

/** A PNG blob of the photo's depth map (same aspect ratio, softened so parallax doesn't tear edges). */
export const estimateDepth = async (src: string, onProgress?: (text: string) => void): Promise<Blob> => {
  const run = await load(onProgress);
  onProgress?.("Measuring depth…");
  // Read the picture ourselves (the library's URL loader trips over app-relative media paths).
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Could not read the photo (${res.status})`);
  const { RawImage } = await import("@huggingface/transformers");
  const out = await run(await RawImage.fromBlob(await res.blob()));
  const raw = out.depth.toCanvas();
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  // Back to the photo's own aspect ratio (the model works on a square-ish grid), with a light blur.
  const w = Math.min(1024, img.naturalWidth);
  const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("No 2D canvas");
  g.filter = `blur(${Math.max(2, Math.round(w / 200))}px)`;
  g.drawImage(raw as CanvasImageSource, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the depth map"))), "image/png"),
  );
};

// Dev only: estimate a depth map from the console or a test driver (returns a PNG data URL).
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  Object.assign(window, {
    __reframerDepth: async (src: string) => {
      const blob = await estimateDepth(src, (t) => console.info(`[depth] ${t}`));
      return new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(blob);
      });
    },
  });
}

/** The asset's depth map URL, estimating and saving it next to the photo the first time. */
export const ensureDepthForAsset = async (assetId: string, onProgress?: (text: string) => void): Promise<string> => {
  const asset = getProject().assets[assetId];
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  if (asset.type !== "image") throw new Error(`${asset.name} isn't a photo`);
  if (asset.analysis?.depth) return asset.analysis.depth;
  const blob = await estimateDepth(asset.src, onProgress);
  const { src } = await uploadToProject(getProject().id, `${asset.id}-depth`, blob, `${asset.name.replace(/\.[^.]+$/, "")}-depth.png`);
  transact("Store depth map", (d) => updateAsset(d, assetId, { analysis: { ...d.assets[assetId]?.analysis, depth: src } }), {
    silent: true,
  });
  return src;
};
