"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/common";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError, type Doctor } from "@/lib/api";
import { plural } from "@/lib/utils";
import { useSetDoctorArchived } from "./api";
import { DoctorPicker } from "./doctor-picker";

/** The label for the archive action, so menus and buttons never offer an archive that can't work. */
export function doctorArchiveLabel(doctor: Pick<Doctor, "isArchived" | "patientCount">) {
  if (doctor.isArchived) return "Restore";
  return doctor.patientCount > 0 ? "Reassign & archive" : "Archive";
}

/**
 * Archive or restore a doctor. A doctor with active patients can't simply be archived, so instead
 * of an Archive button that would be refused, this offers the way forward: move every active
 * patient to another doctor and archive in one step, or go and review the patients first.
 */
export function DoctorArchiveDialog({
  doctor,
  open,
  onOpenChange,
  /** Set on the doctor's own page, where the patients list is right below. */
  onReviewPatients,
}: {
  doctor: Doctor | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewPatients?: () => void;
}) {
  const setArchived = useSetDoctorArchived();

  if (!doctor) return null;

  if (doctor.isArchived || doctor.patientCount === 0) {
    const archive = !doctor.isArchived;
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title={archive ? `Archive ${doctor.name}?` : `Restore ${doctor.name}?`}
        description={
          archive
            ? "Archiving removes the doctor from active lists, search and the dashboard. Nothing is deleted, and an admin can restore them later."
            : "The doctor will appear in lists, search and the dashboard again, and can take new patients."
        }
        confirmLabel={archive ? "Archive" : "Restore"}
        destructive={archive}
        onConfirm={() => setArchived.mutateAsync({ id: doctor._id, archive })}
      />
    );
  }

  return (
    <ReassignAndArchive
      doctor={doctor}
      open={open}
      onOpenChange={onOpenChange}
      onReviewPatients={onReviewPatients}
    />
  );
}

function ReassignAndArchive({
  doctor,
  open,
  onOpenChange,
  onReviewPatients,
}: {
  doctor: Doctor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewPatients?: () => void;
}) {
  const setArchived = useSetDoctorArchived();
  const [target, setTarget] = useState("");
  const pending = setArchived.isPending;
  const count = plural(doctor.patientCount, "active patient");

  const close = (next: boolean) => {
    if (pending) return;
    if (!next) {
      setTarget("");
      setArchived.reset();
    }
    onOpenChange(next);
  };

  const submit = () => {
    setArchived.mutate(
      { id: doctor._id, archive: true, reassignTo: target },
      { onSuccess: () => close(false) },
    );
  };

  const error = setArchived.error instanceof ApiError ? setArchived.error.message : null;

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {doctor.name} still has {count}
          </AlertDialogTitle>
          <AlertDialogDescription>
            A doctor can only be archived once nobody is assigned to them. Move their patients to
            another doctor and archive in one step, or review the patients first.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reassign-to">Move all {count} to</Label>
          <DoctorPicker
            id="reassign-to"
            value={target}
            excludeId={doctor._id}
            onChange={setTarget}
          />
          <p className="text-sm text-muted-foreground">
            Their records, history and status stay the same; only the assigned doctor changes.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <AlertDialogFooter className="sm:justify-between">
          {onReviewPatients ? (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                close(false);
                onReviewPatients();
              }}
            >
              Review patients <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button variant="ghost" asChild>
              <Link href={`/doctors/${doctor._id}#patients`}>
                Review patients <ArrowRight aria-hidden />
              </Link>
            </Button>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={!target || pending} onClick={submit}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Reassign &amp; archive
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
