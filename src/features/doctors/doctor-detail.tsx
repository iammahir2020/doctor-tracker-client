"use client";

import {
  Archive,
  ArchiveRestore,
  Building2,
  ChevronRight,
  Mail,
  Pencil,
  Phone,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ErrorState, InitialsAvatar, RoleGate } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLookups } from "@/features/lookups/api";
import { usePatients } from "@/features/patients/api";
import { PatientsTable } from "@/features/patients/patients-table";
import { ApiError, type Doctor } from "@/lib/api";
import { cn, formatDate, numberFormat, toDateParam } from "@/lib/utils";
import { useDoctor } from "./api";
import { DoctorArchiveDialog, doctorArchiveLabel } from "./doctor-archive-dialog";
import { DoctorFormDialog } from "./doctor-form";

export function DoctorDetail({ id }: { id: string }) {
  const { data: doctor, isPending, error, refetch } = useDoctor(id);
  const { data: lookups } = useLookups();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const back = (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm">
      <ol className="flex items-center gap-1.5 text-muted-foreground">
        <li>
          <Link href="/doctors" className="hover:text-foreground hover:underline">
            Doctors
          </Link>
        </li>
        <li aria-hidden>
          <ChevronRight className="size-3.5" />
        </li>
        <li aria-current="page" className="truncate font-medium text-foreground">
          {doctor?.name ?? "Doctor"}
        </li>
      </ol>
    </nav>
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
        <div className="flex min-w-0 items-center gap-4">
          <InitialsAvatar name={doctor.name} className="size-11 text-base sm:size-14 sm:text-lg" />
          <div className="min-w-0 space-y-1.5">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
              {doctor.name}
              {doctor.isArchived && <Badge variant="outline">Archived</Badge>}
            </h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="font-normal">
                {lookups?.specializationName.get(doctor.specialization) ?? "Unknown specialization"}
              </Badge>
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5" aria-hidden />
                {doctor.hospital}
              </span>
            </p>
          </div>
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
              {doctorArchiveLabel(doctor)}
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

      <DoctorStats doctor={doctor} />

      <div className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <a
          href={`mailto:${doctor.email}`}
          className="inline-flex items-center gap-1.5 [overflow-wrap:anywhere] hover:underline"
        >
          <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {doctor.email}
        </a>
        <a
          href={`tel:${doctor.phone}`}
          className="inline-flex items-center gap-1.5 hover:underline"
        >
          <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {doctor.phone}
        </a>
      </div>

      <section id="patients" aria-label="Patients" className="scroll-mt-20">
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
      </section>

      <DoctorFormDialog
        open={editing}
        onOpenChange={setEditing}
        doctor={doctor}
        onArchive={() => {
          setEditing(false);
          setConfirming(true);
        }}
      />
      <DoctorArchiveDialog
        doctor={doctor}
        open={confirming}
        onOpenChange={setConfirming}
        onReviewPatients={() =>
          document.getElementById("patients")?.scrollIntoView({ behavior: "smooth" })
        }
      />
    </>
  );
}

/** Live numbers for this doctor, from the same patient list endpoint (one count query each). */
function DoctorStats({ doctor }: { doctor: Doctor }) {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(today.getDate() - 29);
  const critical = usePatients({
    doctorId: doctor._id,
    status: ["critical"],
    sort: "admissionDate",
    order: "desc",
    page: 1,
    pageSize: 1,
  });
  const recent = usePatients({
    doctorId: doctor._id,
    admittedFrom: toDateParam(monthAgo),
    admittedTo: toDateParam(today),
    sort: "admissionDate",
    order: "desc",
    page: 1,
    pageSize: 1,
  });

  const tiles = [
    { label: "Active patients", value: numberFormat.format(doctor.patientCount) },
    {
      label: "Critical",
      value: critical.data ? numberFormat.format(critical.data.meta.total) : undefined,
      critical: (critical.data?.meta.total ?? 0) > 0,
    },
    {
      label: "Admitted, last 30 days",
      value: recent.data ? numberFormat.format(recent.data.meta.total) : undefined,
    },
    { label: "Added", value: formatDate(doctor.createdAt) },
  ];

  return (
    <dl className="mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label} className="gap-1 py-3 sm:py-4">
          <CardContent className="px-3 sm:px-4">
            <dt className="text-xs text-muted-foreground sm:text-sm">{t.label}</dt>
            <dd
              className={cn(
                "mt-0.5 text-lg font-semibold tracking-tight tabular-nums sm:mt-1 sm:text-2xl",
                t.critical && "text-[var(--viz-critical)]",
              )}
            >
              {t.value ?? <Skeleton className="h-8 w-12" />}
            </dd>
          </CardContent>
        </Card>
      ))}
    </dl>
  );
}
