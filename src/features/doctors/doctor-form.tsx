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
import { useLookups } from "@/features/lookups/api";
import { ApiError, fieldErrors, type Doctor } from "@/lib/api";
import { useSaveDoctor } from "./api";
import { doctorArchiveLabel } from "./doctor-archive-dialog";

// Mirrors the server's schema for instant feedback; the server stays the source of truth.
const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  specialization: z.string().min(1, "Choose a specialization"),
  hospital: z.string().trim().min(2, "Hospital is required").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{6,20}$/, "Enter a valid phone number"),
  email: z.email("Enter a valid email address").max(254),
});

type FormValues = z.infer<typeof schema>;
const FIELDS = ["name", "specialization", "hospital", "phone", "email"] as const;

const EMPTY: FormValues = { name: "", specialization: "", hospital: "", phone: "", email: "" };

export function DoctorFormDialog({
  open,
  onOpenChange,
  doctor,
  onArchive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing when set, creating otherwise. */
  doctor?: Doctor;
  /** Shown when editing: hands off to the archive dialog. */
  onArchive?: (doctor: Doctor) => void;
}) {
  const { data: lookups } = useLookups();
  const save = useSaveDoctor();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) {
      reset(doctor ? { ...doctor } : EMPTY);
      save.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, doctor]);

  // An archived specialization stays selectable for the doctor that already has it.
  const options = lookups?.specializationOptions ?? [];
  const current = doctor?.specialization;
  const specializationOptions =
    current && !options.some((o) => o.value === current)
      ? [
          ...options,
          {
            value: current,
            label: `${lookups?.specializationName.get(current) ?? "Unknown"} (archived)`,
          },
        ]
      : options;

  const onSubmit = handleSubmit((values) => {
    save.mutate(
      { id: doctor?._id, input: values },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => {
          const fields = fieldErrors(err);
          for (const name of FIELDS) {
            if (fields[name]) setError(name, { message: fields[name] });
          }
          // Duplicate email comes back as a 409 without field details.
          if (err instanceof ApiError && err.status === 409) {
            setError("email", { message: "A doctor with this email already exists" });
          }
        },
      },
    );
  });

  const formError =
    save.error instanceof ApiError &&
    save.error.status !== 409 &&
    Object.keys(fieldErrors(save.error)).length === 0
      ? save.error.message
      : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{doctor ? "Edit doctor" : "Add doctor"}</DialogTitle>
          <DialogDescription>
            {doctor ? "Update this doctor's details." : "Add a doctor to the directory."}
          </DialogDescription>
        </DialogHeader>

        <form id="doctor-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" id="name" error={errors.name?.message} className="sm:col-span-2">
            <Input id="name" autoComplete="off" {...register("name")} />
          </Field>
          <Field label="Specialization" id="specialization" error={errors.specialization?.message}>
            <Controller
              control={control}
              name="specialization"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="specialization"
                    className="w-full"
                    aria-invalid={!!errors.specialization}
                  >
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {specializationOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Hospital" id="hospital" error={errors.hospital?.message}>
            <Input id="hospital" {...register("hospital")} />
          </Field>
          <Field label="Phone" id="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" autoComplete="off" {...register("phone")} />
          </Field>
          <Field label="Email" id="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="off"
              spellCheck={false}
              {...register("email")}
            />
          </Field>
        </form>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <DialogFooter className="sm:justify-between">
          {doctor && onArchive ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={save.isPending}
              onClick={() => onArchive(doctor)}
            >
              <Archive aria-hidden /> {doctorArchiveLabel(doctor)}…
            </Button>
          ) : (
            <span aria-hidden />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form="doctor-form" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {doctor ? "Save changes" : "Add doctor"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
