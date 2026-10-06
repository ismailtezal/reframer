"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { SHORTCUT_GROUPS } from "../../hooks/useShortcuts";

export const ShortcutsDialog: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void }> = ({ open, onOpenChange }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>Premiere, Final Cut and CapCut users will feel at home. Ctrl = ⌘ on macOS.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-6 sm:grid-cols-2">
        {SHORTCUT_GROUPS.map((g) => (
          <div key={g.title}>
            <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{g.title}</h3>
            <ul className="space-y-1.5">
              {g.items.map(([keys, label]) => (
                <li key={label} className="flex items-center justify-between gap-3 text-sm">
                  <span>{label}</span>
                  <span className="flex gap-1">
                    {keys.split(" / ").map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);
