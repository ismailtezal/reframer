"use client";

import {
  CheckIcon,
  CpuIcon,
  DownloadIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  PlusIcon,
  TriangleAlertIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AUDIO_CODEC_LABEL,
  AUDIO_CODECS_FOR_FORMAT,
  BUILTIN_PRESETS,
  CODEC_LABEL,
  CODECS_FOR_FORMAT,
  type ExportFormat,
  type ExportPreset,
  type ExportSettings,
  estimateBytes,
  FORMAT_LABEL,
  isAudioOnly,
  normalizeExportSettings,
  outputSize,
  PRORES_LABEL,
  resolutionOptions,
  supportsCrf,
  supportsHardware,
} from "@/core/export";
import { getProjectDuration } from "@/core/project-utils";
import { formatSeconds } from "@/core/time";
import { cn } from "@/lib/utils";
import { usePlaybackStore } from "../../store/playback-store";
import { getProject, useProjectStore } from "../../store/project-store";
import { isActive, type RenderJob, useRenderStore } from "../../store/render-store";
import { FieldRow, SelectField, SliderField, SwitchField } from "../inspector/fields";
import { loadCustomPresets, loadLastExport, saveCustomPresets, saveLastExport } from "./export-presets";

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
  <div className="flex min-w-0 flex-1 gap-0.5 rounded-md bg-foreground/[0.04] p-0.5" role="radiogroup" aria-label={label}>
    {options.map((o) => (
      <button
        key={String(o.id)}
        type="button"
        role="radio"
        aria-checked={value === o.id}
        disabled={o.disabled}
        onClick={() => onChange(o.id)}
        className={cn(
          "h-6 min-w-0 flex-1 truncate rounded-[5px] px-1.5 text-[11px] font-medium text-muted-foreground tabular transition-colors duration-150 hover:text-foreground disabled:opacity-40",
          value === o.id && "bg-raised text-foreground shadow-sm",
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const formatBytes = (n?: number | null) =>
  !n ? "" : n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;

const formatClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
};

/** "ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 (0x…) Direct3D11 …)" → "NVIDIA GeForce RTX 5060". */
const gpuName = (renderer: string | null | undefined) => {
  if (!renderer) return null;
  const m = /ANGLE \([^,]+,\s*(.+?)\s*(?:\(0x[0-9a-f]+\))?\s*(?:Direct3D|OpenGL|Vulkan|Metal|,)/i.exec(renderer);
  return (m?.[1] ?? renderer).trim();
};

const CRF_LABELS: [number, string][] = [
  [12, "Visually lossless"],
  [17, "Very high"],
  [21, "High"],
  [25, "Good"],
  [30, "Draft"],
  [99, "Low"],
];
const crfLabel = (crf: number, codec: ExportSettings["videoCodec"]) => {
  const scaled = codec === "vp9" ? crf * (51 / 63) : crf;
  return CRF_LABELS.find(([max]) => scaled <= max)?.[1] ?? "Low";
};

/** Inspector-style row with room for longer labels. */
const Row: React.FC<React.ComponentProps<typeof FieldRow>> = ({ className, ...props }) => (
  <FieldRow className={cn("grid-cols-[124px_1fr] py-1", className)} {...props} />
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase first:pt-0">{children}</div>
);

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

const StatusIcon: React.FC<{ job: RenderJob }> = ({ job }) => {
  if (job.status === "done")
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400">
        <CheckIcon className="size-3.5" />
      </span>
    );
  if (job.status === "error")
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <TriangleAlertIcon className="size-3" />
      </span>
    );
  if (job.status === "cancelled")
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-muted-foreground">
        <XIcon className="size-3" />
      </span>
    );
  return <LoaderCircleIcon className={cn("size-5 shrink-0 text-brand", job.status !== "queued" && "animate-spin")} />;
};

const JobRow: React.FC<{ job: RenderJob; onCancel: () => void }> = ({ job, onCancel }) => {
  const active = isActive(job);
  const desktop =
    typeof window !== "undefined"
      ? (window as unknown as { reframerDesktop?: { showItemInFolder?: (p: string) => void } }).reframerDesktop
      : undefined;
  const detail =
    job.status === "rendering"
      ? [job.stage, job.fps ? `${job.fps.toFixed(0)} fps` : null, job.etaSec !== undefined ? `${formatClock(job.etaSec)} left` : null]
          .filter(Boolean)
          .join(" · ")
      : job.status === "done"
        ? [
            job.elapsedSec !== undefined ? `Done in ${formatClock(job.elapsedSec)}` : "Done",
            job.realtimeFactor ? `${job.realtimeFactor.toFixed(2)}× realtime` : null,
            formatBytes(job.sizeBytes),
          ]
            .filter(Boolean)
            .join(" · ")
        : job.status === "error"
          ? (job.error ?? "Failed")
          : job.stage;
  const engine = job.engine
    ? [
        job.engine.processes > 1
          ? `${job.engine.processes} render processes × ${job.engine.tabs} tabs`
          : job.engine.processes === 1
            ? "1 render process"
            : null,
        job.engine.encoder !== "—" ? job.engine.encoder : null,
        gpuName(job.engine.gpu) ? `GPU: ${gpuName(job.engine.gpu)}` : job.engine.processes ? "CPU graphics" : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="rounded-lg border border-border bg-foreground/[0.015] p-3">
      <div className="flex items-start gap-2.5">
        <StatusIcon job={job} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-medium" title={job.outputPath}>
              {job.fileName}
            </p>
            {active && job.status !== "queued" ? (
              <span className="shrink-0 text-sm font-semibold tabular">{Math.round(job.progress * 100)}%</span>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground" title={job.summary}>
            {job.presetName ? `${job.presetName} · ` : ""}
            {job.summary}
          </p>
        </div>
      </div>
      {active ? (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-foreground/[0.08]">
          <div
            className="h-full origin-left rounded-full bg-brand transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${job.status === "queued" ? 0 : Math.max(0.01, job.progress)})` }}
          />
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className={cn("text-xs tabular", job.status === "error" ? "break-words text-destructive" : "text-muted-foreground")}>
            {detail}
          </p>
          {engine && job.status !== "queued" ? <p className="truncate text-[11px] text-muted-foreground/70">{engine}</p> : null}
          {job.status === "done" && job.error ? <p className="text-[11px] text-amber-400">{job.error}</p> : null}
        </div>
        <div className="flex shrink-0 gap-1">
          {active ? (
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
              Cancel
            </Button>
          ) : null}
          {job.status === "done" && desktop?.showItemInFolder ? (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => desktop.showItemInFolder?.(job.outputPath)}>
              <FolderOpenIcon /> Show
            </Button>
          ) : null}
          {job.status === "done" ? (
            <Button size="sm" variant="secondary" asChild className="gap-1.5">
              <a href={`/api/render/file?jobId=${encodeURIComponent(job.id)}`} download={job.fileName}>
                <DownloadIcon /> Download
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

export const ExportDialog: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void }> = ({ open, onOpenChange }) => {
  const projectSettings = useProjectStore((s) => s.project?.settings);
  const projectId = useProjectStore((s) => s.project?.id);
  const durationFrames = useProjectStore((s) => (s.project ? getProjectDuration(s.project) : 0));
  const inFrame = usePlaybackStore((s) => s.inFrame);
  const outFrame = usePlaybackStore((s) => s.outFrame);
  const jobs = useRenderStore((s) => s.jobs);
  const caps = useRenderStore((s) => s.caps);
  const [tab, setTab] = useState<"settings" | "queue">("settings");
  const [presetId, setPresetId] = useState(BUILTIN_PRESETS[0].id);
  const [modified, setModified] = useState(false);
  const [settings, setSettings] = useState<ExportSettings>(BUILTIN_PRESETS[0].settings);
  const [custom, setCustom] = useState<ExportPreset[]>([]);
  const [useRange, setUseRange] = useState(false);
  const [naming, setNaming] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasRange = inFrame !== null && outFrame !== null && outFrame > inFrame;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCustom(loadCustomPresets());
    const last = loadLastExport();
    setSettings(last.settings);
    setPresetId(last.presetId);
    setModified(false);
    useRenderStore.getState().loadCaps();
    if (projectId) useRenderStore.getState().watch(projectId);
  }, [open, projectId]);

  const presets = useMemo(() => [...BUILTIN_PRESETS, ...custom], [custom]);
  const groups = useMemo(() => {
    const out = new Map<string, ExportPreset[]>();
    for (const p of presets) out.set(p.group, [...(out.get(p.group) ?? []), p]);
    return [...out.entries()];
  }, [presets]);

  if (!projectSettings) return null;
  const fps = projectSettings.fps;
  const frames = useRange && hasRange ? (outFrame as number) - (inFrame as number) : durationFrames;
  const seconds = frames / fps;
  const size = outputSize(projectSettings, settings.resolution);
  const audioOnly = isAudioOnly(settings.format);
  const estimate = estimateBytes(settings, size, fps, seconds);
  const preset = presets.find((p) => p.id === presetId);
  const activeCount = jobs.filter(isActive).length;
  const hwAvailable = caps ? caps.nvenc[settings.videoCodec === "h265" ? "h265" : "h264"] : null;

  const change = (patch: Partial<ExportSettings>) => {
    setSettings((s) => normalizeExportSettings({ ...s, ...patch }));
    setModified(true);
  };

  const pick = (p: ExportPreset) => {
    setPresetId(p.id);
    setSettings(p.settings);
    setModified(false);
  };

  const savePreset = () => {
    const name = naming?.trim();
    if (!name) return;
    const p: ExportPreset = { id: `custom-${Date.now().toString(36)}`, name, group: "Custom", description: "Saved preset", settings };
    const next = [...custom, p];
    setCustom(next);
    saveCustomPresets(next);
    setPresetId(p.id);
    setModified(false);
    setNaming(null);
  };

  const deletePreset = (id: string) => {
    const next = custom.filter((p) => p.id !== id);
    setCustom(next);
    saveCustomPresets(next);
    if (presetId === id) pick(BUILTIN_PRESETS[0]);
  };

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: getProject(),
          settings,
          presetName: preset ? `${preset.name}${modified ? " (modified)" : ""}` : "Custom",
          range: useRange && hasRange ? [inFrame, (outFrame as number) - 1] : undefined,
        }),
      });
      const data = (await res.json()) as { job?: RenderJob; error?: string };
      if (!res.ok || !data.job) throw new Error(data.error ?? "Couldn't start the export");
      saveLastExport(presetId, settings);
      useRenderStore.getState().add(data.job);
      useRenderStore.getState().watch(data.job.projectId);
      setTab("queue");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const cancel = async (job: RenderJob) => {
    await fetch(`/api/render?jobId=${encodeURIComponent(job.id)}`, { method: "DELETE" });
    useRenderStore.getState().watch(job.projectId);
  };

  const clearFinished = async () => {
    if (!projectId) return;
    await fetch(`/api/render?clear=1&projectId=${encodeURIComponent(projectId)}`, { method: "DELETE" });
    useRenderStore.getState().watch(projectId);
  };

  const codecs = CODECS_FOR_FORMAT[settings.format];
  const audioCodecs = AUDIO_CODECS_FOR_FORMAT[settings.format];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(660px,calc(100vh-2rem))] gap-0 overflow-hidden p-0 sm:max-w-[880px]">
        {/* Presets */}
        <aside className="hidden w-[232px] shrink-0 flex-col border-r border-border bg-foreground/[0.015] sm:flex">
          <div className="px-4 pt-4 pb-2 text-xs font-medium text-muted-foreground">Presets</div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-3">
            {groups.map(([group, list]) => (
              <div key={group}>
                <div className="px-2 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">{group}</div>
                {list.map((p) => (
                  <div key={p.id} className="group/preset relative">
                    <button
                      type="button"
                      onClick={() => pick(p)}
                      title={p.description}
                      className={cn(
                        "flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-foreground/[0.05]",
                        presetId === p.id && "bg-foreground/[0.07]",
                      )}
                    >
                      <span className="flex w-full items-center gap-1.5 text-xs font-medium">
                        <span className="truncate">{p.name}</span>
                        {presetId === p.id && modified ? (
                          <span className="text-[10px] font-normal text-muted-foreground">· edited</span>
                        ) : null}
                      </span>
                      {presetId === p.id ? (
                        <span className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{p.description}</span>
                      ) : null}
                    </button>
                    {p.group === "Custom" ? (
                      <button
                        type="button"
                        aria-label={`Delete preset ${p.name}`}
                        onClick={() => deletePreset(p.id)}
                        className="absolute top-1.5 right-1.5 hidden size-5 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground group-hover/preset:flex"
                      >
                        <XIcon className="size-3" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-border px-5 py-3 pr-12">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base">Export</DialogTitle>
              <DialogDescription className="truncate text-xs tabular">
                {formatSeconds(frames, fps)} · {fps} fps · rendered on this computer
              </DialogDescription>
            </div>
            <div className="flex gap-0.5 rounded-md bg-foreground/[0.04] p-0.5" role="tablist">
              {(["settings", "queue"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "h-7 rounded-[5px] px-3 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground",
                    tab === t && "bg-raised text-foreground shadow-sm",
                  )}
                >
                  {t === "settings" ? "Settings" : `Queue${activeCount ? ` (${activeCount})` : ""}`}
                </button>
              ))}
            </div>
          </header>

          {tab === "settings" ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {/* Small screens: presets as a list */}
                <div className="pb-2 sm:hidden">
                  <Row label="Preset">
                    <SelectField
                      value={presetId}
                      onChange={(id) => {
                        const p = presets.find((x) => x.id === id);
                        if (p) pick(p);
                      }}
                      options={presets.map((p) => ({ value: p.id, label: p.name }))}
                    />
                  </Row>
                </div>

                <SectionTitle>Format</SectionTitle>
                <Row label="Container">
                  <SelectField
                    value={settings.format}
                    onChange={(v) => change({ format: v as ExportFormat })}
                    options={(Object.keys(FORMAT_LABEL) as ExportFormat[]).map((f) => ({ value: f, label: FORMAT_LABEL[f] }))}
                  />
                </Row>
                {codecs.length > 1 ? (
                  <Row label="Video codec">
                    <SelectField
                      value={settings.videoCodec}
                      onChange={(v) => change({ videoCodec: v as ExportSettings["videoCodec"] })}
                      options={codecs.map((c) => ({ value: c, label: CODEC_LABEL[c] }))}
                    />
                  </Row>
                ) : null}
                {settings.videoCodec === "prores" && !audioOnly ? (
                  <Row label="Profile">
                    <SelectField
                      value={settings.proresProfile}
                      onChange={(v) => change({ proresProfile: v as ExportSettings["proresProfile"] })}
                      options={(Object.keys(PRORES_LABEL) as ExportSettings["proresProfile"][]).map((p) => ({
                        value: p,
                        label: PRORES_LABEL[p],
                      }))}
                    />
                  </Row>
                ) : null}

                {!audioOnly ? (
                  <>
                    <SectionTitle>Video</SectionTitle>
                    <Row label="Resolution">
                      <SelectField
                        value={String(settings.resolution)}
                        onChange={(v) => change({ resolution: v === "project" ? "project" : Number(v) })}
                        options={resolutionOptions(projectSettings).map((o) => ({
                          value: String(o.id),
                          label: o.id === "project" ? `${o.label} (project)` : o.label,
                        }))}
                      />
                    </Row>
                    {supportsCrf(settings.videoCodec) ? (
                      <>
                        <Row label="Bitrate mode">
                          <Segmented
                            label="Bitrate mode"
                            value={settings.rateControl}
                            options={[
                              { id: "quality", label: "Constant quality" },
                              { id: "bitrate", label: "Target bitrate" },
                            ]}
                            onChange={(v) => change({ rateControl: v })}
                          />
                        </Row>
                        {settings.rateControl === "quality" ? (
                          <Row label="Quality" hint="Constant rate factor: lower numbers are higher quality and bigger files">
                            <SliderField
                              value={(settings.videoCodec === "vp9" ? 63 : 51) - settings.crf}
                              min={settings.videoCodec === "vp9" ? 18 : 12}
                              max={settings.videoCodec === "vp9" ? 58 : 43}
                              step={1}
                              onChange={(v) => change({ crf: (settings.videoCodec === "vp9" ? 63 : 51) - v })}
                              format={() => `CRF ${settings.crf}`}
                            />
                            <span className="w-24 shrink-0 text-right text-[11px] text-muted-foreground">
                              {crfLabel(settings.crf, settings.videoCodec)}
                            </span>
                          </Row>
                        ) : (
                          <Row label="Bitrate">
                            <SliderField
                              value={settings.bitrateMbps}
                              min={1}
                              max={120}
                              step={1}
                              onChange={(v) => change({ bitrateMbps: v })}
                              format={(v) => `${v} Mbps`}
                            />
                          </Row>
                        )}
                        <Row label="Encoder speed" hint="Slower settings make smaller files at the same quality">
                          <Segmented
                            label="Encoder speed"
                            value={settings.speed}
                            options={[
                              { id: "fastest", label: "Fastest" },
                              { id: "fast", label: "Fast" },
                              { id: "balanced", label: "Balanced" },
                              { id: "smallest", label: "Smallest" },
                            ]}
                            onChange={(v) => change({ speed: v })}
                          />
                        </Row>
                      </>
                    ) : null}
                    {supportsHardware(settings.videoCodec) ? (
                      <Row label="Hardware encoding">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <Segmented
                            label="Hardware encoding"
                            value={settings.hardware}
                            options={[
                              { id: "auto", label: "Auto" },
                              { id: "on", label: "GPU (NVENC)", disabled: hwAvailable === false },
                              { id: "off", label: "CPU" },
                            ]}
                            onChange={(v) => change({ hardware: v })}
                          />
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            {hwAvailable ? <ZapIcon className="size-3 text-brand" /> : <CpuIcon className="size-3" />}
                            {hwAvailable === null
                              ? "Checking for a hardware encoder…"
                              : hwAvailable
                                ? settings.hardware === "off"
                                  ? "NVIDIA encoder available. CPU encoding makes smaller files but is slower."
                                  : "Encodes on the NVIDIA GPU: faster, slightly larger files."
                                : "No NVIDIA GPU found, so the CPU encoder is used."}
                          </span>
                        </div>
                      </Row>
                    ) : null}
                  </>
                ) : null}

                {settings.format !== "gif" ? (
                  <>
                    <SectionTitle>Audio</SectionTitle>
                    {!audioOnly ? (
                      <Row label="Include audio">
                        <SwitchField value={settings.includeAudio} onChange={(v) => change({ includeAudio: v })} />
                      </Row>
                    ) : null}
                    {settings.includeAudio ? (
                      <>
                        {audioCodecs.length > 1 ? (
                          <Row label="Audio codec">
                            <SelectField
                              value={settings.audioCodec}
                              onChange={(v) => change({ audioCodec: v as ExportSettings["audioCodec"] })}
                              options={audioCodecs.map((c) => ({ value: c, label: AUDIO_CODEC_LABEL[c] }))}
                            />
                          </Row>
                        ) : null}
                        {settings.audioCodec !== "pcm" ? (
                          <Row label="Audio bitrate">
                            <SelectField
                              value={String(settings.audioBitrateK)}
                              onChange={(v) => change({ audioBitrateK: Number(v) })}
                              options={[96, 128, 160, 192, 256, 320, 384]
                                .filter((k) => settings.audioCodec !== "mp3" || k <= 320)
                                .map((k) => ({ value: String(k), label: `${k} kbps` }))}
                            />
                          </Row>
                        ) : (
                          <Row label="Audio">
                            <span className="text-xs text-muted-foreground">16-bit PCM, 48 kHz stereo</span>
                          </Row>
                        )}
                      </>
                    ) : null}
                  </>
                ) : null}

                <SectionTitle>Range</SectionTitle>
                <Row label="Export">
                  <Segmented
                    label="Range"
                    value={useRange && hasRange ? "range" : "all"}
                    options={[
                      { id: "all", label: "Whole video" },
                      {
                        id: "range",
                        label: hasRange
                          ? `In–out (${formatSeconds((outFrame as number) - (inFrame as number), fps)})`
                          : "In–out (set I / O)",
                        disabled: !hasRange,
                      },
                    ]}
                    onChange={(v) => setUseRange(v === "range")}
                  />
                </Row>

                {!audioOnly ? (
                  <>
                    <SectionTitle>Performance</SectionTitle>
                    <Row label="GPU graphics" hint="Draw effects and compositing on the graphics card">
                      <Segmented
                        label="GPU graphics"
                        value={settings.gpu}
                        options={[
                          { id: "auto", label: "Auto" },
                          { id: "off", label: "Off (software)" },
                        ]}
                        onChange={(v) => change({ gpu: v })}
                      />
                    </Row>
                    <Row label="Render processes" hint="Chrome instances rendering in parallel">
                      <SelectField
                        value={String(settings.parallelism)}
                        onChange={(v) => change({ parallelism: v === "auto" ? "auto" : Number(v) })}
                        options={[
                          { value: "auto", label: caps ? `Auto (sized for ${caps.cores} threads, ${caps.memoryGB} GB)` : "Auto" },
                          ...[1, 2, 3, 4, 5, 6, 8].map((n) => ({ value: String(n), label: String(n) })),
                        ]}
                      />
                    </Row>
                  </>
                ) : null}

                {error ? (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                    <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
                    <span className="min-w-0 break-words">{error}</span>
                  </div>
                ) : null}
              </div>

              <footer className="flex items-center gap-2 border-t border-border px-5 py-3">
                <div className="min-w-0 flex-1 text-xs text-muted-foreground tabular">
                  {audioOnly ? "Audio only" : `${size.width}×${size.height}`}
                  {estimate ? ` · about ${formatBytes(estimate)}` : ""}
                </div>
                {naming !== null ? (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      savePreset();
                    }}
                  >
                    <input
                      autoFocus
                      value={naming}
                      onChange={(e) => setNaming(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Escape") return;
                        e.stopPropagation();
                        setNaming(null);
                      }}
                      placeholder="Preset name"
                      className="h-8 w-40 rounded-md border border-input bg-background/40 px-2 text-xs outline-none focus:border-ring"
                    />
                    <Button type="submit" size="sm" variant="secondary" disabled={!naming.trim()}>
                      Save
                    </Button>
                  </form>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => setNaming(preset && modified ? `${preset.name} (custom)` : "")}
                  >
                    <PlusIcon /> Save preset
                  </Button>
                )}
                <Button onClick={() => void start()} disabled={starting || durationFrames === 0} className="gap-1.5 px-4">
                  {starting ? <LoaderCircleIcon className="animate-spin" /> : null}
                  {activeCount ? "Add to queue" : "Export"}
                </Button>
              </footer>
            </>
          ) : (
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {jobs.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No exports yet. Pick a preset and press Export.</p>
              ) : (
                <>
                  {jobs.map((j) => (
                    <JobRow key={j.id} job={j} onCancel={() => void cancel(j)} />
                  ))}
                  {jobs.some((j) => !isActive(j)) ? (
                    <div className="flex justify-end pt-1">
                      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void clearFinished()}>
                        Clear finished
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </main>
      </DialogContent>
    </Dialog>
  );
};
