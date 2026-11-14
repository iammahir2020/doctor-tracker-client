"use client";

import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog, EmptyState, PageHeader, RoleGate, useIsAdmin } from "@/components/common";
import { DataTable, type Column } from "@/components/data-table";
import {
  DateRangePicker,
  FilterBar,
  MultiSelectFilter,
  RangeInput,
  SearchInput,
} from "@/components/filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useLookups } from "@/features/lookups/api";
import type { Doctor } from "@/lib/api";
import { compact, formatDate, numberFormat, useUrlState } from "@/lib/utils";
import { useDoctors, useSetDoctorArchived, type DoctorListParams } from "./api";
import { DoctorFormDialog } from "./doctor-form";

function SpecializationName({ id }: { id: string }) {
  const { data } = useLookups();
  return <>{data?.specializationName.get(id) ?? "—"}</>;
}

// Module-level so they aren't rebuilt on every render.
const COLUMNS: Column<Doctor>[] = [
  {
    id: "name",
    header: "Name",
    sortKey: "name",
    primary: true,
    cell: (d) => (
      <span className="flex items-center gap-2">
        <Link
          href={`/doctors/${d._id}`}
          className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {d.name}
        </Link>
        {d.isArchived && <Badge variant="outline">Archived</Badge>}
      </span>
    ),
  },
  {
    id: "specialization",
    header: "Specialization",
    cell: (d) => <SpecializationName id={d.specialization} />,
  },
  { id: "hospital", header: "Hospital", cell: (d) => d.hospital },
  { id: "email", header: "Email", cell: (d) => d.email, className: "hidden lg:table-cell" },
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

export function DoctorRowActions({
  doctor,
  onEdit,
}: {
  doctor: Doctor;
  onEdit: (doctor: Doctor) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const setArchived = useSetDoctorArchived();
  const archive = !doctor.isArchived;

  return (
    <>
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
          <DropdownMenuItem onSelect={() => setConfirming(true)}>
            {archive ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
            {archive ? "Archive" : "Restore"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={archive ? `Archive ${doctor.name}?` : `Restore ${doctor.name}?`}
        description={
          archive
            ? "Archiving removes the doctor from active lists and the dashboard. Nothing is deleted, and an admin can restore them later. Doctors with active patients can't be archived."
            : "The doctor will appear in lists, search and the dashboard again."
        }
        confirmLabel={archive ? "Archive" : "Restore"}
        destructive={archive}
        onConfirm={() => setArchived.mutateAsync({ id: doctor._id, archive })}
      />
    </>
  );
}

export function DoctorsView() {
  const url = useUrlState();
  const params = useDoctorParams();
  const query = useDoctors(compact(params) as DoctorListParams);
  const { data: lookups } = useLookups();
  const isAdmin = useIsAdmin();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | undefined>();

  const openForm = (doctor?: Doctor) => {
    setEditing(doctor);
    setFormOpen(true);
  };
  const hasFilters = url.has(FILTER_KEYS);

  return (
    <>
      <PageHeader
        title={params.archived ? "Archived doctors" : "Doctors"}
        description={
          query.data
            ? `${numberFormat.format(query.data.meta.total)} ${params.archived ? "archived" : "active"} doctors`
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

      <FilterBar canClear={hasFilters} onClear={() => url.clear(FILTER_KEYS)}>
        <SearchInput
          label="Search doctors"
          placeholder="Search name or email…"
          value={params.search ?? ""}
          onChange={(search) => url.set({ search })}
        />
        <MultiSelectFilter
          label="Specialization"
          options={lookups?.specializationOptions ?? []}
          selected={params.specialization ?? []}
          onChange={(v) => url.set({ specialization: v.join(",") })}
        />
        <div className="w-full sm:w-48">
          <SearchInput
            label="Filter by hospital"
            placeholder="Hospital…"
            value={params.hospital ?? ""}
            onChange={(hospital) => url.set({ hospital })}
          />
        </div>
        <DateRangePicker
          label="Date added"
          value={{ from: params.createdFrom, to: params.createdTo }}
          onChange={(r) => url.set({ createdFrom: r.from, createdTo: r.to })}
        />
        <RangeInput
          label="Patients"
          min={params.minPatients}
          max={params.maxPatients}
          onChange={(r) => url.set({ minPatients: r.min, maxPatients: r.max })}
        />
        {isAdmin && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <Checkbox
              id="show-archived"
              checked={params.archived}
              onCheckedChange={(v) => url.set({ archived: v === true })}
            />
            <Label htmlFor="show-archived" className="font-normal">
              Show archived
            </Label>
          </div>
        )}
      </FilterBar>

      <DataTable
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
        rowActions={isAdmin ? (d) => <DoctorRowActions doctor={d} onEdit={openForm} /> : undefined}
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

      <DoctorFormDialog open={formOpen} onOpenChange={setFormOpen} doctor={editing} />
    </>
  );
}
