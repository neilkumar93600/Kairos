import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";

// The api trusts x-kairos-client-ip only next to x-kairos-edge = KAIROS_EDGE_SECRET (05-api 5.5, CISO mustFix 4).
const SECRET = "s".repeat(32);
const apiRequest = () =>
  new NextRequest("https://kairos.app/api/me", { headers: { "x-real-ip": "198.51.100.7", "x-kairos-edge": "forged", "x-kairos-client-ip": "1.2.3.4" } });
/** A request header as forwarded upstream to the /api rewrite (Next's router reads these off the proxy response). */
const upstream = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`);

afterEach(() => vi.unstubAllEnvs());

describe("proxy on /api", () => {
  it("sends the edge secret and Vercel's client IP, replacing whatever the browser sent", () => {
    vi.stubEnv("KAIROS_EDGE_SECRET", SECRET);
    const res = proxy(apiRequest());
    expect(upstream(res, "x-kairos-edge")).toBe(SECRET);
    expect(upstream(res, "x-kairos-client-ip")).toBe("198.51.100.7");
    expect(res.headers.get("location")).toBeNull();
  });

  it("drops both headers when the web has no secret", () => {
    vi.stubEnv("KAIROS_EDGE_SECRET", "");
    const res = proxy(apiRequest());
    expect(res.headers.get("x-middleware-override-headers")).not.toMatch(/x-kairos/);
  });

  it("runs on every /api route except webhooks, whose large bodies it would buffer", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/me" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/auth/sign-in/email" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/webhooks/inbound-email" })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, url: "/dashboard" })).toBe(true);
  });
});
