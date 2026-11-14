"use client";

import { endOfDay, startOfDay, subDays, subMonths, startOfYear } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDate, toDateParam, useDebounce, useMediaQuery } from "@/lib/utils";

export type Option = { value: string; label: string };

/**
 * Search is always visible. The other filters sit inline on wider screens and in a bottom sheet
 * on phones, where five rows of controls would push the results off screen.
 */
export function FilterBar({
  search,
  children,
  onClear,
  canClear,
  activeCount,
}: {
  search: React.ReactNode;
  children: React.ReactNode;
  onClear: () => void;
  canClear: boolean;
  /** Filters other than search that are set, shown on the mobile button. */
  activeCount: number;
}) {
  // Server renders the desktop layout; phones switch after hydration.
  const isDesktop = useMediaQuery("(min-width: 640px)", true);
  const clear = canClear && (
    <Button variant="ghost" size="sm" onClick={onClear}>
      <X aria-hidden /> Clear filters
    </Button>
  );

  if (isDesktop) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2" role="search">
        {search}
        {children}
        {clear}
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-center gap-2" role="search">
      <div className="min-w-0 flex-1">{search}</div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" aria-label={`Filters, ${activeCount} active`}>
            <SlidersHorizontal aria-hidden />
            Filters
            {activeCount > 0 && (
              <Badge variant="secondary" className="rounded-sm px-1.5">
                {activeCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col items-stretch gap-3 px-4 pb-6 [&>button]:w-full [&>button]:justify-start">
            {children}
            {clear}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * Keeps its own state while typing and only reports the debounced value, so each keystroke
 * re-renders this input, not the table.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className = "sm:w-64",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  /** Width at sm+; below sm every filter takes the full row. */
  className?: string;
}) {
  const [text, setText] = useState(value);
  const debounced = useDebounce(text.trim(), 300);

  // Follow outside changes (e.g. "Clear filters" or Back/Forward) without an extra effect pass.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value);
  }

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced text
  }, [debounced]);

  return (
    <div className={cn("relative w-full", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const chosen = new Set(selected);
  const toggle = (value: string) => {
    const next = new Set(chosen);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange([...next]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          {label}
          {chosen.size > 0 && (
            <Badge variant="secondary" className="rounded-sm px-1.5 font-normal">
              {chosen.size === 1
                ? (options.find((o) => chosen.has(o.value))?.label ?? "1")
                : `${chosen.size} selected`}
            </Badge>
          )}
          <ChevronsUpDown className="text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder={label} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-sm border",
                      chosen.has(o.value)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "opacity-60",
                    )}
                    aria-hidden
                  >
                    {chosen.has(o.value) && <Check className="size-3" />}
                  </span>
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {chosen.size > 0 && (
            <div className="border-t p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => onChange([])}
              >
                Clear
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SelectFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Select value={value ?? "all"} onValueChange={(v) => onChange(v === "all" ? undefined : v)}>
      <SelectTrigger className="w-auto min-w-32" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type DateRangeValue = { from?: string; to?: string };

export const DATE_PRESETS: { label: string; range: () => { from: Date; to: Date } }[] = [
  { label: "Last 7 days", range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "Last 30 days", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "Last 3 months", range: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
  { label: "Last 12 months", range: () => ({ from: subMonths(new Date(), 12), to: new Date() }) },
  { label: "This year", range: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

/** Date range as yyyy-MM-dd strings (URL-friendly); the server treats `to` as inclusive. */
export function DateRangePicker({
  label,
  value,
  onChange,
  clearable = true,
}: {
  label: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected: DateRange | undefined = value.from
    ? { from: new Date(value.from), to: value.to ? new Date(value.to) : undefined }
    : undefined;
  const text = value.from
    ? `${formatDate(value.from)} – ${value.to ? formatDate(value.to) : "…"}`
    : label;

  function apply(range: { from?: Date; to?: Date } | undefined) {
    onChange({
      from: range?.from ? toDateParam(startOfDay(range.from)) : undefined,
      to: range?.to ? toDateParam(endOfDay(range.to)) : undefined,
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 justify-start", !value.from && "border-dashed")}
          aria-label={value.from ? `${label}: ${text}` : label}
        >
          <CalendarIcon className="text-muted-foreground" aria-hidden />
          <span className="truncate">{text}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-wrap gap-1 border-b p-2 sm:w-36 sm:flex-col sm:border-r sm:border-b-0">
            {DATE_PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  apply(p.range());
                  setOpen(false);
                }}
              >
                {p.label}
              </Button>
            ))}
            {clearable && value.from && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-muted-foreground"
                onClick={() => {
                  apply(undefined);
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            )}
          </div>
          <Calendar
            mode="range"
            numberOfMonths={1}
            selected={selected}
            defaultMonth={selected?.from}
            onSelect={(range) => apply(range)}
            disabled={{ after: new Date() }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function RangeInput({
  label,
  min,
  max,
  onChange,
  placeholder = ["Min", "Max"],
}: {
  label: string;
  min: number | undefined;
  max: number | undefined;
  onChange: (range: { min?: number; max?: number }) => void;
  placeholder?: [string, string];
}) {
  const [local, setLocal] = useState({ min: min?.toString() ?? "", max: max?.toString() ?? "" });
  const debounced = useDebounce(local, 400);

  const [prev, setPrev] = useState({ min, max });
  if (prev.min !== min || prev.max !== max) {
    setPrev({ min, max });
    setLocal({ min: min?.toString() ?? "", max: max?.toString() ?? "" });
  }

  useEffect(() => {
    const parse = (s: string) => (s === "" || Number.isNaN(Number(s)) ? undefined : Number(s));
    const next = { min: parse(debounced.min), max: parse(debounced.max) };
    if (next.min !== min || next.max !== max) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced input
  }, [debounced]);

  return (
    <fieldset className="flex items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      <span className="text-sm whitespace-nowrap text-muted-foreground" aria-hidden>
        {label}
      </span>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        aria-label={`${label} minimum`}
        placeholder={placeholder[0]}
        className="w-24"
        value={local.min}
        onChange={(e) => setLocal((l) => ({ ...l, min: e.target.value }))}
      />
      <span className="text-muted-foreground" aria-hidden>
        –
      </span>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        aria-label={`${label} maximum`}
        placeholder={placeholder[1]}
        className="w-24"
        value={local.max}
        onChange={(e) => setLocal((l) => ({ ...l, max: e.target.value }))}
      />
    </fieldset>
  );
}

export type FilterChip = { key: string; label: string; onRemove: () => void };

/** The filters currently narrowing the list, each removable on its own. */
export function ActiveFilters({
  chips,
  onClearAll,
}: {
  chips: FilterChip[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="-mt-1 mb-4 flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="gap-1 py-1 pr-1 pl-2 font-normal">
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            className="rounded-sm p-0.5 hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={`Remove filter: ${chip.label}`}
          >
            <X className="size-3" aria-hidden />
          </button>
        </Badge>
      ))}
      {chips.length > 1 && (
        <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={onClearAll}>
          Clear all
        </Button>
      )}
    </div>
  );
}
