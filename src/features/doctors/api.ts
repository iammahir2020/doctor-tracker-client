"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toQueryString, type Doctor, type Paged } from "@/lib/api";
import { qk } from "@/lib/query-keys";

export type DoctorListParams = {
  search?: string;
  specialization?: string[];
  hospital?: string;
  createdFrom?: string;
  createdTo?: string;
  minPatients?: number;
  maxPatients?: number;
  sort: "name" | "createdAt" | "patientCount";
  order: "asc" | "desc";
  page: number;
  pageSize: number;
  archived?: boolean;
};

export type DoctorInput = Pick<Doctor, "name" | "specialization" | "hospital" | "phone" | "email">;

export function useDoctors(params: DoctorListParams) {
  return useQuery({
    queryKey: qk.doctors.list(params),
    queryFn: ({ signal }) => api<Paged<Doctor>>(`/doctors${toQueryString(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useDoctor(id: string) {
  return useQuery({
    queryKey: qk.doctors.detail(id),
    queryFn: ({ signal }) => api<Doctor>(`/doctors/${id}`, { signal }),
  });
}

/** Small name search for the patient form's doctor picker. */
export function useDoctorOptions(search: string) {
  return useQuery({
    queryKey: qk.doctors.options(search),
    queryFn: ({ signal }) =>
      api<Paged<Doctor>>(
        `/doctors${toQueryString({ search, sort: "name", order: "asc", pageSize: 20 })}`,
        { signal },
      ),
    placeholderData: keepPreviousData,
    select: (res) => res.data,
  });
}

/** Doctor writes can change list rows, the detail page and dashboard numbers. */
function invalidateDoctorData(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: qk.doctors.all });
  void queryClient.invalidateQueries({ queryKey: ["stats"] });
}

export function useSaveDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: DoctorInput }) =>
      id
        ? api<Doctor>(`/doctors/${id}`, { method: "PATCH", body: input })
        : api<Doctor>("/doctors", { method: "POST", body: input }),
    onSuccess: (doctor, { id }) => {
      queryClient.setQueryData(qk.doctors.detail(doctor._id), doctor);
      invalidateDoctorData(queryClient);
      toast.success(id ? "Doctor updated" : `${doctor.name} added`);
    },
  });
}

/**
 * Archive/restore removes the row from the current list straight away (it moves between the
 * active and archived views) and puts it back if the server refuses, e.g. when the doctor
 * still has active patients.
 */
export function useSetDoctorArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) =>
      api<Doctor>(`/doctors/${id}/${archive ? "archive" : "restore"}`, { method: "POST" }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["doctors", "list"] });
      const snapshot = queryClient.getQueriesData<Paged<Doctor>>({ queryKey: ["doctors", "list"] });
      queryClient.setQueriesData<Paged<Doctor>>({ queryKey: ["doctors", "list"] }, (old) =>
        old
          ? {
              ...old,
              data: old.data.filter((d) => d._id !== id),
              meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
            }
          : old,
      );
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSuccess: (doctor, { archive }) => {
      queryClient.setQueryData(qk.doctors.detail(doctor._id), doctor);
      toast.success(archive ? `${doctor.name} archived` : `${doctor.name} restored`);
    },
    onSettled: () => invalidateDoctorData(queryClient),
  });
}
