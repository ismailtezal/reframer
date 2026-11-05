import { createComponentClip } from "../defaults";
import { addMarker, addTrack, insertClip, USER, updateSettings } from "../ops";
import type { Project } from "../schema";
import { secondsToFrames } from "../time";
import { filmInputs, type PackCard } from "./index";

/**
 * Puts a page pack's film on a project, the way a template starts: on an empty project at the start, after
 * switching the canvas to the film's own size; otherwise at `atFrame`, its box kept in the film's aspect
 * (letterboxed on another canvas). It goes on the bottom visual track, under everything else.
 *
 * The film never draws its narration lines (the inputs a beat says): they become note markers on their beats,
 * where the voice-over goes. Returns the film clip's id.
 */
export const insertPackFilm = (d: Project, pack: PackCard, values: Record<string, unknown>, atFrame = 0): string => {
  const fresh = Object.keys(d.clips).length === 0;
  if (fresh && pack.size && (d.settings.width !== pack.size.width || d.settings.height !== pack.size.height))
    updateSettings(d, { width: pack.size.width, height: pack.size.height });
  const { width, height, fps } = d.settings;
  const start = fresh ? 0 : Math.max(0, Math.round(atFrame));
  const aspect = pack.size ? pack.size.width / pack.size.height : width / height;
  const boxWidth = Math.min(width, height * aspect);
  const visual = d.tracks.filter((t) => t.kind === "visual" && !t.locked);
  const trackId = visual[visual.length - 1]?.id ?? addTrack(d, { kind: "visual" });
  const clip = createComponentClip(d.settings, {
    trackId,
    start,
    duration: secondsToFrames(pack.durationSec, fps),
    component: "page-film",
    name: pack.name,
    props: { pack: pack.id, inputs: JSON.stringify(filmInputs(pack, values)) },
    transform: { x: width / 2, y: height / 2, width: boxWidth, height: boxWidth / aspect },
  });
  const id = insertClip(d, clip, "auto-track", { actor: USER });
  for (const beat of pack.beats) {
    const line = beat.say ? values[beat.say] : undefined;
    if (typeof line === "string" && line.trim())
      addMarker(d, { frame: start + secondsToFrames(beat.atSec, fps), label: line.trim(), kind: "note" });
  }
  return id;
};
