"use client";

import { CheckIcon, ChevronDownIcon, CpuIcon, KeyRoundIcon, TerminalIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { type ModelOption, useModels } from "./models";

const shortName = (m: ModelOption) => m.name.replace(/\s*\(your login\)/, "");

/** Compact model switcher for the agent composer. */
export const ModelPicker: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
  const { models, selected, select, loaded } = useModels();
  const [open, setOpen] = useState(false);
  const current = models.find((m) => m.ref === selected);

  const groups = new Map<string, ModelOption[]>();
  for (const m of models) {
    const key = m.kind === "harness" ? "Your local agents" : m.providerName;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  // Local agents first, then providers in catalog order.
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === "Your local agents" ? -1 : b === "Your local agents" ? 1 : 0));

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
      <PopoverContent align="start" side="top" className="w-72 p-0">
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
                    <span className="min-w-0 flex-1 truncate">{shortName(m)}</span>
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
