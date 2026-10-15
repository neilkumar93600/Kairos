import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic gate only: it checks that a session cookie exists. Every API call is still verified
 * by the Express API, which is the real authorization layer.
 */
const AUTH_PAGES = ["/login", "/sign-up", "/forgot-password", "/reset-password", "/verify-otp"];

export function proxy(request: NextRequest) {
  const hasSession = Boolean(getSessionCookie(request));
  const { pathname, search } = request.nextUrl;

  if (AUTH_PAGES.includes(pathname)) {
    if (hasSession && pathname !== "/verify-otp") return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  if (!hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/matches/:path*",
    "/queue/:path*",
    "/applications/:path*",
    "/inbox/:path*",
    "/profile/:path*",
    "/preferences/:path*",
    "/billing/:path*",
    "/settings/:path*",
    "/login",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/verify-otp",
  ],
};
