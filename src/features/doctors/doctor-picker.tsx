"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, useDebounce } from "@/lib/utils";
import { useDoctorOptions } from "./api";

/** Searches doctors on the server (there can be many), showing up to 20 matches. */
export function DoctorPicker({
  id,
  value,
  initialLabel,
  onChange,
  invalid = false,
  excludeId,
}: {
  id: string;
  value: string;
  initialLabel?: string;
  onChange: (id: string) => void;
  invalid?: boolean;
  /** Left out of the results, e.g. the doctor whose patients are being moved away. */
  excludeId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [label, setLabel] = useState(initialLabel);
  const debounced = useDebounce(search, 250);
  const { data: doctors, isFetching } = useDoctorOptions(debounced);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            invalid && "border-destructive",
          )}
        >
          {value ? (label ?? "Selected doctor") : "Search for a doctor…"}
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        {/* Filtering happens on the server, so cmdk's own filter is off. */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type a name…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{isFetching ? "Searching…" : "No active doctors found."}</CommandEmpty>
            <CommandGroup>
              {doctors
                ?.filter((d) => d._id !== excludeId)
                .map((d) => (
                  <CommandItem
                    key={d._id}
                    value={d._id}
                    onSelect={() => {
                      onChange(d._id);
                      setLabel(d.name);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(value === d._id ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    <span className="truncate">{d.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{d.hospital}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
