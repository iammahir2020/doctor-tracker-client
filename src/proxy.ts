import { NextResponse, type NextRequest } from "next/server";

/**
 * A strict, per-request Content-Security-Policy: only scripts carrying this nonce (Next.js adds it
 * to its own) can run, so injected markup could never execute script even if it reached the page.
 * Styles allow 'unsafe-inline' because Radix and Recharts position elements with style attributes.
 */
function contentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // React needs eval in development only, for its debugging stack traces.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function next(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  // Next.js reads the nonce from the request's CSP header and applies it while rendering.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

// Optimistic check only: it looks for the cookie, not whether it's valid. The API verifies the
// token on every request, and a 401 there sends the user back to /login.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("dt_token");
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login") {
    return hasSession ? NextResponse.redirect(new URL("/", request.url)) : next(request);
  }
  if (!hasSession) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return next(request);
}

export const config = {
  // Skip the API rewrite, Next internals and any file with an extension (favicon, images).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
