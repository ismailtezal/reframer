"use client";

import { CheckIcon, DownloadIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getProjectDuration } from "@/core/project-utils";
import { formatSeconds } from "@/core/time";
import { cn } from "@/lib/utils";
import { usePlaybackStore } from "../../store/playback-store";
import { getProject, useProjectStore } from "../../store/project-store";
import { isActive, type RenderJob, useRenderStore } from "../../store/render-store";

type Format = "mp4" | "webm" | "gif" | "prores";
type Quality = "standard" | "high" | "max";

const FORMATS: { id: Format; label: string; hint: string }[] = [
  { id: "mp4", label: "MP4", hint: "Plays everywhere. Best for YouTube, social and sharing." },
  { id: "webm", label: "WebM", hint: "Smaller files for the web." },
  { id: "gif", label: "GIF", hint: "Silent loop at half size and 15 fps." },
  { id: "prores", label: "ProRes", hint: "Near-lossless .mov for further editing. Large files." },
];

const Segmented = <T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
}) => (
  <div className="space-y-1.5">
    <div className="text-xs font-medium text-muted-foreground">{label}</div>
    <div className="flex gap-0.5 rounded-md bg-foreground/[0.04] p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          disabled={o.disabled}
          onClick={() => onChange(o.id)}
          className={cn(
            "h-7 flex-1 rounded-[5px] px-2 text-xs font-medium text-muted-foreground tabular transition-colors duration-150 hover:text-foreground disabled:opacity-40",
            value === o.id && "bg-raised text-foreground shadow-sm",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

const formatBytes = (n?: number) =>
  !n ? "" : n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`;

const Progress: React.FC<{ job: RenderJob; onCancel: () => void }> = ({ job, onCancel }) => (
  <div className="space-y-3 py-2">
    <div className="flex items-baseline justify-between">
      <span className="text-2xl font-semibold tabular">{Math.round(job.progress * 100)}%</span>
      <span className="text-xs text-muted-foreground tabular">{job.stage}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
      <div className="h-full origin-left rounded-full bg-brand" style={{ transform: `scaleX(${Math.max(0.02, job.progress)})` }} />
    </div>
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">You can keep editing. Changes made now won't be in this export.</p>
      <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
        Cancel
      </Button>
    </div>
  </div>
);

export const ExportDialog: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void }> = ({ open, onOpenChange }) => {
  const settings = useProjectStore((s) => s.project?.settings);
  const durationFrames = useProjectStore((s) => (s.project ? getProjectDuration(s.project) : 0));
  const inFrame = usePlaybackStore((s) => s.inFrame);
  const outFrame = usePlaybackStore((s) => s.outFrame);
  const job = useRenderStore((s) => s.job);
  const [format, setFormat] = useState<Format>("mp4");
  const [scale, setScale] = useState(1);
  const [quality, setQuality] = useState<Quality>("high");
  const [useRange, setUseRange] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasRange = inFrame !== null && outFrame !== null && outFrame > inFrame;

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  if (!settings) return null;
  const fps = settings.fps;
  const dims = (s: number) => `${Math.round((settings.width * s) / 2) * 2}×${Math.round((settings.height * s) / 2) * 2}`;
  const frames = useRange && hasRange ? (outFrame as number) - (inFrame as number) : durationFrames;

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: getProject(),
          format,
          quality,
          scale,
          range: useRange && hasRange ? [inFrame, (outFrame as number) - 1] : undefined,
        }),
      });
      const data = (await res.json()) as { job?: RenderJob; error?: string };
      if (!res.ok || !data.job) throw new Error(data.error ?? "Couldn't start the export");
      useRenderStore.getState().setJob(data.job);
      useRenderStore.getState().watch(data.job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const cancel = async () => {
    if (!job) return;
    await fetch(`/api/render?jobId=${encodeURIComponent(job.id)}`, { method: "DELETE" });
    useRenderStore.getState().watch(job.id);
  };

  const active = isActive(job);
  const done = job?.status === "done";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export video</DialogTitle>
          <DialogDescription className="text-xs tabular">
            {formatSeconds(frames, fps)} · {dims(scale)} · {fps} fps · rendered on this computer
          </DialogDescription>
        </DialogHeader>

        {active && job ? (
          <Progress job={job} onCancel={() => void cancel()} />
        ) : done && job ? (
          <div className="space-y-3 py-1">
            <div className="flex items-start gap-2.5 rounded-md border border-border bg-foreground/[0.02] p-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400">
                <CheckIcon className="size-3.5" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">Your video is ready</p>
                <p className="truncate text-xs text-muted-foreground" title={job.outputPath}>
                  {job.fileName} · {formatBytes(job.sizeBytes)}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => useRenderStore.getState().setJob(null)}>
                Export again
              </Button>
              <Button size="sm" asChild className="gap-1.5">
                <a href={`/api/render/file?jobId=${encodeURIComponent(job.id)}`} download={job.fileName}>
                  <DownloadIcon /> Download
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Segmented label="Format" value={format} options={FORMATS.map((f) => ({ id: f.id, label: f.label }))} onChange={setFormat} />
            <p className="-mt-2 text-xs text-muted-foreground">{FORMATS.find((f) => f.id === format)?.hint}</p>
            <Segmented
              label="Resolution"
              value={scale}
              options={[
                { id: 0.5, label: dims(0.5) },
                { id: 1, label: dims(1) },
                { id: 2, label: dims(2), disabled: format === "gif" },
              ]}
              onChange={setScale}
            />
            {format === "mp4" || format === "webm" ? (
              <Segmented
                label="Quality"
                value={quality}
                options={[
                  { id: "standard" as const, label: "Standard" },
                  { id: "high" as const, label: "High" },
                  { id: "max" as const, label: "Maximum" },
                ]}
                onChange={setQuality}
              />
            ) : null}
            <Segmented
              label="Range"
              value={useRange && hasRange ? "range" : "all"}
              options={[
                { id: "all", label: "Whole video" },
                {
                  id: "range",
                  label: hasRange ? `In–out (${formatSeconds((outFrame as number) - (inFrame as number), fps)})` : "In–out (set I / O)",
                  disabled: !hasRange,
                },
              ]}
              onChange={(v) => setUseRange(v === "range")}
            />
            {job?.status === "error" || error ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
                <span className="min-w-0 break-words">{error ?? job?.error}</span>
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button onClick={() => void start()} disabled={starting || durationFrames === 0} className="gap-1.5 px-4">
                {starting ? <LoaderCircleIcon className="animate-spin" /> : null}
                Export
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
