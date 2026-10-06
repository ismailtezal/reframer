"use client";

import { LoaderIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Project } from "@/core/schema";
import { Editor } from "./Editor";
import { slimProject } from "./media/derived";
import { pause, play, seek, usePlaybackStore } from "./store/playback-store";
import { useProjectStore } from "./store/project-store";
import { useUIStore } from "./store/ui-store";

export const EditorLoader: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch(`/api/projects/${projectId}`)
      .then(async (res) => {
        if (res.status === 404) return alive && setState("missing");
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const { project } = (await res.json()) as { project: Project };
        if (!alive) return;
        // Older projects embedded thumbnails and waveforms; those now come from the local media cache.
        const slim = slimProject(project);
        useProjectStore.getState().load(slim.project);
        if (slim.changed) useProjectStore.getState().setSaveState("dirty");
        useUIStore.getState().clearSelection();
        seek(0);
        setState("ready");
        // Handle for the console and for scripts/perf (inspect state, drive playback).
        (window as unknown as Record<string, unknown>).__reframer = { useProjectStore, useUIStore, usePlaybackStore, seek, play, pause };
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (state === "ready") return <Editor />;
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background text-sm text-muted-foreground">
      {state === "loading" ? (
        <>
          <LoaderIcon className="size-5 animate-spin" /> Opening project…
        </>
      ) : (
        <>
          <p>{state === "missing" ? "This project doesn't exist (anymore)." : "Couldn't load the project."}</p>
          <Button asChild variant="secondary" size="sm">
            <Link href="/">Back to projects</Link>
          </Button>
        </>
      )}
    </div>
  );
};
