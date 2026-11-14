"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO, startOfMonth, subDays, subMonths } from "date-fns";
import { api, toQueryString, type Stats } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { toDateParam, useUrlState } from "@/lib/utils";

type Range = { from: string; to: string };

export function defaultRange(): Range {
  const to = new Date();
  return { from: toDateParam(startOfMonth(subMonths(to, 11))), to: toDateParam(to) };
}

/** The same number of days immediately before `range`, for "vs previous period". */
export function previousRange(range: Range): Range {
  const from = parseISO(range.from);
  const days = differenceInCalendarDays(parseISO(range.to), from) + 1;
  return { from: toDateParam(subDays(from, days)), to: toDateParam(subDays(from, 1)) };
}

/** The range lives in the URL; without one the dashboard shows the last 12 months. */
export function useStatsRange(): Range {
  const url = useUrlState();
  const fallback = defaultRange();
  return { from: url.get("from") ?? fallback.from, to: url.get("to") ?? fallback.to };
}

/**
 * Own changes refresh the dashboard immediately (every mutation invalidates "stats"). For changes
 * made by other users it polls once a minute while visible and refetches when the tab regains
 * focus. One minute matches the server-side cache.
 */
export function useStats(range: Range) {
  return useQuery({
    queryKey: qk.stats(range),
    queryFn: ({ signal }) => api<Stats>(`/stats${toQueryString(range)}`, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
