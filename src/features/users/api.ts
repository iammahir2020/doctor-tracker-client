"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toQueryString, type ManagedUser, type Paged, type Role } from "@/lib/api";
import { qk } from "@/lib/query-keys";

export type UserListParams = {
  search?: string;
  role?: Role;
  sort: "name" | "createdAt";
  order: "asc" | "desc";
  page: number;
  pageSize: number;
  archived?: boolean;
};

export type NewUser = { name: string; email: string; password: string; role: Role };

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: qk.users.list(params),
    queryFn: ({ signal }) => api<Paged<ManagedUser>>(`/users${toQueryString(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewUser) => api<ManagedUser>("/users", { method: "POST", body: input }),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: qk.users.all });
      toast.success(`${user.name} can now sign in`);
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name?: string; role?: Role } }) =>
      api<ManagedUser>(`/users/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.users.all });
      // The signed-in admin may have renamed themselves.
      void queryClient.invalidateQueries({ queryKey: qk.me });
      toast.success("User updated");
    },
  });
}

export function useSetUserArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) =>
      api<ManagedUser>(`/users/${id}/${archive ? "archive" : "restore"}`, { method: "POST" }),
    onSuccess: (user, { archive }) => {
      void queryClient.invalidateQueries({ queryKey: qk.users.all });
      toast.success(archive ? `${user.name} can no longer sign in` : `${user.name} restored`);
    },
  });
}
