"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  AudioLinesIcon,
  EyeIcon,
  EyeOffIcon,
  LayersIcon,
  LockIcon,
  MagnetIcon,
  PencilIcon,
  Trash2Icon,
  UnlockIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { useState } from "react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { moveTrack, removeTrack, USER, updateTrack } from "@/core/ops";
import type { Track } from "@/core/schema";
import { cn } from "@/lib/utils";
import { closeTrackGaps, run } from "../../actions";
import { getProject } from "../../store/project-store";
import { useUIStore } from "../../store/ui-store";
import { HEADER_WIDTH, Z } from "./geometry";

const Toggle: React.FC<{
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, pressed, onClick, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "flex size-6 items-center justify-center rounded-md text-muted-foreground/70 outline-none transition-colors duration-150 hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-3.5",
          pressed && "text-foreground",
        )}
      >
        {children}
      </button>
    </TooltipTrigger>
    <TooltipContent side="top">{label}</TooltipContent>
  </Tooltip>
);

export const TrackHeader: React.FC<{
  track: Track;
  height: number;
  selected: boolean;
}> = ({ track, height, selected }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(track.name);
  const Icon = track.kind === "audio" ? AudioLinesIcon : LayersIcon;
  const toggle = (patch: Partial<Track>, label: string) => run(label, (d) => updateTrack(d, track.id, patch));
  const tracks = getProject().tracks;
  const index = tracks.findIndex((t) => t.id === track.id);
  const startRename = () => {
    setName(track.name);
    setEditing(true);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group/track sticky left-0 flex shrink-0 items-center gap-1.5 border-r border-border bg-(--hdr) pr-2 pl-2.5 [--hdr:var(--panel)]",
            selected && "[--hdr:var(--panel-2)]",
          )}
          style={{ width: HEADER_WIDTH, height, zIndex: Z.header }}
          onPointerDown={() => useUIStore.getState().selectTrack(track.id)}
        >
          {selected ? <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-brand" aria-hidden /> : null}
          <Icon
            className="size-3.5 shrink-0"
            style={{
              color: track.kind === "audio" ? "var(--clip-audio)" : "var(--clip-video)",
            }}
          />
          {editing ? (
            <input
              // biome-ignore lint/a11y/noAutofocus: inline rename
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => {
                setEditing(false);
                if (name.trim() && name !== track.name) run("Rename track", (d) => updateTrack(d, track.id, { name: name.trim() }));
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setName(track.name);
                  setEditing(false);
                }
              }}
              aria-label="Track name"
              className="h-6 min-w-0 flex-1 rounded-sm bg-background px-1 text-xs outline-none ring-1 ring-ring"
            />
          ) : (
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-xs font-medium",
                track.hidden || track.muted ? "text-muted-foreground" : "text-foreground/90",
              )}
              onDoubleClick={startRename}
              title={track.name}
            >
              {track.name}
              {track.magnetic ? (
                <MagnetIcon className="ml-1 inline size-3 align-[-2px] text-muted-foreground" aria-label="Magnetic" />
              ) : null}
            </span>
          )}
          {track.hidden || track.muted || track.locked ? (
            <span className="flex shrink-0 items-center gap-1 text-muted-foreground group-focus-within/track:opacity-0 group-hover/track:opacity-0 [&_svg]:size-3">
              {track.hidden ? <EyeOffIcon aria-label="Hidden" /> : null}
              {track.muted ? <VolumeXIcon aria-label="Muted" /> : null}
              {track.locked ? <LockIcon aria-label="Locked" /> : null}
            </span>
          ) : null}
          {/* Toggles appear on hover so names keep their room at rest. */}
          <div className="absolute inset-y-0 right-0 flex items-center bg-[linear-gradient(to_left,var(--hdr)_78%,transparent)] pr-1 pl-6 opacity-0 transition-opacity duration-100 group-focus-within/track:opacity-100 group-hover/track:opacity-100">
            {track.kind === "visual" ? (
              <Toggle
                label={track.hidden ? "Show track" : "Hide track"}
                pressed={!!track.hidden}
                onClick={() => toggle({ hidden: !track.hidden }, track.hidden ? "Show track" : "Hide track")}
              >
                {track.hidden ? <EyeOffIcon /> : <EyeIcon />}
              </Toggle>
            ) : null}
            <Toggle
              label={track.muted ? "Unmute" : "Mute"}
              pressed={!!track.muted}
              onClick={() => toggle({ muted: !track.muted }, track.muted ? "Unmute track" : "Mute track")}
            >
              {track.muted ? <VolumeXIcon /> : <Volume2Icon />}
            </Toggle>
            <Toggle
              label={track.locked ? "Unlock" : "Lock"}
              pressed={!!track.locked}
              onClick={() => toggle({ locked: !track.locked }, track.locked ? "Unlock track" : "Lock track")}
            >
              {track.locked ? <LockIcon /> : <UnlockIcon />}
            </Toggle>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={startRename}>
          <PencilIcon /> Rename
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => toggle({ magnetic: !track.magnetic }, track.magnetic ? "Disable magnetic track" : "Enable magnetic track")}
        >
          <MagnetIcon /> {track.magnetic ? "Disable magnetic" : "Make magnetic"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => closeTrackGaps(track.id)}>Close gaps</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={index <= 0} onClick={() => run("Move track up", (d) => moveTrack(d, track.id, index - 1))}>
          <ArrowUpIcon /> Move up
        </ContextMenuItem>
        <ContextMenuItem
          disabled={index >= tracks.length - 1}
          onClick={() => run("Move track down", (d) => moveTrack(d, track.id, index + 1))}
        >
          <ArrowDownIcon /> Move down
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => run("Delete track", (d) => removeTrack(d, track.id, { actor: USER }))}>
          <Trash2Icon /> Delete track
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
