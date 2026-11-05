"use client";

import { useEffect, useState } from "react";
import type { PackCard } from "@/core/packs";

// One request per page load: the dashboard and the Templates tab show the same list.
let pending: Promise<PackCard[]> | null = null;

const fetchPacks = () => {
  pending ??= fetch("/api/packs")
    .then((r) => (r.ok ? (r.json() as Promise<{ packs?: PackCard[] }>) : { packs: [] }))
    .then((d) => d.packs ?? [])
    .catch(() => {
      pending = null;
      return [];
    });
  return pending;
};

/** The style packs as templates; null while they load. */
export const usePacks = () => {
  const [packs, setPacks] = useState<PackCard[] | null>(null);
  useEffect(() => {
    let live = true;
    void fetchPacks().then((p) => {
      if (live) setPacks(p);
    });
    return () => {
      live = false;
    };
  }, []);
  return packs;
};
