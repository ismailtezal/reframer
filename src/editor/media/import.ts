"use client";

import { newId } from "@/core/ids";
import { addAsset } from "@/core/ops";
import type { Asset } from "@/core/schema";
import { getProject, transact } from "../store/project-store";
import { mediaKindOf, probeImage, probeMedia } from "./analyze";
import { hasDerived, posterUrl, probeUrl } from "./derived";

export type ImportProgress = {
  id: string;
  name: string;
  phase: "analyzing" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

/** Uploads a blob to the project's media folder with progress (XHR has upload events, fetch doesn't). */
export const uploadToProject = (
  projectId: string,
  assetId: string,
  file: Blob,
  fileName: string,
  onProgress?: (p: number) => void,
): Promise<{ src: string; size: number }> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/projects/${projectId}/media`);
    xhr.setRequestHeader("x-asset-id", assetId);
    xhr.setRequestHeader("x-file-name", encodeURIComponent(fileName));
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });

type UploadMeta = {
  kind: "video" | "audio" | "image";
  width?: number;
  height?: number;
  durationSec?: number;
  fps?: number;
  hasAudio?: boolean;
  thumbnail?: string;
  waveform?: number[];
};

type ServerProbe = { durationSec: number; width?: number; height?: number; fps?: number; hasVideo: boolean; hasAudio: boolean };

/** Metadata for an uploaded file: server probe (fast, native) with in-browser analysis as the fallback. */
const describeUpload = async (file: File, kind: "video" | "audio" | "image" | "lut", src: string): Promise<UploadMeta> => {
  if (kind === "image") {
    const { probe } = await probeImage(file);
    return { kind: "image", width: probe.width, height: probe.height, thumbnail: posterUrl(src) ?? undefined };
  }
  if (kind === "lut") return { kind: "image" };
  if (hasDerived(src)) {
    try {
      const res = await fetch(probeUrl(src));
      if (res.ok) {
        const p = (await res.json()) as ServerProbe;
        const isVideo = p.hasVideo && kind === "video";
        return {
          kind: isVideo ? "video" : "audio",
          width: isVideo ? p.width : undefined,
          height: isVideo ? p.height : undefined,
          durationSec: p.durationSec,
          fps: isVideo ? p.fps : undefined,
          hasAudio: p.hasAudio,
          thumbnail: isVideo ? (posterUrl(src) ?? undefined) : undefined,
        };
      }
    } catch {
      // fall back to analysing in the browser
    }
  }
  const probe = await probeMedia(file);
  return { ...probe.probe, kind: probe.probe.kind, thumbnail: probe.thumbnail, waveform: probe.waveform };
};

/**
 * Analyzes and uploads files, then adds them to the project as assets
 * (one undo step per file). Returns the created assets.
 */
export const importFiles = async (files: readonly File[], onProgress?: (p: ImportProgress) => void): Promise<Asset[]> => {
  const project = getProject();
  const created: Asset[] = [];
  for (const file of files) {
    const kind = mediaKindOf(file);
    const id = newId("asset");
    const report = (patch: Partial<ImportProgress>) => onProgress?.({ id, name: file.name, phase: "analyzing", progress: 0, ...patch });
    if (!kind) {
      report({ phase: "error", error: "Unsupported file type" });
      continue;
    }
    try {
      // Upload first; the local server analyses media natively (FFmpeg/libvips) while the page stays free.
      report({ phase: "uploading", progress: 0 });
      const { src, size } = await uploadToProject(project.id, id, file, file.name, (p) => report({ phase: "uploading", progress: p }));
      report({ phase: "analyzing" });
      const meta = await describeUpload(file, kind, src);
      const asset: Asset = {
        id,
        type: kind === "lut" ? "lut" : meta.kind,
        name: file.name,
        src,
        mimeType: file.type || "application/octet-stream",
        size,
        width: meta.width,
        height: meta.height,
        durationSec: meta.durationSec,
        fps: meta.fps,
        hasAudio: meta.hasAudio,
        thumbnail: meta.thumbnail,
        waveform: meta.waveform,
        source: "upload",
        createdAt: Date.now(),
      };
      transact(`Import ${file.name}`, (d) => addAsset(d, asset));
      created.push(asset);
      report({ phase: "done", progress: 1 });
    } catch (err) {
      report({ phase: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }
  return created;
};

/** Imports a remote file (stock media, generated assets) by fetching it client-side. */
export const importFromUrl = async (url: string, name: string, origin?: Asset["origin"], source: Asset["source"] = "url") => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const file = new File([blob], name, { type: blob.type });
  const [asset] = await importFiles([file]);
  if (asset && (origin || source !== "upload")) {
    transact(
      "Tag asset",
      (d) => {
        if (d.assets[asset.id]) {
          d.assets[asset.id].origin = origin;
          d.assets[asset.id].source = source;
        }
      },
      { silent: true },
    );
  }
  return asset;
};
