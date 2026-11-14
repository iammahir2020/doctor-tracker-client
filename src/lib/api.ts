// ---------- DTOs (mirror the server responses) ----------

export type Role = "admin" | "staff";

export type User = { id: string; name: string; email: string; role: Role };

export type Paged<T> = {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

type Archivable = { isArchived: boolean; archivedAt?: string | null };

export type Lookup = { _id: string; name: string; isArchived: boolean };
export type LookupType = "specializations" | "conditions";
export type Lookups = Record<LookupType, Lookup[]>;

export type Doctor = Archivable & {
  _id: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  patientCount: number;
  createdAt: string;
};

export const GENDERS = ["male", "female", "other"] as const;
export const PATIENT_STATUSES = ["active", "recovered", "critical"] as const;
export type Gender = (typeof GENDERS)[number];
export type PatientStatus = (typeof PATIENT_STATUSES)[number];

export type Patient = Archivable & {
  _id: string;
  name: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  email: string | null;
  condition: string;
  status: PatientStatus;
  admissionDate: string;
  notes?: string;
  doctorId: string;
  doctorName: string | null;
  createdAt: string;
};

export type ManagedUser = Archivable & {
  _id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
};

export type Stats = {
  range: { from: string; to: string };
  current: {
    totalDoctors: number;
    activePatients: number;
    criticalPatients: number;
    avgPatientsPerDoctor: number;
    patientsByStatus: { status: PatientStatus; count: number }[];
    doctorsBySpecialization: { specialization: string; count: number }[];
    topDoctors: { _id: string; name: string; specialization: string; patientCount: number }[];
    patientsPerDoctor: { label: string; count: number }[];
  };
  inRange: {
    admissions: number;
    admissionsByMonth: { month: string; count: number }[];
    byCondition: { condition: string; count: number }[];
    byStatus: { status: PatientStatus; count: number }[];
  };
};

/** Field-level errors from a 400 response, keyed by field name, for react-hook-form. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return {};
  const out: Record<string, string> = {};
  for (const d of error.details as unknown[]) {
    if (typeof d === "object" && d !== null && "path" in d && "message" in d) {
      const path = String(d.path);
      if (path && !(path in out)) out[path] = String(d.message);
    }
  }
  return out;
}

export function toQueryString(params: Record<string, unknown>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// ---------- fetch wrapper ----------

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Free hosting can take up to a minute to wake, so calls made right after a cold start pass a longer timeout. */
  timeoutMs?: number;
  /** Off for the login call itself, where a 401 just means wrong credentials. */
  redirectOn401?: boolean;
};

function readError(data: unknown): { code: string; message: string; details: unknown } {
  if (typeof data === "object" && data !== null && "error" in data) {
    const error = data.error;
    if (typeof error === "object" && error !== null && "code" in error && "message" in error) {
      return {
        code: String(error.code),
        message: String(error.message),
        details: "details" in error ? error.details : null,
      };
    }
  }
  return { code: "UNKNOWN", message: "Something went wrong. Please try again.", details: null };
}

async function sendToLogin() {
  // The cookie is httpOnly, so ask the server to clear it; otherwise proxy.ts would bounce
  // the user straight back from /login to the page that just failed.
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  const next = window.location.pathname + window.location.search;
  // A full page load (not router.push) so every cached query from the old session is dropped.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, signal, timeoutMs = 20_000, redirectOn401 = true } = options;
  const timeout = AbortSignal.timeout(timeoutMs);

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (err) {
    if (timeout.aborted) {
      throw new ApiError(0, "TIMEOUT", "The server took too long to respond. Please try again.");
    }
    if (signal?.aborted) throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection.");
  }

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const { code, message, details } = readError(data);
    if (res.status === 401 && redirectOn401 && window.location.pathname !== "/login") {
      await sendToLogin();
    }
    throw new ApiError(res.status, code, message, details);
  }
  return data as T;
}
