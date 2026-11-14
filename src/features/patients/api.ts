"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toQueryString, type Paged, type Patient, type PatientStatus } from "@/lib/api";
import { qk } from "@/lib/query-keys";

export type PatientListParams = {
  search?: string;
  condition?: string[];
  status?: PatientStatus[];
  doctorId?: string;
  gender?: string;
  admittedFrom?: string;
  admittedTo?: string;
  minAge?: number;
  maxAge?: number;
  sort: "name" | "admissionDate" | "age";
  order: "asc" | "desc";
  page: number;
  pageSize: number;
  archived?: boolean;
};

type PatientInput = Pick<
  Patient,
  "name" | "gender" | "phone" | "condition" | "status" | "doctorId"
> & {
  dateOfBirth: string;
  admissionDate: string;
  email: string;
  notes: string;
};

export function usePatients(params: PatientListParams) {
  return useQuery({
    queryKey: qk.patients.list(params),
    queryFn: ({ signal }) => api<Paged<Patient>>(`/patients${toQueryString(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: ["patients", "detail", id],
    queryFn: ({ signal }) => api<Patient>(`/patients/${id}`, { signal }),
    enabled: Boolean(id),
  });
}

/**
 * A patient write can change the patient lists, a doctor's patient count (list + detail) and
 * the dashboard, so all three are refreshed.
 */
function invalidatePatientData(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: qk.patients.all });
  void queryClient.invalidateQueries({ queryKey: qk.doctors.all });
  void queryClient.invalidateQueries({ queryKey: ["stats"] });
}

export function useSavePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: PatientInput }) =>
      id
        ? api<Patient>(`/patients/${id}`, { method: "PATCH", body: input })
        : api<Patient>("/patients", { method: "POST", body: input }),
    onSuccess: (patient, { id }) => {
      invalidatePatientData(queryClient);
      toast.success(id ? "Patient updated" : `${patient.name} added`);
    },
  });
}

/** Optimistically drops the row from every cached patients list; restored if the server refuses. */
export function useSetPatientArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archive, doctorId }: { id: string; archive: boolean; doctorId?: string }) =>
      // doctorId: restore under another doctor when the patient's own doctor is archived.
      api<Patient>(`/patients/${id}/${archive ? "archive" : "restore"}`, {
        method: "POST",
        body: doctorId ? { doctorId } : undefined,
      }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["patients", "list"] });
      const snapshot = queryClient.getQueriesData<Paged<Patient>>({
        queryKey: ["patients", "list"],
      });
      queryClient.setQueriesData<Paged<Patient>>({ queryKey: ["patients", "list"] }, (old) =>
        old
          ? {
              ...old,
              data: old.data.filter((p) => p._id !== id),
              meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
            }
          : old,
      );
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSuccess: (patient, { archive }) => {
      toast.success(archive ? `${patient.name} archived` : `${patient.name} restored`);
    },
    onSettled: () => invalidatePatientData(queryClient),
  });
}
