import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic gate only: it checks that a session cookie exists. Every API call is still verified
 * by the Express API, which is the real authorization layer.
 */
const AUTH_PAGES = ["/login", "/sign-up", "/forgot-password", "/reset-password", "/verify-otp"];

/**
 * Every /api call is rewritten to the Railway api (next.config.ts). The api trusts x-kairos-client-ip only next to
 * x-kairos-edge = KAIROS_EDGE_SECRET (05-api 5.5), so the edge sets both here, from Vercel's own x-real-ip, and drops
 * any copy the browser sent. Without the secret (local dev) both are dropped and the api uses the address it sees.
 */
function toApi(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("x-kairos-edge");
  headers.delete("x-kairos-client-ip");
  const secret = process.env.KAIROS_EDGE_SECRET;
  const clientIp = request.headers.get("x-real-ip");
  if (secret && clientIp) {
    headers.set("x-kairos-edge", secret);
    headers.set("x-kairos-client-ip", clientIp);
  }
  return NextResponse.next({ request: { headers } });
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) return toApi(request);
  const hasSession = Boolean(getSessionCookie(request));

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
    // Not webhooks: providers post large bodies, which the proxy would buffer (and cut at 10 MB), and they need no client IP.
    "/api/((?!webhooks/).*)",
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/matches/:path*",
    "/queue/:path*",
    "/applications/:path*",
    "/inbox/:path*",
    "/resume/:path*",
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
