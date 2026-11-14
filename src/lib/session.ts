import type { Role } from "./api";

/**
 * Reads the role from the session token's payload without verifying it. This is only a hint so
 * role-dependent UI can render in the first HTML instead of popping in after /auth/me; the API
 * verifies the token on every request, and the fetched user replaces the hint once it loads.
 */
export function roleFromToken(token: string | undefined): Role | undefined {
  const payload = token?.split(".")[1];
  if (!payload) return undefined;
  try {
    const json: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof json === "object" && json !== null && "role" in json) {
      return json.role === "admin" || json.role === "staff" ? json.role : undefined;
    }
  } catch {
    // Malformed token: no hint; the API will reject it anyway.
  }
  return undefined;
}
