"use client";

import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import Link from "next/link";
import { ErrorState, InitialsAvatar } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useLookups } from "@/features/lookups/api";
import type { Patient } from "@/lib/api";
import { ageFrom, formatDate } from "@/lib/utils";
import { usePatient } from "./api";
import { GENDER_LABEL } from "./patient-form";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/**
 * One patient's full record, opened from a list row. Driven by `?patient=<id>` so it can be
 * linked to (the command palette does) and closes with Back.
 */
export function PatientSheet({
  id,
  onClose,
  onEdit,
  onArchive,
  canArchive,
  statusBadge,
}: {
  id: string | undefined;
  onClose: () => void;
  onEdit: (patient: Patient) => void;
  onArchive: (patient: Patient) => void;
  canArchive: boolean;
  statusBadge: (patient: Patient) => React.ReactNode;
}) {
  const { data: patient, error, isPending, refetch } = usePatient(id);
  const { data: lookups } = useLookups();

  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {error ? (
          <>
            <SheetHeader>
              <SheetTitle>Patient</SheetTitle>
              <SheetDescription className="sr-only">Patient details</SheetDescription>
            </SheetHeader>
            <ErrorState error={error} onRetry={() => void refetch()} />
          </>
        ) : isPending || !patient ? (
          <>
            <SheetHeader>
              <SheetTitle className="sr-only">Loading patient</SheetTitle>
              <SheetDescription className="sr-only">Patient details</SheetDescription>
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </SheetHeader>
            <div className="space-y-3 px-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="border-b pb-4">
              <div className="flex items-center gap-3 pr-8">
                <InitialsAvatar name={patient.name} className="size-12 text-base" />
                <div className="min-w-0">
                  <SheetTitle className="text-lg break-words">{patient.name}</SheetTitle>
                  <SheetDescription className="flex flex-wrap items-center gap-2">
                    {statusBadge(patient)}
                    {patient.isArchived && <Badge variant="outline">Archived</Badge>}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-6 px-4 py-4">
              <section aria-labelledby="sheet-details">
                <h3 id="sheet-details" className="mb-1 text-sm font-semibold">
                  Details
                </h3>
                <dl className="divide-y">
                  <Row label="Age">
                    {ageFrom(patient.dateOfBirth)} (born {formatDate(patient.dateOfBirth)})
                  </Row>
                  <Row label="Gender">{GENDER_LABEL[patient.gender]}</Row>
                  <Row label="Phone">
                    <a href={`tel:${patient.phone}`} className="hover:underline">
                      {patient.phone}
                    </a>
                  </Row>
                  <Row label="Email">
                    {patient.email ? (
                      <a href={`mailto:${patient.email}`} className="hover:underline">
                        {patient.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Not provided</span>
                    )}
                  </Row>
                </dl>
              </section>

              <section aria-labelledby="sheet-admission">
                <h3 id="sheet-admission" className="mb-1 text-sm font-semibold">
                  Admission
                </h3>
                <dl className="divide-y">
                  <Row label="Condition">
                    {lookups?.conditionName.get(patient.condition) ?? "Unknown"}
                  </Row>
                  <Row label="Admitted">{formatDate(patient.admissionDate)}</Row>
                  <Row label="Doctor">
                    {patient.doctorName ? (
                      <Link
                        href={`/doctors/${patient.doctorId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {patient.doctorName}
                      </Link>
                    ) : (
                      "Unknown"
                    )}
                    {patient.doctorArchived && (
                      <Badge variant="outline" className="ml-2">
                        Archived
                      </Badge>
                    )}
                  </Row>
                </dl>
              </section>

              <section aria-labelledby="sheet-notes">
                <h3 id="sheet-notes" className="mb-2 text-sm font-semibold">
                  Notes
                </h3>
                {patient.notes ? (
                  <p className="rounded-md bg-muted/60 p-3 text-sm whitespace-pre-wrap">
                    {patient.notes}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No notes.</p>
                )}
              </section>
            </div>

            <SheetFooter className="mt-auto flex-row justify-end gap-2 border-t">
              {canArchive && (
                <Button variant="outline" onClick={() => onArchive(patient)}>
                  {patient.isArchived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
                  {patient.isArchived ? "Restore…" : "Archive…"}
                </Button>
              )}
              {!patient.isArchived && (
                <Button onClick={() => onEdit(patient)}>
                  <Pencil aria-hidden /> Edit
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
