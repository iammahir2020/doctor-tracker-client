"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, type User } from "@/lib/api";
import { qk } from "@/lib/query-keys";

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: ({ signal }) => api<{ user: User }>("/auth/me", { signal }).then((r) => r.user),
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      // Long timeout: this may be the request that wakes the free-tier server.
      api<{ user: User }>("/auth/login", {
        method: "POST",
        body,
        timeoutMs: 70_000,
        redirectOn401: false,
      }),
    onSuccess: ({ user }) => queryClient.setQueryData(qk.me, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      queryClient.clear();
      router.replace("/login");
    },
  });
}
