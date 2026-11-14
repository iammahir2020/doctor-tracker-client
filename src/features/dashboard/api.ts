"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { startOfMonth, subMonths } from "date-fns";
import { api, toQueryString, type Stats } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { toDateParam, useUrlState } from "@/lib/utils";

export function defaultRange() {
  const to = new Date();
  return { from: toDateParam(startOfMonth(subMonths(to, 11))), to: toDateParam(to) };
}

/** The range lives in the URL; without one the dashboard shows the last 12 months. */
export function useStatsRange() {
  const url = useUrlState();
  const fallback = defaultRange();
  return { from: url.get("from") ?? fallback.from, to: url.get("to") ?? fallback.to };
}

export function useStats(range: { from: string; to: string }) {
  return useQuery({
    queryKey: qk.stats(range),
    queryFn: ({ signal }) => api<Stats>(`/stats${toQueryString(range)}`, { signal }),
    placeholderData: keepPreviousData,
    // The server caches for 60s and clears on writes; matching it avoids pointless refetches.
    staleTime: 60_000,
  });
}
