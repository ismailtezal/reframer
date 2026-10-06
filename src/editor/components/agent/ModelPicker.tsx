"use client";

import { CheckIcon, ChevronDownIcon, CpuIcon, KeyRoundIcon, TerminalIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type ModelOption, useModels } from "./models";

const cliName = (m: ModelOption) => m.providerName.replace(/\s*\(your login\)/, "");

/** "Claude Code · Opus 5.5" for local agents, the model name otherwise. */
const shortName = (m: ModelOption) => (m.kind === "harness" ? `${cliName(m)} · ${m.id === "default" ? "Default" : m.name}` : m.name);

/** Compact model switcher for the agent composer. */
export const ModelPicker: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
  const { models, selected, select, loaded } = useModels();
  const [open, setOpen] = useState(false);
  const current = models.find((m) => m.ref === selected);

  const groups = new Map<string, ModelOption[]>();
  for (const m of models) groups.set(m.providerName, [...(groups.get(m.providerName) ?? []), m]);
  // Your local agents (Claude Code / Codex logins) first, then providers in catalog order.
  const isLocal = (group: string) => models.some((m) => m.providerName === group && m.kind === "harness");
  const ordered = [...groups.entries()].sort(([a], [b]) => Number(isLocal(b)) - Number(isLocal(a)));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 max-w-[60%] gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Choose model"
        >
          {current?.kind === "harness" ? <TerminalIcon className="size-3.5" /> : <CpuIcon className="size-3.5" />}
          <span className="truncate">{current ? shortName(current) : loaded ? "Choose a model" : "Loading models…"}</span>
          <ChevronDownIcon className="size-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search models…" className="h-9 text-xs" />
          <CommandList className="max-h-80">
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">No models. Add a key in Settings.</CommandEmpty>
            {ordered.map(([group, items]) => (
              <CommandGroup key={group} heading={group}>
                {items.map((m) => (
                  <CommandItem
                    key={m.ref}
                    value={`${m.providerName} ${m.name} ${m.id}`}
                    onSelect={() => {
                      select(m.ref);
                      setOpen(false);
                    }}
                    className="gap-2 text-xs"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{m.kind === "harness" ? m.name : shortName(m)}</span>
                      {m.description ? <span className="truncate text-[10px] text-muted-foreground">{m.description}</span> : null}
                    </span>
                    {m.vision ? <span className="text-[10px] text-muted-foreground">vision</span> : null}
                    <CheckIcon className={cn("size-3.5", m.ref === selected ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
                className="gap-2 text-xs"
              >
                <KeyRoundIcon className="size-3.5" /> Add keys, local models or Claude Code…
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
