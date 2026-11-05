"use client";

import { LayoutTemplateIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { insertClip, USER } from "@/core/ops";
import type { PackCard } from "@/core/packs";
import { getProjectDuration } from "@/core/project-utils";
import { createDemoProject } from "@/templates/demo";
import { run } from "../../actions";
import { askAgent } from "../../agent/prompt-bus";
import { addPackFilm } from "../../library-actions";
import { PackDialog } from "../templates/PackDialog";
import { PackTile } from "../templates/PackTile";
import { templatePrompt } from "../templates/template-form";
import { usePacks } from "../templates/usePacks";
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

/** Style packs (public/packs) as templates: each opens a dialog to make it with the agent or fill it in by hand. */
const StyleTemplates = () => {
  const packs = usePacks();
  const [chosen, setChosen] = useState<PackCard | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <SectionTitle>Style templates</SectionTitle>
      {packs === null ? (
        <div className="grid grid-cols-2 gap-2 @[420px]/library:grid-cols-3">
          {Array.from({ length: 4 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeletons
            <Skeleton key={i} className="aspect-[9/16] rounded-lg" />
          ))}
        </div>
      ) : packs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No style packs found in public/packs.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-2 gap-y-3 @[420px]/library:grid-cols-3">
          {packs.map((p) => (
            <PackTile
              key={p.id}
              pack={p}
              onOpen={() => {
                setChosen(p);
                setOpen(true);
              }}
            />
          ))}
        </div>
      )}
      <PackDialog
        pack={chosen}
        open={open}
        onOpenChange={setOpen}
        fillLabel="Add to timeline"
        onAgent={(p, topic) => askAgent(templatePrompt(p, topic))}
        onFill={(p, values) => {
          addPackFilm(p, values);
        }}
      />
    </>
  );
};

export const TemplatesTab = () => (
  <div>
    <StyleTemplates />
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
