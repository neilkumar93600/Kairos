import net from "node:net";
import { MockAgent, setGlobalDispatcher } from "undici";

// No test may reach the real internet (tests-02). Two layers, because fetch and raw sockets take different paths:
//  - fetch goes through undici, whose MockAgent refuses every origin that is not loopback;
//  - the Postgres, Redis and SMTP-style clients open sockets directly, so net.Socket#connect refuses non-loopback hosts.
// Loopback stays open: the Postgres and Redis the integration tests use, and supertest's ephemeral servers.
const LOOPBACK_HOST = /^(localhost|127(\.\d{1,3}){3}|\[?::1\]?|\[?::ffff:127\.0\.0\.1\]?)$/i;

const agent = new MockAgent();
agent.disableNetConnect();
// undici matches against "host:port".
agent.enableNetConnect((hostAndPort: string) => LOOPBACK_HOST.test(hostAndPort.replace(/:\d+$/, "")));
setGlobalDispatcher(agent);

const originalConnect = net.Socket.prototype.connect;
// ponytail: patches the prototype for the whole worker; a test that truly needs an outside host must be an
// explicitly named integration test with its own opt-out, which does not exist yet.
net.Socket.prototype.connect = function patchedConnect(this: net.Socket, ...args: unknown[]) {
  // net.connect() hands Socket#connect its normalized arguments as one array: [options, callback].
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  let host: string | undefined;
  if (typeof first === "object" && first !== null) {
    // A unix socket path has no host and is local by definition.
    if ("path" in first && first.path) return (originalConnect as (...a: unknown[]) => net.Socket).apply(this, args);
    host = (first as { host?: string }).host;
  } else if (typeof first === "number" || (typeof first === "string" && /^\d+$/.test(first))) {
    host = typeof args[1] === "string" ? args[1] : undefined;
  } else {
    return (originalConnect as (...a: unknown[]) => net.Socket).apply(this, args); // connect(path)
  }
  if (host !== undefined && !LOOPBACK_HOST.test(host)) {
    const err = new Error(`outbound network is blocked in tests (tried ${host}); stub the call instead`);
    process.nextTick(() => this.destroy(err));
    return this;
  }
  return (originalConnect as (...a: unknown[]) => net.Socket).apply(this, args);
} as typeof net.Socket.prototype.connect;
