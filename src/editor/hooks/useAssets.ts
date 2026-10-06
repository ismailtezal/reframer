"use client";

import { useMemo } from "react";
import type { Asset } from "@/core/schema";
import { useProjectStore } from "../store/project-store";

export const useAssetsOfType = (types: Asset["type"][]): Asset[] => {
  const assets = useProjectStore((s) => s.project?.assets);
  const key = types.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the joined key captures `types`
  return useMemo(() => Object.values(assets ?? {}).filter((a) => types.includes(a.type)), [assets, key]);
};
