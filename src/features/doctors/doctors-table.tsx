"use client";

import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState, InitialsAvatar, PageHeader, RoleGate, useIsAdmin } from "@/components/common";
import { DataTable, type Column } from "@/components/data-table";
import {
  ActiveFilters,
  ShowArchivedToggle,
  DateRangePicker,
  FilterBar,
  MultiSelectFilter,
  RangeInput,
  SearchInput,
} from "@/components/filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLookups } from "@/features/lookups/api";
import type { Doctor } from "@/lib/api";
import { compact, formatDate, numberFormat, plural, useUrlState } from "@/lib/utils";
import { useDoctors, type DoctorListParams } from "./api";
import { DoctorArchiveDialog, doctorArchiveLabel } from "./doctor-archive-dialog";
import { DoctorFormDialog } from "./doctor-form";

function SpecializationName({ id }: { id: string }) {
  const { data } = useLookups();
  return <>{data?.specializationName.get(id) ?? "-"}</>;
}

// Module-level so they aren't rebuilt on every render.
const COLUMNS: Column<Doctor>[] = [
  {
    id: "name",
    header: "Name",
    sortKey: "name",
    primary: true,
    cell: (d) => (
      <span className="flex min-w-0 items-center gap-3">
        <InitialsAvatar name={d.name} />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <Link
              href={`/doctors/${d._id}`}
              className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {d.name}
            </Link>
            {d.isArchived && <Badge variant="outline">Archived</Badge>}
          </span>
          <span className="block text-xs break-all text-muted-foreground">{d.email}</span>
        </span>
      </span>
    ),
  },
  {
    id: "specialization",
    header: "Specialization",
    cell: (d) => (
      <Badge variant="secondary" className="font-normal">
        <SpecializationName id={d.specialization} />
      </Badge>
    ),
  },
  { id: "hospital", header: "Hospital", cell: (d) => d.hospital },
  { id: "phone", header: "Phone", cell: (d) => d.phone, className: "hidden xl:table-cell" },
  {
    id: "patientCount",
    header: "Patients",
    sortKey: "patientCount",
    className: "text-right tabular-nums",
    cell: (d) => numberFormat.format(d.patientCount),
  },
  {
    id: "createdAt",
    header: "Added",
    sortKey: "createdAt",
    className: "hidden md:table-cell whitespace-nowrap",
    cell: (d) => formatDate(d.createdAt),
  },
];

const FILTER_KEYS = [
  "search",
  "specialization",
  "hospital",
  "createdFrom",
  "createdTo",
  "minPatients",
  "maxPatients",
] as const;

function useDoctorParams(): DoctorListParams {
  const url = useUrlState();
  const sort = url.get("sort");
  return {
    search: url.get("search"),
    specialization: url.getList("specialization"),
    hospital: url.get("hospital"),
    createdFrom: url.get("createdFrom"),
    createdTo: url.get("createdTo"),
    minPatients: url.getNumber("minPatients"),
    maxPatients: url.getNumber("maxPatients"),
    sort: sort === "name" || sort === "patientCount" ? sort : "createdAt",
    order: url.get("order") === "asc" ? "asc" : "desc",
    page: url.getNumber("page") ?? 1,
    pageSize: url.getNumber("pageSize") ?? 20,
    archived: url.get("archived") === "true",
  };
}

function DoctorRowActions({
  doctor,
  onEdit,
  onArchive,
}: {
  doctor: Doctor;
  onEdit: (doctor: Doctor) => void;
  onArchive: (doctor: Doctor) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${doctor.name}`}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!doctor.isArchived && (
          <DropdownMenuItem onSelect={() => onEdit(doctor)}>
            <Pencil aria-hidden /> Edit
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => onArchive(doctor)}>
          {doctor.isArchived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {doctorArchiveLabel(doctor)}…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DoctorsView() {
  const router = useRouter();
  const url = useUrlState();
  const params = useDoctorParams();
  const query = useDoctors(compact(params) as DoctorListParams);
  const { data: lookups } = useLookups();
  const isAdmin = useIsAdmin();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | undefined>();

  const [archiving, setArchiving] = useState<Doctor | undefined>();
  const [archiveOpen, setArchiveOpen] = useState(false);

  const openForm = (doctor?: Doctor) => {
    setEditing(doctor);
    setFormOpen(true);
  };
  const openArchive = (doctor: Doctor) => {
    setArchiving(doctor);
    setArchiveOpen(true);
  };
  const hasFilters = url.has(FILTER_KEYS);

  return (
    <>
      <PageHeader
        title={params.archived ? "Archived doctors" : "Doctors"}
        description={
          query.data
            ? plural(query.data.meta.total, `${params.archived ? "archived" : "active"} doctor`)
            : "Search, filter and manage doctors."
        }
        actions={
          <RoleGate role="admin">
            <Button onClick={() => openForm()}>
              <Plus aria-hidden /> Add doctor
            </Button>
          </RoleGate>
        }
      />

      <FilterBar
        canClear={hasFilters}
        onClear={() => url.clear(FILTER_KEYS)}
        activeCount={FILTER_KEYS.filter((k) => k !== "search" && url.get(k)).length}
        search={
          <SearchInput
            label="Search doctors"
            placeholder="Search name or email…"
            value={params.search ?? ""}
            onChange={(search) => url.set({ search })}
          />
        }
      >
        <MultiSelectFilter
          label="Specialization"
          options={lookups?.specializationOptions ?? []}
          selected={params.specialization ?? []}
          onChange={(v) => url.set({ specialization: v.join(",") })}
        />
        <SearchInput
          label="Filter by hospital"
          placeholder="Hospital…"
          className="sm:w-48"
          value={params.hospital ?? ""}
          onChange={(hospital) => url.set({ hospital })}
        />
        <DateRangePicker
          label="Date added"
          value={{ from: params.createdFrom, to: params.createdTo }}
          onChange={(r) => url.set({ createdFrom: r.from, createdTo: r.to })}
        />
        <RangeInput
          label="Patients"
          placeholder={["e.g. 10", "e.g. 100"]}
          min={params.minPatients}
          max={params.maxPatients}
          onChange={(r) => url.set({ minPatients: r.min, maxPatients: r.max })}
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
          ...(params.specialization ?? []).map((id) => ({
            key: `spec-${id}`,
            label: lookups?.specializationName.get(id) ?? "Specialization",
            onRemove: () =>
              url.set({
                specialization: (params.specialization ?? []).filter((x) => x !== id).join(","),
              }),
          })),
          ...(params.hospital
            ? [
                {
                  key: "hospital",
                  label: `Hospital: ${params.hospital}`,
                  onRemove: () => url.set({ hospital: null }),
                },
              ]
            : []),
          ...(params.createdFrom
            ? [
                {
                  key: "created",
                  label: `Added ${formatDate(params.createdFrom)} - ${formatDate(params.createdTo)}`,
                  onRemove: () => url.set({ createdFrom: null, createdTo: null }),
                },
              ]
            : []),
          ...(params.minPatients !== undefined || params.maxPatients !== undefined
            ? [
                {
                  key: "patients",
                  label: `Patients ${params.minPatients ?? 0} - ${params.maxPatients ?? "any"}`,
                  onRemove: () => url.set({ minPatients: null, maxPatients: null }),
                },
              ]
            : []),
        ]}
      />

      <DataTable
        onRowClick={(d) => router.push(`/doctors/${d._id}`)}
        caption="Doctors"
        columns={COLUMNS}
        data={query.data}
        getRowId={(d) => d._id}
        isPending={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        sort={{ sort: params.sort, order: params.order }}
        onSortChange={(s) => url.set({ sort: s.sort, order: s.order })}
        onPageChange={(page) => url.set({ page })}
        onPageSizeChange={(pageSize) => url.set({ pageSize })}
        rowActions={
          isAdmin
            ? (d) => <DoctorRowActions doctor={d} onEdit={openForm} onArchive={openArchive} />
            : undefined
        }
        rowClassName={(d) => (d.isArchived ? "text-muted-foreground" : undefined)}
        empty={
          <EmptyState
            title={hasFilters ? "No doctors match these filters" : "No doctors yet"}
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

      <DoctorFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        doctor={editing}
        onArchive={(d) => {
          setFormOpen(false);
          openArchive(d);
        }}
      />
      <DoctorArchiveDialog doctor={archiving} open={archiveOpen} onOpenChange={setArchiveOpen} />
    </>
  );
}
