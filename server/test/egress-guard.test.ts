import net from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const lookup = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup }));
const signal = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/sentry", async (orig) => ({ ...(await orig<typeof import("../src/lib/sentry")>()), signal }));

const { isPrivateAddress, refusedTarget, startEgressGuard } = await import("../src/jobs/egress-guard");

/** The applier's egress guard (T-006.5): every Chromium connection, redirect hops included, passes here. No test reaches the network. */
describe("egress guard", () => {
  it("refuses internal names, IP literals and any port but 443; allows a public name", () => {
    for (const host of ["169.254.169.254", "127.0.0.1", "[::1]", "localhost", "redis", "postgres.railway.internal", "printer.local", "metadata.google.internal"])
      expect(refusedTarget(host, "443"), host).toBe("internal_name");
    expect(refusedTarget("jobs.lever.co", "22")).toBe("port");
    expect(refusedTarget("jobs.lever.co", "80")).toBe("port");
    expect(refusedTarget("cdn.lever.co", "443")).toBeNull();
  });

  it("counts loopback, RFC 1918, link-local, CGNAT, ULA, mapped and NAT64 addresses as private", () => {
    for (const a of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "64:ff9b::a00:1"])
      expect(isPrivateAddress(a), a).toBe(true);
    for (const a of ["104.18.12.34", "2606:4700::1"]) expect(isPrivateAddress(a), a).toBe(false);
  });

  describe("as a proxy", () => {
    let guard: Awaited<ReturnType<typeof startEgressGuard>>;
    beforeAll(async () => {
      guard = await startEgressGuard();
    });
    afterAll(() => guard.close());

    /** Sends one proxy request and returns the status line. */
    function ask(line: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const { port } = new URL(guard.url);
        const s = net.connect(Number(port), "127.0.0.1", () => s.write(`${line}\r\n\r\n`));
        s.once("data", (d) => (resolve(d.toString().split("\r\n")[0]!), s.destroy()));
        s.once("error", reject);
      });
    }

    it("refuses a tunnel to an internal name without resolving it, and counts it", async () => {
      signal.mockClear();
      lookup.mockClear();
      expect(await ask("CONNECT metadata.google.internal:443 HTTP/1.1\r\nHost: metadata.google.internal:443")).toBe("HTTP/1.1 403 Forbidden");
      expect(lookup).not.toHaveBeenCalled();
      expect(signal).toHaveBeenCalledWith("applier_internal_blocked");
    });

    it("refuses a public name that resolves to a private address (rebinding), even when another answer is public", async () => {
      lookup.mockResolvedValueOnce([{ address: "104.18.12.34", family: 4 }, { address: "10.0.0.5", family: 4 }]);
      expect(await ask("CONNECT rebind.example.com:443 HTTP/1.1\r\nHost: rebind.example.com:443")).toBe("HTTP/1.1 403 Forbidden");
    });

    it("refuses a name that does not resolve, without counting it as a security event", async () => {
      signal.mockClear();
      lookup.mockRejectedValueOnce(Object.assign(new Error("nx"), { code: "ENOTFOUND" }));
      expect(await ask("CONNECT gone.example.com:443 HTTP/1.1\r\nHost: gone.example.com:443")).toBe("HTTP/1.1 403 Forbidden");
      expect(signal).not.toHaveBeenCalled();
    });

    it("refuses plain HTTP", async () => {
      expect(await ask("GET http://169.254.169.254/latest/meta-data/ HTTP/1.1\r\nHost: 169.254.169.254")).toBe("HTTP/1.1 403 Forbidden");
    });
  });
});
