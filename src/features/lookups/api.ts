"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError, type Lookup, type Lookups, type LookupType } from "@/lib/api";
import { qk } from "@/lib/query-keys";

function toMaps(lookups: Lookups) {
  const byId = (list: Lookup[]) => new Map(list.map((l) => [l._id, l.name]));
  const options = (list: Lookup[]) =>
    list.filter((l) => !l.isArchived).map((l) => ({ value: l._id, label: l.name }));
  return {
    raw: lookups,
    specializationName: byId(lookups.specializations),
    conditionName: byId(lookups.conditions),
    specializationOptions: options(lookups.specializations),
    conditionOptions: options(lookups.conditions),
  };
}

/**
 * Lookup lists change rarely, so they are cached for the whole session and only refetched after
 * an admin edits them. `select` turns them into id→name maps once per fetch, not per render.
 */
export function useLookups() {
  return useQuery({
    queryKey: qk.lookups,
    queryFn: ({ signal }) => api<Lookups>("/lookups", { signal }),
    staleTime: Infinity,
    select: toMaps,
  });
}

type LookupAction =
  | { kind: "create"; type: LookupType; name: string }
  | { kind: "rename"; type: LookupType; id: string; name: string }
  | { kind: "archive" | "restore"; type: LookupType; id: string };

export function useLookupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (a: LookupAction) => {
      switch (a.kind) {
        case "create":
          return api<Lookup>(`/lookups/${a.type}`, { method: "POST", body: { name: a.name } });
        case "rename":
          return api<Lookup>(`/lookups/${a.type}/${a.id}`, {
            method: "PATCH",
            body: { name: a.name },
          });
        default:
          return api<Lookup>(`/lookups/${a.type}/${a.id}/${a.kind}`, { method: "POST" });
      }
    },
    onSuccess: (lookup, a) => {
      void queryClient.invalidateQueries({ queryKey: qk.lookups });
      const verb = {
        create: "Added",
        rename: "Renamed to",
        archive: "Archived",
        restore: "Restored",
      };
      toast.success(`${verb[a.kind]} ${lookup.name}`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Could not save the change");
    },
  });
}
