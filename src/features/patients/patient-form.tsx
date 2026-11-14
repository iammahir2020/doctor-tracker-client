"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Field } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DoctorPicker } from "@/features/doctors/doctor-picker";
import { useLookups } from "@/features/lookups/api";
import { ApiError, fieldErrors, GENDERS, PATIENT_STATUSES, type Patient } from "@/lib/api";
import { toDateParam } from "@/lib/utils";
import { useSavePatient } from "./api";

const today = () => toDateParam(new Date());

// Mirrors the server's schema for instant feedback; the server stays the source of truth.
const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  dateOfBirth: z
    .string()
    .min(1, "Date of birth is required")
    .refine((v) => v <= today(), "Date of birth cannot be in the future"),
  gender: z.enum(GENDERS, "Choose a gender"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{6,20}$/, "Enter a valid phone number"),
  email: z.union([z.email("Enter a valid email address"), z.literal("")]),
  condition: z.string().min(1, "Choose a condition"),
  status: z.enum(PATIENT_STATUSES),
  admissionDate: z
    .string()
    .min(1, "Admission date is required")
    .refine((v) => v <= today(), "Admission date cannot be in the future"),
  notes: z.string().max(1000, "Keep notes under 1000 characters"),
  doctorId: z.string().min(1, "Choose a doctor"),
});

type FormValues = z.infer<typeof schema>;
const FIELDS = Object.keys(schema.shape) as (keyof FormValues)[];

export const STATUS_LABEL: Record<(typeof PATIENT_STATUSES)[number], string> = {
  active: "Active",
  recovered: "Recovered",
  critical: "Critical",
};
export const GENDER_LABEL: Record<(typeof GENDERS)[number], string> = {
  male: "Male",
  female: "Female",
  other: "Other",
};

function toValues(patient: Patient | undefined, lockedDoctorId: string | undefined): FormValues {
  return {
    name: patient?.name ?? "",
    dateOfBirth: patient ? patient.dateOfBirth.slice(0, 10) : "",
    gender: patient?.gender ?? ("" as FormValues["gender"]),
    phone: patient?.phone ?? "",
    email: patient?.email ?? "",
    condition: patient?.condition ?? "",
    status: patient?.status ?? "active",
    admissionDate: patient ? patient.admissionDate.slice(0, 10) : today(),
    notes: patient?.notes ?? "",
    doctorId: patient?.doctorId ?? lockedDoctorId ?? "",
  };
}

export function PatientFormDialog({
  open,
  onOpenChange,
  patient,
  doctor,
  onArchive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing when set, creating otherwise. */
  patient?: Patient;
  /** Adding from a doctor's page: the doctor is fixed. */
  doctor?: { _id: string; name: string };
  /** Shown when editing (admins only): hands off to the archive dialog. */
  onArchive?: (patient: Patient) => void;
}) {
  const { data: lookups } = useLookups();
  const save = useSavePatient();
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toValues(patient, doctor?._id),
  });

  useEffect(() => {
    if (open) {
      reset(toValues(patient, doctor?._id));
      save.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, patient, doctor]);

  // A condition archived after this patient was admitted stays selectable for them.
  const options = lookups?.conditionOptions ?? [];
  const current = patient?.condition;
  const conditionOptions =
    current && !options.some((o) => o.value === current)
      ? [
          ...options,
          {
            value: current,
            label: `${lookups?.conditionName.get(current) ?? "Unknown"} (archived)`,
          },
        ]
      : options;

  const onSubmit = handleSubmit((values) => {
    save.mutate(
      { id: patient?._id, input: values },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => {
          const fields = fieldErrors(err);
          for (const name of FIELDS) {
            if (fields[name]) setError(name, { message: fields[name] });
          }
        },
      },
    );
  });

  const formError =
    save.error instanceof ApiError && Object.keys(fieldErrors(save.error)).length === 0
      ? save.error.message
      : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{patient ? "Edit patient" : "Add patient"}</DialogTitle>
          <DialogDescription>
            {doctor && !patient
              ? `New patient for ${doctor.name}.`
              : patient
                ? "Update this patient's details."
                : "Register a new patient and assign a doctor."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="patient-form"
          onSubmit={onSubmit}
          noValidate
          className="grid gap-4 sm:grid-cols-2"
        >
          <h3 className="text-sm font-semibold text-muted-foreground sm:col-span-2">
            Personal details
          </h3>
          <Field label="Full name" id="p-name" error={errors.name?.message}>
            <Input
              id="p-name"
              autoComplete="off"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
          </Field>
          <Field label="Date of birth" id="p-dob" error={errors.dateOfBirth?.message}>
            <Input
              id="p-dob"
              type="date"
              max={today()}
              aria-invalid={!!errors.dateOfBirth}
              {...register("dateOfBirth")}
            />
          </Field>
          <Field label="Gender" id="p-gender" error={errors.gender?.message}>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="p-gender" className="w-full" aria-invalid={!!errors.gender}>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {GENDER_LABEL[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Phone" id="p-phone" error={errors.phone?.message}>
            <Input
              id="p-phone"
              type="tel"
              placeholder="+880 1711 000000"
              aria-invalid={!!errors.phone}
              {...register("phone")}
            />
          </Field>
          <Field label="Email (optional)" id="p-email" error={errors.email?.message}>
            <Input
              id="p-email"
              type="email"
              spellCheck={false}
              aria-invalid={!!errors.email}
              {...register("email")}
            />
          </Field>
          <h3 className="mt-2 border-t pt-4 text-sm font-semibold text-muted-foreground sm:col-span-2">
            Admission
          </h3>
          <Field label="Condition" id="p-condition" error={errors.condition?.message}>
            <Controller
              control={control}
              name="condition"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="p-condition"
                    className="w-full"
                    aria-invalid={!!errors.condition}
                  >
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditionOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Status" id="p-status" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="p-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PATIENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Admission date" id="p-admission" error={errors.admissionDate?.message}>
            <Input
              id="p-admission"
              type="date"
              max={today()}
              aria-invalid={!!errors.admissionDate}
              {...register("admissionDate")}
            />
          </Field>
          <Field
            label="Doctor"
            id="p-doctor"
            error={errors.doctorId?.message}
            className="sm:col-span-2"
          >
            {doctor && !patient ? (
              <Input id="p-doctor" value={doctor.name} disabled readOnly />
            ) : (
              <Controller
                control={control}
                name="doctorId"
                render={({ field }) => (
                  <DoctorPicker
                    id="p-doctor"
                    value={field.value}
                    initialLabel={patient?.doctorName ?? undefined}
                    onChange={field.onChange}
                    invalid={!!errors.doctorId}
                  />
                )}
              />
            )}
          </Field>
          <Field
            label="Notes (optional)"
            id="p-notes"
            error={errors.notes?.message}
            className="sm:col-span-2"
          >
            <textarea
              id="p-notes"
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
              aria-invalid={!!errors.notes}
              {...register("notes")}
            />
          </Field>
        </form>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <DialogFooter className="sm:justify-between">
          {patient && onArchive ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={save.isPending}
              onClick={() => onArchive(patient)}
            >
              <Archive aria-hidden /> Archive…
            </Button>
          ) : (
            <span aria-hidden />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form="patient-form" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {patient ? "Save changes" : "Add patient"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
