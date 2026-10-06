"use client";

import { Player } from "@remotion/player";
import { useEffect, useState } from "react";
import type { Project } from "@/core/schema";
import { getCompositionMetadata, ProjectComposition } from "@/remotion/ProjectComposition";
import { createDemoProject } from "@/templates/demo";

export default function DevPlayground() {
  // Created on the client only: ids are random, so SSR would mismatch.
  const [project, setProject] = useState<Project | null>(null);
  useEffect(() => setProject(createDemoProject()), []);
  if (!project) return null;
  const meta = getCompositionMetadata(project);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 p-8">
      <h1 className="text-sm text-neutral-400">Renderer playground</h1>
      <div className="w-full max-w-5xl overflow-hidden rounded-xl border border-white/10">
        <Player
          component={ProjectComposition}
          inputProps={{ project, editor: true }}
          durationInFrames={meta.durationInFrames}
          compositionWidth={meta.width}
          compositionHeight={meta.height}
          fps={meta.fps}
          controls
          loop
          autoPlay
          style={{ width: "100%" }}
        />
      </div>
    </main>
  );
}
