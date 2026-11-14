"use client";

import { Archive, ArchiveRestore, ArrowLeft, Building2, Mail, Pencil, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog, ErrorState, RoleGate } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLookups } from "@/features/lookups/api";
import { PatientsTable } from "@/features/patients/patients-table";
import { ApiError } from "@/lib/api";
import { formatDate, numberFormat } from "@/lib/utils";
import { useDoctor, useSetDoctorArchived } from "./api";
import { DoctorFormDialog } from "./doctor-form";

export function DoctorDetail({ id }: { id: string }) {
  const { data: doctor, isPending, error, refetch } = useDoctor(id);
  const { data: lookups } = useLookups();
  const setArchived = useSetDoctorArchived();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const back = (
    <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
      <Link href="/doctors">
        <ArrowLeft aria-hidden /> Doctors
      </Link>
    </Button>
  );

  if (error) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <>
        {back}
        <ErrorState
          error={notFound ? new ApiError(404, "NOT_FOUND", "This doctor doesn't exist.") : error}
          onRetry={notFound ? undefined : () => void refetch()}
        />
      </>
    );
  }

  if (isPending) {
    return (
      <>
        {back}
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-6 h-4 w-40" />
        <Skeleton className="h-28 w-full" />
      </>
    );
  }

  const archive = !doctor.isArchived;

  return (
    <>
      {back}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {doctor.name}
            {doctor.isArchived && <Badge variant="outline">Archived</Badge>}
          </h1>
          <p className="text-muted-foreground">
            {lookups?.specializationName.get(doctor.specialization) ?? "—"}
          </p>
        </div>
        <RoleGate role="admin">
          <div className="flex shrink-0 gap-2">
            {!doctor.isArchived && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden /> Edit
              </Button>
            )}
            <Button variant="outline" onClick={() => setConfirming(true)}>
              {archive ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
              {archive ? "Archive" : "Restore"}
            </Button>
          </div>
        </RoleGate>
      </div>

      {doctor.isArchived && (
        <p className="mb-4 rounded-md border bg-muted px-3 py-2 text-sm">
          This doctor is archived. They are hidden from lists and the dashboard, and can&apos;t
          receive new patients until restored.
        </p>
      )}

      <Card className="mb-8">
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info icon={Building2} label="Hospital" value={doctor.hospital} />
          <Info
            icon={Mail}
            label="Email"
            value={
              <a href={`mailto:${doctor.email}`} className="hover:underline">
                {doctor.email}
              </a>
            }
          />
          <Info
            icon={Phone}
            label="Phone"
            value={
              <a href={`tel:${doctor.phone}`} className="hover:underline">
                {doctor.phone}
              </a>
            }
          />
          <div className="flex gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Active patients</p>
              <p className="text-2xl font-semibold tabular-nums">
                {numberFormat.format(doctor.patientCount)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Added</p>
              <p className="mt-1.5 text-sm">{formatDate(doctor.createdAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <PatientsTable
        doctor={doctor}
        headerSlot={({ total, addButton }) => (
          <div className="mb-4 flex items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Patients</h2>
              {total !== undefined && (
                <p className="text-sm text-muted-foreground">
                  {numberFormat.format(total)} shown with the current filters
                </p>
              )}
            </div>
            {addButton}
          </div>
        )}
      />

      <DoctorFormDialog open={editing} onOpenChange={setEditing} doctor={doctor} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={archive ? `Archive ${doctor.name}?` : `Restore ${doctor.name}?`}
        description={
          archive
            ? doctor.patientCount > 0
              ? `${doctor.name} has ${doctor.patientCount} active patients. Reassign or archive them first, then archive the doctor.`
              : "Archiving removes the doctor from active lists and the dashboard. Nothing is deleted, and an admin can restore them later."
            : "The doctor will appear in lists, search and the dashboard again."
        }
        confirmLabel={archive ? "Archive" : "Restore"}
        destructive={archive}
        onConfirm={() => setArchived.mutateAsync({ id: doctor._id, archive })}
      />
    </>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="truncate">{value}</p>
      </div>
    </div>
  );
}
