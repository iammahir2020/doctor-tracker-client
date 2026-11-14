"use client";

import {
  LayoutDashboard,
  Search,
  Settings,
  Stethoscope,
  UserCog,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useRole } from "@/features/auth/api";
import { useDoctorOptions } from "@/features/doctors/api";
import { usePatients } from "@/features/patients/api";
import { useDebounce } from "@/lib/utils";

const PAGES: { href: string; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/patients", label: "Patients", icon: UsersRound },
  { href: "/users", label: "Users", icon: UserCog, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Searches doctors and patients on the server; only runs once something is typed. */
function SearchResults({ query, go }: { query: string; go: (href: string) => void }) {
  const doctors = useDoctorOptions(query);
  const patients = usePatients({ search: query, sort: "name", order: "asc", page: 1, pageSize: 5 });

  return (
    <>
      {(doctors.data?.length ?? 0) > 0 && (
        <CommandGroup heading="Doctors">
          {doctors.data?.slice(0, 5).map((d) => (
            <CommandItem
              key={d._id}
              value={`doctor ${d.name} ${d.email} ${d._id}`}
              onSelect={() => go(`/doctors/${d._id}`)}
            >
              <Stethoscope aria-hidden />
              <span className="truncate">{d.name}</span>
              <span className="ml-auto truncate text-xs text-muted-foreground">{d.hospital}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {(patients.data?.data.length ?? 0) > 0 && (
        <CommandGroup heading="Patients">
          {patients.data?.data.map((p) => (
            <CommandItem
              key={p._id}
              value={`patient ${p.name} ${p.email ?? ""} ${p._id}`}
              onSelect={() => go(`/patients?patient=${p._id}`)}
            >
              <UserRound aria-hidden />
              <span className="truncate">{p.name}</span>
              <span className="ml-auto truncate text-xs text-muted-foreground">
                {p.doctorName ?? ""}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </>
  );
}

/** Ctrl/Cmd+K jumps to any page, doctor or patient. */
export function CommandPalette() {
  const router = useRouter();
  const role = useRole();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const query = useDebounce(text.trim(), 250);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setText("");
    router.push(href);
  };

  return (
    <>
      <Button
        variant="outline"
        className="h-9 w-9 justify-start gap-2 px-2.5 text-muted-foreground sm:w-56 sm:px-3"
        onClick={() => setOpen(true)}
        aria-label="Search (Ctrl+K)"
      >
        <Search aria-hidden />
        <span className="hidden flex-1 text-left font-normal sm:inline">Search…</span>
        <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline">
          Ctrl&nbsp;K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setText("");
        }}
        title="Search"
        description="Jump to a page, doctor or patient"
      >
        <CommandInput
          placeholder="Search pages, doctors and patients…"
          value={text}
          onValueChange={setText}
        />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>
          <CommandGroup heading="Pages">
            {PAGES.filter((p) => !p.adminOnly || role === "admin").map(
              ({ href, label, icon: Icon }) => (
                <CommandItem key={href} value={`page ${label}`} onSelect={() => go(href)}>
                  <Icon aria-hidden />
                  {label}
                </CommandItem>
              ),
            )}
          </CommandGroup>
          {query.length > 0 && <SearchResults query={query} go={go} />}
        </CommandList>
      </CommandDialog>
    </>
  );
}
