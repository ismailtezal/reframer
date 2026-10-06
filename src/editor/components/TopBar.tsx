"use client";

import {
  ChevronLeftIcon,
  CommandIcon,
  KeyboardIcon,
  MonitorIcon,
  MoonIcon,
  MoreHorizontalIcon,
  PlugZapIcon,
  Redo2Icon,
  SettingsIcon,
  SunIcon,
  Undo2Icon,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { redo, run, undo } from "../actions";
import { useAgentStore } from "../store/agent-store";
import { useProjectStore } from "../store/project-store";
import { isActive, useRenderStore } from "../store/render-store";

/** Monochrome mark: a frame being re-framed, with a play glyph. Inherits the text color. */
export const Logo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden>
    <rect x="3" y="6" width="20" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="2.5" />
    <path d="M14 3h9a6 6 0 0 1 6 6v9" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M10.5 12.5v7l6-3.5z" fill="currentColor" />
  </svg>
);

const IconButton: React.FC<{
  label: string;
  kbd?: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ label, kbd, onClick, disabled, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled} aria-label={label}>
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {label}
      {kbd ? <Kbd>{kbd}</Kbd> : null}
    </TooltipContent>
  </Tooltip>
);

const SaveState = () => {
  const state = useProjectStore((s) => s.saveState);
  const label = state === "error" ? "Not saved" : state === "saving" || state === "dirty" ? "Saving…" : "Saved";
  return (
    <span
      className={cn("text-xs text-muted-foreground/80 tabular", state === "error" && "text-destructive")}
      title={state === "error" ? "Couldn't write to disk. Your changes are kept in memory." : "Projects are saved on this computer"}
    >
      {label}
    </span>
  );
};

const ProjectName = () => {
  const name = useProjectStore((s) => s.project?.name ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (editing) {
    return (
      <input
        // biome-ignore lint/a11y/noAutofocus: rename field
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() && draft !== name) {
            run("Rename project", (d) => {
              d.name = draft.trim();
            });
          }
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        aria-label="Project name"
        className="h-7 w-56 rounded-md bg-background px-2 text-sm font-medium outline-none ring-1 ring-ring"
      />
    );
  }
  return (
    <button
      type="button"
      className="h-7 max-w-[32ch] truncate rounded-md px-2 text-sm font-medium transition-colors duration-150 hover:bg-foreground/[0.06]"
      onClick={() => {
        setDraft(name);
        setEditing(true);
      }}
      title="Rename project"
    >
      {name}
    </button>
  );
};

const AgentConnection: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const connected = useAgentStore((s) => s.connected);
  const live = Object.entries(connected).filter(([, at]) => Date.now() - at < 30_000);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" onClick={onClick} className="gap-1.5 px-2 text-muted-foreground">
          {live.length ? (
            <span className="relative flex size-2 items-center justify-center" aria-hidden>
              <span className="size-1.5 rounded-full bg-emerald-400" />
            </span>
          ) : (
            <PlugZapIcon />
          )}
          <span className={cn("text-xs", live.length && "text-foreground")}>
            {live.length ? live.map(([n]) => n).join(", ") : "Connect agent"}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Drive this editor from Claude Code, Codex or Cursor over MCP</TooltipContent>
    </Tooltip>
  );
};

/** Primary action. Shows progress while an export renders in the background. */
const ExportButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const job = useRenderStore((s) => s.job);
  const projectId = useProjectStore((s) => s.project?.id);
  const active = isActive(job) && job?.status !== "queued";
  // Picks up exports that are still running after a reload.
  useEffect(() => {
    if (projectId) useRenderStore.getState().watch(projectId);
  }, [projectId]);
  return (
    <Button onClick={onClick} className="relative ml-1.5 min-w-[76px] overflow-hidden px-3.5 tabular">
      {active && job ? (
        <>
          <span
            className="absolute inset-y-0 left-0 w-full origin-left bg-brand-foreground/15"
            style={{ transform: `scaleX(${job.progress})` }}
            aria-hidden
          />
          <span className="relative">{Math.round(job.progress * 100)}%</span>
        </>
      ) : (
        "Export"
      )}
    </Button>
  );
};

export const TopBar: React.FC<{
  onExport: () => void;
  onSettings: () => void;
  onConnectAgent: () => void;
  onShortcuts: () => void;
  onCommandPalette: () => void;
}> = ({ onExport, onSettings, onConnectAgent, onShortcuts, onCommandPalette }) => {
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex h-11 shrink-0 items-center gap-1 border-b border-border bg-panel pr-2 pl-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/" aria-label="All projects">
              <ChevronLeftIcon />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>All projects</TooltipContent>
      </Tooltip>
      <ProjectName />
      <SaveState />
      <Separator orientation="vertical" className="mx-1.5 h-4 self-center" />
      <IconButton label="Undo" kbd="Ctrl Z" onClick={undo} disabled={!canUndo}>
        <Undo2Icon />
      </IconButton>
      <IconButton label="Redo" kbd="Ctrl Shift Z" onClick={redo} disabled={!canRedo}>
        <Redo2Icon />
      </IconButton>

      <div className="flex-1" />

      <AgentConnection onClick={onConnectAgent} />
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>More</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onCommandPalette}>
            <CommandIcon /> Command palette <DropdownMenuShortcut>Ctrl K</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onShortcuts}>
            <KeyboardIcon /> Keyboard shortcuts <DropdownMenuShortcut>?</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "dark"} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="dark">
              <MoonIcon /> Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="light">
              <SunIcon /> Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <MonitorIcon /> System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton label="Settings" onClick={onSettings}>
        <SettingsIcon />
      </IconButton>
      <ExportButton onClick={onExport} />
    </header>
  );
};
