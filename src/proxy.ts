import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: it looks for the cookie, not whether it's valid. The API verifies the
// token on every request, and a 401 there sends the user back to /login.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("dt_token");
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login") {
    return hasSession ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (!hasSession) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Skip the API rewrite, Next internals and any file with an extension (favicon, images).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
