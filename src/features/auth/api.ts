"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { api, type User } from "@/lib/api";
import { qk } from "@/lib/query-keys";

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: ({ signal }) => api<{ user: User }>("/auth/me", { signal }).then((r) => r.user),
    staleTime: 5 * 60_000,
  });
}

const noopSubscribe = () => () => {};

/**
 * The signed-in user for rendering. The server never knows who is signed in, and page content
 * hydrates inside Suspense after /auth/me may already have answered, so anything that depends on
 * the user (role-gated buttons, names) waits until hydration is done to match the server HTML.
 */
export function useCurrentUser() {
  const { data } = useMe();
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return hydrated ? data : undefined;
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

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api<void>("/auth/me/password", { method: "PATCH", body }),
    onSuccess: () => toast.success("Password changed"),
  });
}
