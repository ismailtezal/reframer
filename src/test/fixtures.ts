import { createProject, createTextClip, createVideoClip } from "@/core/defaults";
import type { Asset, Project } from "@/core/schema";

/** A 30 fps 1080p project with the default Overlay / Main / Audio tracks. */
export const makeProject = (): Project => createProject({ name: "Test", width: 1920, height: 1080, fps: 30 });

export const trackId = (p: Project, name: string) => {
  const t = p.tracks.find((x) => x.name === name);
  if (!t) throw new Error(`no track ${name}`);
  return t.id;
};

export const videoAsset = (p: Project, id = "asset_video1", durationSec = 20): Asset => {
  const asset: Asset = {
    id,
    type: "video",
    name: "clip.mp4",
    src: "/media/clip.mp4",
    mimeType: "video/mp4",
    width: 1920,
    height: 1080,
    durationSec,
    fps: 30,
    hasAudio: true,
    source: "upload",
    createdAt: 0,
  };
  p.assets[id] = asset;
  return asset;
};

export const text = (p: Project, track: string, start: number, duration: number, label = "Title") =>
  createTextClip(p.settings, { trackId: trackId(p, track), start, duration, text: label });

export const video = (p: Project, track: string, start: number, duration: number, asset = videoAsset(p)) =>
  createVideoClip(p.settings, asset, { trackId: trackId(p, track), start, duration });
