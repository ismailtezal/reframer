"use client";

import { LayoutTemplateIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { insertClip, USER } from "@/core/ops";
import { getProjectDuration } from "@/core/project-utils";
import { createDemoProject } from "@/templates/demo";
import { run } from "../../actions";
import { SectionTitle } from "./Library";

/** Appends a template's clips at the end of the current project. */
const appendTemplate = (make: () => ReturnType<typeof createDemoProject>, label: string) => {
  const tpl = make();
  run(`Insert ${label}`, (d) => {
    const offset = Object.keys(d.clips).length ? getProjectDuration(d) : 0;
    const trackMap = new Map<string, string>();
    const visual = d.tracks.filter((t) => t.kind === "visual");
    const tplVisual = tpl.tracks.filter((t) => t.kind === "visual");
    tplVisual.forEach((t, i) => {
      trackMap.set(t.id, visual[i]?.id ?? visual[visual.length - 1].id);
    });
    for (const t of tpl.tracks.filter((x) => x.kind === "audio")) {
      trackMap.set(t.id, d.tracks.find((x) => x.kind === "audio")?.id ?? t.id);
    }
    Object.assign(d.assets, tpl.assets);
    for (const clip of Object.values(tpl.clips)) {
      insertClip(d, { ...clip, start: clip.start + offset, trackId: trackMap.get(clip.trackId) ?? clip.trackId }, "auto-track", {
        actor: USER,
      });
    }
  });
};

export const TemplatesTab = () => (
  <div>
    <SectionTitle>Starter scenes</SectionTitle>
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <LayoutTemplateIcon className="size-4 text-ai" /> Product intro
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Gradient backdrop, kinetic headline, a stat counter and a closing line.</p>
      <Button size="sm" variant="secondary" onClick={() => appendTemplate(createDemoProject, "product intro")}>
        Insert at end
      </Button>
    </div>
  </div>
);
