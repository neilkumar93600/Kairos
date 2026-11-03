import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import net from "node:net";
import { describe, expect, it } from "vitest";

// test/setup-network.ts installs the block for every test file. These tests are the proof that it works, so a unit
// test that reaches an outside host fails instead of passing by accident or depending on the network being up.
describe("outbound network block in tests", () => {
  it("rejects a fetch to a public host", async () => {
    await expect(fetch("https://example.com/")).rejects.toThrow();
  });

  it("rejects a raw socket to a public address", async () => {
    // 192.0.2.1 is TEST-NET-1: it would hang, not refuse, if the block were missing.
    const socket = net.connect({ host: "192.0.2.1", port: 443 });
    const [err] = (await once(socket, "error")) as [Error];
    expect(err.message).toMatch(/outbound network is blocked/);
  });

  it("rejects a raw socket to a public hostname before any DNS lookup", async () => {
    const socket = net.connect(443, "api.stripe.com");
    const [err] = (await once(socket, "error")) as [Error];
    expect(err.message).toMatch(/outbound network is blocked/);
  });

  it("still allows loopback, which the Postgres, Redis and supertest tests rely on", async () => {
    const server = createServer((_req, res) => res.end("ok"));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const { port } = server.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}/`);
      expect(await res.text()).toBe("ok");
    } finally {
      server.close();
    }
  });
});
