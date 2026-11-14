"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ConfirmDialog,
  EmptyState,
  InitialsAvatar,
  PageHeader,
  useIsAdmin,
} from "@/components/common";
import { DataTable, type Column } from "@/components/data-table";
import {
  ActiveFilters,
  ShowArchivedToggle,
  DateRangePicker,
  FilterBar,
  MultiSelectFilter,
  RangeInput,
  SearchInput,
  SelectFilter,
} from "@/components/filters";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { DoctorPicker } from "@/features/doctors/doctor-picker";
import { useLookups } from "@/features/lookups/api";
import { ApiError, GENDERS, PATIENT_STATUSES, type Patient, type PatientStatus } from "@/lib/api";
import { ageFrom, cn, compact, formatDate, plural, useUrlState } from "@/lib/utils";
import { useSetPatientArchived, usePatients, type PatientListParams } from "./api";
import { GENDER_LABEL, PatientFormDialog, STATUS_LABEL } from "./patient-form";
import { PatientSheet } from "./patient-sheet";

const STATUS_STYLE: Record<PatientStatus, string> = {
  active: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  recovered: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  critical: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

export function StatusBadge({ status }: { status: PatientStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLE[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** Opens the patient panel; a real link, so it also works with middle-click and the keyboard. */
function PatientLink({ patient }: { patient: Patient }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const next = new URLSearchParams(searchParams.toString());
  next.set("patient", patient._id);
  return (
    <Link
      href={`${pathname}?${next.toString()}`}
      scroll={false}
      className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
    >
      {patient.name}
    </Link>
  );
}

function ConditionName({ id }: { id: string }) {
  const { data } = useLookups();
  return <>{data?.conditionName.get(id) ?? "-"}</>;
}

/** Phone layout: three short lines instead of a label/value list of every column. */
function PatientMobileRow({ patient, showDoctor }: { patient: Patient; showDoctor: boolean }) {
  return (
    <div className="flex min-w-0 gap-3">
      <InitialsAvatar name={patient.name} className="size-9" />
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <PatientLink patient={patient} />
          <StatusBadge status={patient.status} />
          {patient.isArchived && <Badge variant="outline">Archived</Badge>}
        </p>
        <p className="text-xs text-muted-foreground">
          {ageFrom(patient.dateOfBirth)} · {GENDER_LABEL[patient.gender]} ·{" "}
          <ConditionName id={patient.condition} />
        </p>
        <p className="text-xs text-muted-foreground">
          {showDoctor && patient.doctorName ? `${patient.doctorName} · ` : "Admitted "}
          <span className="whitespace-nowrap">{formatDate(patient.admissionDate)}</span>
        </p>
      </div>
    </div>
  );
}

// Module-level so they aren't rebuilt on every render.
const COLUMNS: Column<Patient>[] = [
  {
    id: "name",
    header: "Name",
    sortKey: "name",
    primary: true,
    cell: (p) => (
      <span className="flex min-w-0 items-center gap-3">
        <InitialsAvatar name={p.name} />
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <PatientLink patient={p} />
          {p.isArchived && <Badge variant="outline">Archived</Badge>}
        </span>
      </span>
    ),
  },
  {
    id: "age",
    header: "Age",
    sortKey: "age",
    className: "tabular-nums",
    cell: (p) => ageFrom(p.dateOfBirth),
  },
  { id: "gender", header: "Gender", cell: (p) => GENDER_LABEL[p.gender] },
  { id: "condition", header: "Condition", cell: (p) => <ConditionName id={p.condition} /> },
  { id: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
  {
    id: "doctor",
    header: "Doctor",
    cell: (p) =>
      p.doctorName ? (
        <Link href={`/doctors/${p.doctorId}`} className="hover:underline focus-visible:underline">
          {p.doctorName}
        </Link>
      ) : (
        "-"
      ),
  },
  {
    id: "admissionDate",
    header: "Admitted",
    sortKey: "admissionDate",
    className: "whitespace-nowrap",
    cell: (p) => formatDate(p.admissionDate),
  },
  { id: "phone", header: "Phone", className: "hidden xl:table-cell", cell: (p) => p.phone },
];
const COLUMNS_FOR_DOCTOR = COLUMNS.filter((c) => c.id !== "doctor");

const STATUS_OPTIONS = PATIENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));
const GENDER_OPTIONS = GENDERS.map((g) => ({ value: g, label: GENDER_LABEL[g] }));

const FILTER_KEYS = [
  "search",
  "condition",
  "status",
  "gender",
  "admittedFrom",
  "admittedTo",
  "minAge",
  "maxAge",
] as const;

function usePatientParams(doctorId: string | undefined): PatientListParams {
  const url = useUrlState();
  const sort = url.get("sort");
  return {
    search: url.get("search"),
    condition: url.getList("condition"),
    status: url
      .getList("status")
      .filter((s): s is PatientStatus => (PATIENT_STATUSES as readonly string[]).includes(s)),
    gender: url.get("gender"),
    admittedFrom: url.get("admittedFrom"),
    admittedTo: url.get("admittedTo"),
    minAge: url.getNumber("minAge"),
    maxAge: url.getNumber("maxAge"),
    doctorId,
    sort: sort === "name" || sort === "age" ? sort : "admissionDate",
    order: url.get("order") === "asc" ? "asc" : "desc",
    page: url.getNumber("page") ?? 1,
    pageSize: url.getNumber("pageSize") ?? 20,
    archived: url.get("archived") === "true",
  };
}

function PatientRowActions({
  patient,
  onEdit,
  onArchive,
}: {
  patient: Patient;
  onEdit: (patient: Patient) => void;
  onArchive: (patient: Patient) => void;
}) {
  const isAdmin = useIsAdmin();
  // Staff can edit but not archive; an archived patient can only be restored (admin).
  if (!isAdmin && patient.isArchived) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${patient.name}`}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!patient.isArchived && (
          <DropdownMenuItem onSelect={() => onEdit(patient)}>
            <Pencil aria-hidden /> Edit
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem onSelect={() => onArchive(patient)}>
            {patient.isArchived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {patient.isArchived ? "Restore…" : "Archive…"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Archive or restore a patient. If their doctor has been archived, a plain Restore would be
 * refused, so this explains why and offers the two ways forward instead: restore the doctor, or
 * restore the patient under another doctor.
 */
function PatientArchiveDialog({
  patient,
  open,
  onOpenChange,
}: {
  patient: Patient | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setArchived = useSetPatientArchived();
  const [doctorId, setDoctorId] = useState("");

  if (!patient) return null;
  const archive = !patient.isArchived;

  if (archive || !patient.doctorArchived) {
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title={archive ? `Archive ${patient.name}?` : `Restore ${patient.name}?`}
        description={
          archive
            ? "Archiving removes the patient from active lists, search and the dashboard, and from their doctor's patient count. The record is kept, and an admin can restore it later."
            : "The patient will appear in lists, search and the dashboard again."
        }
        confirmLabel={archive ? "Archive" : "Restore"}
        destructive={archive}
        onConfirm={() => setArchived.mutateAsync({ id: patient._id, archive })}
      />
    );
  }

  const close = (next: boolean) => {
    if (setArchived.isPending) return;
    if (!next) {
      setDoctorId("");
      setArchived.reset();
    }
    onOpenChange(next);
  };
  const error = setArchived.error instanceof ApiError ? setArchived.error.message : null;

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{patient.doctorName ?? "Their doctor"} is archived</AlertDialogTitle>
          <AlertDialogDescription>
            {patient.name} can&apos;t go back to an archived doctor. Restore the doctor first, or
            restore {patient.name} under another doctor.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="restore-doctor">Restore under</Label>
          <DoctorPicker
            id="restore-doctor"
            value={doctorId}
            excludeId={patient.doctorId}
            onChange={setDoctorId}
          />
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
          <Button variant="ghost" asChild>
            <Link href={`/doctors/${patient.doctorId}`}>
              Open {patient.doctorName ?? "doctor"} <ArrowRight aria-hidden />
            </Link>
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <AlertDialogCancel disabled={setArchived.isPending}>Cancel</AlertDialogCancel>
            <Button
              disabled={!doctorId || setArchived.isPending}
              onClick={() =>
                setArchived.mutate(
                  { id: patient._id, archive: false, doctorId },
                  { onSuccess: () => close(false) },
                )
              }
            >
              {setArchived.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Restore under this doctor
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The patients list. On a doctor's page it is scoped to that doctor: no doctor column or filter,
 * and new patients are assigned to them.
 */
export function PatientsTable({
  doctor,
  headerSlot,
}: {
  doctor?: { _id: string; name: string; isArchived: boolean };
  /** Rendered above the filters, receives the "Add patient" button. */
  headerSlot: (props: { total: number | undefined; addButton: React.ReactNode }) => React.ReactNode;
}) {
  const url = useUrlState();
  const params = usePatientParams(doctor?._id);
  const query = usePatients(compact(params) as PatientListParams);
  const { data: lookups } = useLookups();
  const isAdmin = useIsAdmin();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | undefined>();

  const [archiving, setArchiving] = useState<Patient | undefined>();
  const [archiveOpen, setArchiveOpen] = useState(false);

  const openForm = (patient?: Patient) => {
    setEditing(patient);
    setFormOpen(true);
  };
  const openArchive = (patient: Patient) => {
    setArchiving(patient);
    setArchiveOpen(true);
  };
  // The panel lives in the URL (?patient=id); keep the current page when opening/closing it.
  const keepPage = params.page === 1 ? null : params.page;
  const openPatient = (id: string) => url.set({ patient: id, page: keepPage });
  const hasFilters = url.has(FILTER_KEYS);

  const addButton = doctor?.isArchived ? null : (
    <Button onClick={() => openForm()}>
      <Plus aria-hidden /> Add patient
    </Button>
  );

  return (
    <>
      {headerSlot({ total: query.data?.meta.total, addButton })}

      <FilterBar
        canClear={hasFilters}
        onClear={() => url.clear(FILTER_KEYS)}
        activeCount={FILTER_KEYS.filter((k) => k !== "search" && url.get(k)).length}
        search={
          <SearchInput
            label="Search patients"
            placeholder="Search name or email…"
            value={params.search ?? ""}
            onChange={(search) => url.set({ search })}
          />
        }
      >
        <MultiSelectFilter
          label="Condition"
          options={lookups?.conditionOptions ?? []}
          selected={params.condition ?? []}
          onChange={(v) => url.set({ condition: v.join(",") })}
        />
        <MultiSelectFilter
          label="Status"
          options={STATUS_OPTIONS}
          selected={params.status ?? []}
          onChange={(v) => url.set({ status: v.join(",") })}
        />
        <SelectFilter
          label="Genders"
          options={GENDER_OPTIONS}
          value={params.gender}
          onChange={(gender) => url.set({ gender })}
        />
        <DateRangePicker
          label="Admitted"
          value={{ from: params.admittedFrom, to: params.admittedTo }}
          onChange={(r) => url.set({ admittedFrom: r.from, admittedTo: r.to })}
        />
        <RangeInput
          label="Age"
          placeholder={["e.g. 18", "e.g. 65"]}
          min={params.minAge}
          max={params.maxAge}
          onChange={(r) => url.set({ minAge: r.min, maxAge: r.max })}
        />
        {isAdmin && (
          <ShowArchivedToggle
            checked={Boolean(params.archived)}
            onChange={(v) => url.set({ archived: v })}
          />
        )}
      </FilterBar>

      <ActiveFilters
        onClearAll={() => url.clear(FILTER_KEYS)}
        chips={[
          ...(params.condition ?? []).map((id) => ({
            key: `condition-${id}`,
            label: lookups?.conditionName.get(id) ?? "Condition",
            onRemove: () =>
              url.set({ condition: (params.condition ?? []).filter((x) => x !== id).join(",") }),
          })),
          ...(params.status ?? []).map((st) => ({
            key: `status-${st}`,
            label: STATUS_LABEL[st],
            onRemove: () =>
              url.set({ status: (params.status ?? []).filter((x) => x !== st).join(",") }),
          })),
          ...(params.gender
            ? [
                {
                  key: "gender",
                  label: GENDER_LABEL[params.gender as keyof typeof GENDER_LABEL] ?? params.gender,
                  onRemove: () => url.set({ gender: null }),
                },
              ]
            : []),
          ...(params.admittedFrom
            ? [
                {
                  key: "admitted",
                  label: `Admitted ${formatDate(params.admittedFrom)} - ${formatDate(params.admittedTo)}`,
                  onRemove: () => url.set({ admittedFrom: null, admittedTo: null }),
                },
              ]
            : []),
          ...(params.minAge !== undefined || params.maxAge !== undefined
            ? [
                {
                  key: "age",
                  label: `Age ${params.minAge ?? 0} - ${params.maxAge ?? "any"}`,
                  onRemove: () => url.set({ minAge: null, maxAge: null }),
                },
              ]
            : []),
        ]}
      />

      <DataTable
        onRowClick={(p) => openPatient(p._id)}
        renderMobileRow={(p) => <PatientMobileRow patient={p} showDoctor={!doctor} />}
        caption={doctor ? `Patients of ${doctor.name}` : "Patients"}
        columns={doctor ? COLUMNS_FOR_DOCTOR : COLUMNS}
        data={query.data}
        getRowId={(p) => p._id}
        isPending={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        sort={{ sort: params.sort, order: params.order }}
        onSortChange={(s) => url.set({ sort: s.sort, order: s.order })}
        onPageChange={(page) => url.set({ page })}
        onPageSizeChange={(pageSize) => url.set({ pageSize })}
        rowActions={(p) => (
          <PatientRowActions patient={p} onEdit={openForm} onArchive={openArchive} />
        )}
        rowClassName={(p) => cn(p.isArchived && "text-muted-foreground")}
        empty={
          <EmptyState
            title={
              hasFilters
                ? "No patients match these filters"
                : params.archived
                  ? "No archived patients"
                  : "No patients yet"
            }
            description={hasFilters ? "Try a different search or clear the filters." : undefined}
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={() => url.clear(FILTER_KEYS)}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />

      <PatientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        patient={editing}
        doctor={doctor}
        onArchive={
          isAdmin
            ? (p) => {
                setFormOpen(false);
                openArchive(p);
              }
            : undefined
        }
      />
      <PatientArchiveDialog patient={archiving} open={archiveOpen} onOpenChange={setArchiveOpen} />
      <PatientSheet
        id={url.get("patient")}
        onClose={() => url.set({ patient: null, page: keepPage })}
        onEdit={(p) => openForm(p)}
        onArchive={openArchive}
        canArchive={isAdmin}
        statusBadge={(p) => <StatusBadge status={p.status} />}
      />
    </>
  );
}

/** The /patients page. */
export function PatientsView() {
  const archived = useUrlState().get("archived") === "true";
  return (
    <PatientsTable
      headerSlot={({ total, addButton }) => (
        <PageHeader
          title={archived ? "Archived patients" : "Patients"}
          description={
            total === undefined
              ? "Search, filter and manage patients."
              : plural(total, `${archived ? "archived" : "active"} patient`)
          }
          actions={archived ? null : addButton}
        />
      )}
    />
  );
}
