import { lookup } from "node:dns/promises";
import http from "node:http";
import net from "node:net";
import { logger } from "../lib/logger";
import { signal } from "../lib/sentry";

/**
 * The applier's egress guard (07-cloud-applier 3.2 item 4, "Hostile content"): every applier context uses this in-process
 * proxy, so every connection Chromium opens passes here, redirect hops included. Playwright's context.route never sees a
 * hop (it continues them itself, T-006.5), so this is the only place a 3xx to an internal address can be refused. HTTPS
 * tunnels only, port 443 only, no internal name or IP literal, and the name is resolved once here and refused when any
 * address is private; the tunnel goes to the address that was checked, so a rebinding name cannot switch it.
 * Top-level navigation is held to the ATS allowlist in the page itself (jobs/cloud-apply.ts), which knows what a navigation is.
 */

const PRIVATE = new net.BlockList();
for (const [net4, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3]] as const)
  PRIVATE.addSubnet(net4, prefix, "ipv4");
// No ::ffff:0:0/96 rule: BlockList checks a mapped address against the IPv4 rules itself, and that rule would match every IPv4.
for (const [net6, prefix] of [["::", 127], ["64:ff9b::", 96], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) PRIVATE.addSubnet(net6, prefix, "ipv6");

export const isPrivateAddress = (address: string) => PRIVATE.check(address, net.isIPv6(address) ? "ipv6" : "ipv4");

/**
 * A request no employer page may make: any IP literal (the metadata address, loopback, private ranges; real pages
 * load by name) or a private-network name (single label, localhost, .local, .internal such as *.railway.internal).
 * Literal hosts only; a public name that resolves to a private address is refused by the guard's own lookup below.
 */
export function isInternalTarget(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return true;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false; // data: and blob: never leave the browser
  const host = u.hostname.replace(/\.$/, "");
  return host.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(host) || !host.includes(".") || /(^|\.)(localhost|local|internal)$/.test(host);
}

/** Why a CONNECT target is refused, or null. */
export function refusedTarget(host: string, port: string): "port" | "internal_name" | null {
  if (port !== "443") return "port";
  return isInternalTarget(`https://${host}/`) ? "internal_name" : null;
}

const refuse = (socket: net.Socket, host: string, reason: string) => {
  // internal_name and private_address are the security events (alert A-SUB-6); a closed port or a dead name is the web.
  const security = reason === "internal_name" || reason === "private_address";
  logger[security ? "error" : "warn"]({ host, reason }, "egress blocked");
  // A count only (CISO mustFix 10); the host stays in the log.
  if (security) signal("applier_internal_blocked");
  socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
};

export function startEgressGuard(): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((req, res) => {
    // Plain HTTP (an absolute-form request) is never needed: the apply pages and their subresources are HTTPS.
    logger.warn({ host: req.headers.host, reason: "plain_http" }, "egress blocked");
    if (isInternalTarget(req.url ?? "")) signal("applier_internal_blocked");
    res.writeHead(403).end();
  });
  server.on("connect", (req: http.IncomingMessage, client: net.Socket, head: Buffer) => {
    client.on("error", () => {});
    const target = /^(\[[^\]]+\]|[^:]+):(\d+)$/.exec(req.url ?? "");
    const host = target?.[1] ?? "";
    const reason = target ? refusedTarget(host, target[2]!) : "malformed";
    if (reason) return refuse(client, host, reason);
    lookup(host, { all: true, verbatim: true }).then(
      (addresses) => {
        if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) return refuse(client, host, "private_address");
        const upstream = net.connect({ host: addresses[0]!.address, port: 443, timeout: 15_000 });
        upstream.on("timeout", () => upstream.destroy());
        upstream.on("error", () => client.destroy());
        client.on("close", () => upstream.destroy());
        upstream.on("connect", () => {
          upstream.setTimeout(0);
          if (head.length) upstream.write(head);
          client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          upstream.pipe(client).pipe(upstream);
        });
      },
      () => refuse(client, host, "unresolved"),
    );
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.unref();
      resolve({ url: `http://127.0.0.1:${(server.address() as net.AddressInfo).port}`, close: () => server.close() });
    });
  });
}

let shared: Promise<{ url: string }> | undefined;

/** The replica's guard, started on first use. A start that fails is retried by the next run. */
export function egressGuardUrl(): Promise<string> {
  shared ??= startEgressGuard().catch((err: unknown) => {
    shared = undefined;
    throw err;
  });
  return shared.then((g) => g.url);
}
