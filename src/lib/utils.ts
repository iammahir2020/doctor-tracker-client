import { format, parseISO } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export { cn } from "cn";

type ParamValue = string | number | boolean | null | undefined;

/**
 * Filters, sort and page live in the URL so views can be shared and Back/Forward works.
 * Any change other than the page itself resets to page 1.
 */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function set(updates: Record<string, ParamValue>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === "" || value === false)
        next.delete(key);
      else next.set(key, String(value));
    }
    if (!("page" in updates)) next.delete("page");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function clear(keys: readonly string[]) {
    set(Object.fromEntries(keys.map((k) => [k, null])));
  }

  return {
    get: (key: string) => searchParams.get(key) ?? undefined,
    getList: (key: string) => searchParams.get(key)?.split(",").filter(Boolean) ?? [],
    getNumber: (key: string) => {
      const raw = searchParams.get(key);
      const n = raw === null || raw === "" ? NaN : Number(raw);
      return Number.isFinite(n) ? n : undefined;
    },
    has: (keys: readonly string[]) => keys.some((k) => searchParams.has(k)),
    set,
    clear,
  };
}

export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Drops empty values so query keys and URLs stay stable. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
    ),
  ) as Partial<T>;
}

export function formatDate(iso: string | null | undefined) {
  return iso ? format(parseISO(iso), "d MMM yyyy") : "—";
}

/** yyyy-MM-dd for date inputs and URL params. */
export function toDateParam(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function ageFrom(dateOfBirth: string) {
  const dob = parseISO(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export const numberFormat = new Intl.NumberFormat("en-US");
