"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorState } from "@/components/common";
import type { Paged } from "@/lib/api";
import { cn, numberFormat, useMediaQuery } from "@/lib/utils";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Server sort key; makes the header clickable. */
  sortKey?: string;
  className?: string;
  /** Shown as the card title on mobile instead of a label/value row. */
  primary?: boolean;
  /** Left out of the mobile card (e.g. a column repeated in the title). */
  hideOnMobile?: boolean;
};

export type SortState = { sort: string; order: "asc" | "desc" };

type DataTableProps<T> = {
  columns: Column<T>[];
  data: Paged<T> | undefined;
  getRowId: (row: T) => string;
  isPending: boolean;
  isFetching?: boolean;
  error: unknown;
  onRetry: () => void;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** Row-level actions (menu), shown in the last column and in the card header. */
  rowActions?: (row: T) => React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
  /**
   * Makes the whole row open the record. The row's own link/button stays the keyboard and
   * screen-reader path, so clicks that land on any interactive element are left alone.
   */
  onRowClick?: (row: T) => void;
  empty: React.ReactNode;
  caption: string;
};

export const PAGE_SIZES = [10, 20, 50] as const;

function SortHeader<T>({
  column,
  sort,
  onSortChange,
}: {
  column: Column<T>;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}) {
  if (!column.sortKey) return <>{column.header}</>;
  const active = sort.sort === column.sortKey;
  const Icon = !active ? ArrowUpDown : sort.order === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      className="-ml-2 inline-flex h-8 items-center gap-1 rounded-md px-2 font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={() =>
        onSortChange({
          sort: column.sortKey as string,
          order: active && sort.order === "asc" ? "desc" : "asc",
        })
      }
    >
      {column.header}
      <Icon className={cn("size-3.5", !active && "text-muted-foreground/60")} aria-hidden />
      <span className="sr-only">
        {active ? `sorted ${sort.order === "asc" ? "ascending" : "descending"}` : "sortable"}
      </span>
    </button>
  );
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isPending,
  isFetching = false,
  error,
  onRetry,
  sort,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  rowActions,
  rowClassName,
  onRowClick,
  empty,
  caption,
}: DataTableProps<T>) {
  // Render only the layout in use (not both with one hidden by CSS): half the DOM for 50 rows.
  const isDesktop = useMediaQuery("(min-width: 768px)", true);
  if (error && !data) {
    return (
      <div className="rounded-lg border">
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  const rows = data?.data ?? [];
  const rowClick = (row: T) => (e: React.MouseEvent) => {
    if (!onRowClick) return;
    if ((e.target as HTMLElement).closest("a, button, input, [role='menuitem'], [role='dialog']")) {
      return;
    }
    onRowClick(row);
  };
  const showSkeleton = isPending && !data;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const ariaSort = (c: Column<T>) =>
    c.sortKey && sort.sort === c.sortKey
      ? sort.order === "asc"
        ? ("ascending" as const)
        : ("descending" as const)
      : undefined;

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-lg border transition-opacity",
          isFetching && !showSkeleton && "opacity-70",
        )}
        aria-busy={isFetching}
      >
        {/* Desktop / tablet: table */}
        {/* Before data arrives the layout is picked by CSS (it's in the server HTML, so no jump);
            once rows exist, only the layout in use is rendered. */}
        {showSkeleton && (
          <>
            <div className="hidden md:block" aria-hidden>
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((c) => (
                      <TableHead key={c.id} className={c.className}>
                        {c.header}
                      </TableHead>
                    ))}
                    {rowActions && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }, (_, i) => (
                    <TableRow key={i}>
                      {columns.map((c) => (
                        <TableCell key={c.id} className={c.className}>
                          <Skeleton className="h-4 w-full max-w-40" />
                        </TableCell>
                      ))}
                      {rowActions && <TableCell />}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y md:hidden" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="space-y-2 p-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-4 w-32" />
                </li>
              ))}
            </ul>
          </>
        )}
        {showSkeleton ? null : isDesktop ? (
          <div>
            <Table>
              <caption className="sr-only">{caption}</caption>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.id} className={c.className} aria-sort={ariaSort(c)}>
                      <SortHeader column={c} sort={sort} onSortChange={onSortChange} />
                    </TableHead>
                  ))}
                  {rowActions && (
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={getRowId(row)}
                    className={cn(onRowClick && "cursor-pointer", rowClassName?.(row))}
                    onClick={rowClick(row)}
                  >
                    {columns.map((c) => (
                      <TableCell key={c.id} className={c.className}>
                        {c.cell(row)}
                      </TableCell>
                    ))}
                    {rowActions && <TableCell className="text-right">{rowActions(row)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <ul className="divide-y" aria-label={caption}>
            {rows.map((row) => (
              <li
                key={getRowId(row)}
                className={cn(
                  "space-y-2 p-4",
                  onRowClick && "cursor-pointer active:bg-muted/50",
                  rowClassName?.(row),
                )}
                onClick={rowClick(row)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 font-medium">{primary?.cell(row)}</div>
                  {rowActions?.(row)}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {columns
                    .filter((c) => c !== primary && !c.hideOnMobile)
                    .map((c) => (
                      <div key={c.id} className="contents">
                        <dt className="text-muted-foreground">{c.header}</dt>
                        <dd className="min-w-0 break-words">{c.cell(row)}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
          </ul>
        )}

        {!showSkeleton && rows.length === 0 && empty}
      </div>

      {data && data.meta.total > 0 && (
        <Pagination
          meta={data.meta}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}

function Pagination({
  meta,
  onPageChange,
  onPageSizeChange,
}: {
  meta: Paged<unknown>["meta"];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col-reverse items-center justify-between gap-3 text-sm sm:flex-row"
    >
      <p className="text-muted-foreground" aria-live="polite">
        {numberFormat.format(from)}–{numberFormat.format(to)} of {numberFormat.format(meta.total)}
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-muted-foreground">
          <span className="hidden sm:inline">Rows</span>
          <Select value={String(meta.pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger size="sm" className="w-[4.5rem]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden />
        </Button>
        <span className="min-w-20 text-center tabular-nums">
          Page {meta.page} of {meta.totalPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
          aria-label="Next page"
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
