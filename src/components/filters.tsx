"use client";

import { endOfDay, startOfDay, subDays, subMonths, startOfYear } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown, Search, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDate, toDateParam, useDebounce } from "@/lib/utils";

export type Option = { value: string; label: string };

export function FilterBar({
  children,
  onClear,
  canClear,
}: {
  children: React.ReactNode;
  onClear: () => void;
  canClear: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" role="search">
      {children}
      {canClear && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X aria-hidden /> Clear filters
        </Button>
      )}
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
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
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
    <div className="relative w-full sm:w-64">
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
        className="w-20"
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
        className="w-20"
        value={local.max}
        onChange={(e) => setLocal((l) => ({ ...l, max: e.target.value }))}
      />
    </fieldset>
  );
}
