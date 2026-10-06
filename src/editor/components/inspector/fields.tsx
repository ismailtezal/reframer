"use client";

import { CheckIcon, ChevronDownIcon, DiamondIcon, DiamondPlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EASING_LABELS, sampleEasing } from "@/core/easing";
import { FONT_LIBRARY } from "@/core/fonts";
import { EASING_PRESETS, type Easing } from "@/core/schema";
import { cn } from "@/lib/utils";
import { loadFont } from "@/remotion/fonts";

export const FieldRow: React.FC<{ label: string; children: React.ReactNode; className?: string; hint?: string }> = ({
  label,
  children,
  className,
  hint,
}) => (
  <div className={cn("grid grid-cols-[84px_1fr] items-center gap-2 py-0.5", className)}>
    <span className="truncate text-xs text-muted-foreground" title={hint ?? label}>
      {label}
    </span>
    <div className="flex min-w-0 items-center gap-1">{children}</div>
  </div>
);

/** Keyframe toggle (diamond) — filled when a keyframe sits on the playhead. */
export const KeyframeButton: React.FC<{ state: "none" | "track" | "on"; onClick: () => void }> = ({ state, onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 hover:bg-accent hover:text-foreground",
          state === "track" && "text-amber-300/80",
          state === "on" && "text-amber-300",
        )}
        aria-label="Toggle keyframe"
      >
        {state === "on" ? (
          <DiamondIcon className="size-3 fill-current" />
        ) : state === "track" ? (
          <DiamondPlusIcon className="size-3" />
        ) : (
          <DiamondIcon className="size-3" />
        )}
      </button>
    </TooltipTrigger>
    <TooltipContent>
      {state === "on" ? "Remove keyframe" : state === "track" ? "Add keyframe at playhead" : "Animate: add a keyframe at the playhead"}
    </TooltipContent>
  </Tooltip>
);

/** Numeric input with a scrubbable label (drag left/right), Figma-style. */
export const NumberField: React.FC<{
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  precision?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  disabled?: boolean;
}> = ({ value, onChange, step = 1, min, max, precision, suffix, prefix, className, disabled }) => {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const dragRef = useRef<{ x: number; v: number } | null>(null);
  const decimals = precision ?? (step < 1 ? Math.min(3, String(step).split(".")[1]?.length ?? 2) : 0);
  const clampV = (v: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, v));
  const fmt = (v: number) => (Number.isFinite(v) ? Number(v.toFixed(decimals)).toString() : "0");

  // biome-ignore lint/correctness/useExhaustiveDependencies: mirror the value into the text box unless the user is typing
  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);

  const commit = (raw: string) => {
    // Allow simple math like "1920/2" or "120+40".
    const cleaned = raw.replace(/[^0-9+\-*/.() ]/g, "");
    let v = Number(cleaned);
    if (Number.isNaN(v)) {
      try {
        // Arithmetic on an expression already stripped to digits and + - * / . ( )
        v = Number(Function(`"use strict";return (${cleaned})`)());
      } catch {
        v = value;
      }
    }
    if (Number.isFinite(v)) onChange(clampV(v));
    else setText(fmt(value));
  };

  return (
    <div
      className={cn(
        "flex h-7 min-w-0 flex-1 items-center rounded-md border border-input bg-background/40 text-xs focus-within:border-ring",
        disabled && "opacity-50",
        className,
      )}
    >
      {prefix ? (
        <span
          className="flex h-full cursor-ew-resize items-center pr-1 pl-2 text-[11px] text-muted-foreground select-none"
          onPointerDown={(e) => {
            if (disabled) return;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            dragRef.current = { x: e.clientX, v: value };
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            const dx = e.clientX - dragRef.current.x;
            const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
            onChange(clampV(Number((dragRef.current.v + Math.round(dx / 2) * step * mult).toFixed(decimals))));
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
        >
          {prefix}
        </span>
      ) : null}
      <input
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={(e) => {
          setFocused(false);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const mult = e.shiftKey ? 10 : 1;
            const next = clampV(value + (e.key === "ArrowUp" ? step : -step) * mult);
            onChange(Number(next.toFixed(decimals)));
            setText(fmt(next));
          }
        }}
        className={cn("tabular h-full w-full min-w-0 bg-transparent px-2 outline-none", prefix && "pl-0.5")}
      />
      {suffix ? <span className="pr-2 text-[11px] text-muted-foreground">{suffix}</span> : null}
    </div>
  );
};

export const SliderField: React.FC<{
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}> = ({ value, onChange, min, max, step = 0.01, format }) => (
  <div className="flex min-w-0 flex-1 items-center gap-2">
    <Slider className="flex-1" min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    <span className="tabular w-10 shrink-0 text-right text-[11px] text-muted-foreground">{format ? format(value) : value.toFixed(2)}</span>
  </div>
);

export const ColorField: React.FC<{ value: string; onChange: (v: string) => void; allowEmpty?: boolean }> = ({ value, onChange }) => {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const hex = /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : /^#[0-9a-f]{3}$/i.test(value)
      ? `#${value
          .slice(1)
          .split("")
          .map((c) => c + c)
          .join("")}`
      : "#ffffff";
  return (
    <div className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-input bg-background/40 pl-1 text-xs focus-within:border-ring">
      <label
        className="relative size-5 shrink-0 cursor-pointer overflow-hidden rounded border border-white/10"
        style={{ background: value }}
      >
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() && text !== value && onChange(text.trim())}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="h-full min-w-0 flex-1 bg-transparent font-mono text-[11px] outline-none"
      />
    </div>
  );
};

export const SelectField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[] | readonly string[];
  placeholder?: string;
}> = ({ value, onChange, options, placeholder }) => {
  const opts = (options as readonly (string | { value: string; label: string })[]).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="h-7 min-w-0 flex-1 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export const SwitchField: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
  <Switch checked={value} onCheckedChange={onChange} />
);

export const FontPicker: React.FC<{ value: string; onChange: (family: string) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) return;
    // Lazy-load previews for the curated list.
    for (const f of FONT_LIBRARY) void loadFont({ family: f.family, weight: f.weights.includes(500) ? 500 : f.weights[0] });
  }, [open]);
  const custom = query.trim() && !FONT_LIBRARY.some((f) => f.family.toLowerCase() === query.trim().toLowerCase());
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 min-w-0 flex-1 justify-between px-2 text-xs font-normal">
          <span className="truncate" style={{ fontFamily: `"${value}", Inter, sans-serif` }}>
            {value}
          </span>
          <ChevronDownIcon className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search Google Fonts…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-72">
            <CommandEmpty>Type any Google Fonts family name.</CommandEmpty>
            {custom ? (
              <CommandGroup heading="Use any Google font">
                <CommandItem
                  value={`custom-${query}`}
                  onSelect={() => {
                    onChange(query.trim());
                    setOpen(false);
                  }}
                >
                  Use “{query.trim()}”
                </CommandItem>
              </CommandGroup>
            ) : null}
            {(["sans", "display", "serif", "handwriting", "mono"] as const).map((cat) => (
              <CommandGroup key={cat} heading={cat === "sans" ? "Sans serif" : cat[0].toUpperCase() + cat.slice(1)}>
                {FONT_LIBRARY.filter((f) => f.category === cat).map((f) => (
                  <CommandItem
                    key={f.family}
                    value={f.family}
                    onSelect={() => {
                      onChange(f.family);
                      setOpen(false);
                    }}
                  >
                    <span className="flex-1 truncate text-sm" style={{ fontFamily: `"${f.family}", Inter, sans-serif` }}>
                      {f.family}
                    </span>
                    {f.note ? <span className="text-[10px] text-muted-foreground">{f.note}</span> : null}
                    {value === f.family ? <CheckIcon className="size-3.5" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const EasingCurve: React.FC<{ easing: Easing | undefined; className?: string }> = ({ easing, className }) => {
  const pts = sampleEasing(easing, 32);
  const min = Math.min(0, ...pts);
  const max = Math.max(1, ...pts);
  const d = pts
    .map((v, i) => `${i === 0 ? "M" : "L"}${((i / 32) * 28 + 2).toFixed(1)} ${(26 - ((v - min) / (max - min)) * 24).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 32 28" className={cn("size-6 shrink-0", className)} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
};

export const EasingField: React.FC<{ value: Easing | undefined; onChange: (e: Easing) => void; fallback?: string }> = ({
  value,
  onChange,
  fallback = "smooth",
}) => {
  const current = typeof value === "string" ? value : value ? (value.type === "spring" ? "custom spring" : "custom bezier") : fallback;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <EasingCurve easing={value ?? (fallback as Easing)} className="text-ai" />
      <Select value={typeof value === "string" ? value : fallback} onValueChange={(v) => onChange(v as Easing)}>
        <SelectTrigger size="sm" className="h-7 min-w-0 flex-1 text-xs">
          <SelectValue placeholder={current} />
        </SelectTrigger>
        <SelectContent>
          {EASING_PRESETS.map((p) => (
            <SelectItem key={p} value={p} className="text-xs">
              <EasingCurve easing={p} />
              {EASING_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  action?: React.ReactNode;
}> = ({ title, children, defaultOpen = true, action }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border/70">
      <div className="flex h-9 items-center px-3">
        <button type="button" onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-1.5 text-left text-xs font-medium">
          <ChevronDownIcon className={cn("size-3.5 text-muted-foreground transition-transform", !open && "-rotate-90")} />
          {title}
        </button>
        {action}
      </div>
      {open ? <div className="space-y-1 px-3 pb-3">{children}</div> : null}
    </section>
  );
};
