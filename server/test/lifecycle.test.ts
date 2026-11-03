import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { beat, closeServer, deadline, healthStatus, serveHealth } from "../src/lib/lifecycle";

// The process shell of WP-11 (06-infrastructure 1.6, 6.7): drain, health and the dead-man's switch.

const servers: http.Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

async function listen(handler: http.RequestListener): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { server, port: (server.address() as AddressInfo).port };
}

const get = (port: number, path: string, agent?: http.Agent) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path, agent }, (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      })
      .on("error", reject);
  });

describe("closeServer (SIGTERM on the api)", () => {
  it("lets a request in flight complete, then resolves without waiting out the 65 s keep-alive", async () => {
    const { server, port } = await listen((req, res) => setTimeout(() => res.end(`done ${req.url}`), req.url === "/slow" ? 300 : 0));
    server.keepAliveTimeout = 65_000;
    const agent = new http.Agent({ keepAlive: true });
    await get(port, "/warm", agent); // an idle keep-alive socket
    const slow = get(port, "/slow", agent);
    await new Promise((r) => setTimeout(r, 50));

    const started = Date.now();
    const closed = closeServer(server);
    expect(await slow).toEqual({ status: 200, body: "done /slow" });
    await closed;
    expect(Date.now() - started).toBeLessThan(2_000);
    await expect(get(port, "/after")).rejects.toThrow();
    agent.destroy();
  });
});

describe("deadline", () => {
  it("passes the value through, or rejects once the time is up", async () => {
    await expect(deadline(Promise.resolve(7), 50)).resolves.toBe(7);
    await expect(deadline(new Promise(() => {}), 20)).rejects.toThrow("timeout");
  });
});

describe("healthStatus", () => {
  const up = async () => {};
  const down = async () => {
    throw new Error("connect ECONNREFUSED 10.0.0.5:5432");
  };

  it("answers status only: never a dependency name or an error (CISO hygiene)", async () => {
    expect(await healthStatus({ database: up, redis: up }, false)).toEqual([200, { status: "ok" }]);
    expect(await healthStatus({ database: down, redis: up }, false)).toEqual([503, { status: "degraded" }]);
  });

  it("answers 503 draining once shutdown began, without running the checks", async () => {
    expect(await healthStatus({ database: down }, true)).toEqual([503, { status: "draining" }]);
  });
});

describe("serveHealth (worker and applier)", () => {
  it("serves GET /health and nothing else", async () => {
    const server = serveHealth(0, { database: async () => {} });
    servers.push(server);
    await new Promise((r) => server.once("listening", r));
    const port = (server.address() as AddressInfo).port;
    expect(await get(port, "/health")).toEqual({ status: 200, body: '{"status":"ok"}' });
    expect((await get(port, "/metrics")).status).toBe(404);
  });
});

describe("beat (dead-man's switch)", () => {
  it("pings the heartbeat URL only while every check passes", async () => {
    let pings = 0;
    const { port } = await listen((_req, res) => (pings++, res.end("OK")));
    const url = `http://127.0.0.1:${port}/ping/abc`;
    expect(await beat(url, { database: async () => {} })).toBe(true);
    expect(await beat(url, { database: async () => Promise.reject(new Error("down")) })).toBe(false);
    expect(pings).toBe(1);
  });

  it("reports false when the vendor cannot be reached, without throwing", async () => {
    const { server, port } = await listen(() => {});
    await new Promise((r) => server.close(r));
    expect(await beat(`http://127.0.0.1:${port}/ping`, {})).toBe(false);
  });
});
