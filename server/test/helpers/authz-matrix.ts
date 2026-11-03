import { METHODS } from "node:http";
import express from "express";
import { DEFAULT_PREFERENCES } from "@auto-career/shared";

/**
 * The two-user authorization matrix (CISO mustFix 11, 05-api 5.4, api-auth-security-31, tests-23). One entry per route
 * the app mounts, keyed "METHOD /express/path". test/authz-matrix.test.ts fails when a mounted route has no entry or an
 * entry names no route; test/authz-matrix.int.test.ts runs every signed-in entry as user B against user A's rows.
 */

/** One tenant's seeded rows, as the requests below target them. */
export interface TenantIds {
  applicationId: string;
  factId: string;
  answerId: string;
  matchId: string;
  jobId: string;
  fileKey: string;
}

/** Exempt from the two-user check, with the reason: no session user, or a credential of its own. */
export interface PublicEntry {
  public: string;
}

/**
 * A signed-in route. `request` builds what the caller sends for a tenant's ids; a route whose request uses no id acts
 * on the caller's own rows only. `foreign` is the status for another user's ids when it is not 404, with `why`.
 */
export interface TenantEntry {
  request: (ids: TenantIds) => { path: string; body?: object };
  foreign?: number;
  why?: string;
  /** A session-fresh route (05-api 5.2): test/fresh-matrix.test.ts holds this flag against how routes/index.ts mounts it. */
  fresh?: true;
}

export type MatrixEntry = PublicEntry | TenantEntry;

/** Planted in internal columns and in the pasted resume text; no response may ever carry it. */
export const MARKER = "zqinternal7marker";

const own = (path: string, body?: object): TenantEntry => ({ request: () => ({ path, body }) });

export const MATRIX: Record<string, MatrixEntry> = {
  "GET /health": { public: "status only, never user data (Railway's healthcheck)" },
  "GET /api/health": { public: "the same status-only health check through the Vercel rewrite" },
  "ALL /api/auth/*splat": { public: "Better Auth: sign-in and the caller's own session; it checks its own origins and limits" },
  "POST /api/webhooks/stripe": { public: "Stripe: the signature is the credential, and the event names its own customer" },
  "POST /api/webhooks/inbound-email": { public: "Postmark inbound: the token is the credential; mail is filed by forwarding address" },
  "POST /api/webhooks/postmark-events": { public: "Postmark delivery events: the token is the credential; it only adds or lifts address-hash suppressions" },
  "POST /api/contact": { public: "the public contact form: stores a message and reads nothing back" },
  "GET /api/auth-providers": { public: "the configured sign-in methods; no user data" },

  "GET /api/me": own("/api/me"),
  "GET /api/profile": own("/api/profile"),
  "PUT /api/profile/contact": own("/api/profile/contact", {
    phone: "555-0100", city: "Austin", country: null, linkedinUrl: null, githubUrl: null, portfolioUrl: null,
  }),
  "PUT /api/profile/preferences": own("/api/profile/preferences", {
    ...DEFAULT_PREFERENCES, roles: ["Software Engineer"], workAuthorization: "citizen_or_pr",
  }),
  "POST /api/profile/resumes": own("/api/profile/resumes", { name: "Imported resume", text: `${"Built and ran billing services. ".repeat(8)}${MARKER}` }),
  "GET /api/profile/facts": own("/api/profile/facts"),
  "POST /api/profile/facts": own("/api/profile/facts", { kind: "skill", text: "Wrote the authorization matrix", confirmed: false }),
  "PATCH /api/profile/facts/:id": { request: (t) => ({ path: `/api/profile/facts/${t.factId}`, body: { confirmed: true } }) },
  "DELETE /api/profile/facts/:id": {
    request: (t) => ({ path: `/api/profile/facts/${t.factId}` }),
    foreign: 204,
    why: "an idempotent delete: a missing or foreign id is 204 and deletes nothing (frozen, 05-api 12.2)",
  },
  "GET /api/profile/answers": own("/api/profile/answers"),
  "PATCH /api/profile/answers/:id": { request: (t) => ({ path: `/api/profile/answers/${t.answerId}`, body: { answer: "Mine", approved: true } }) },

  "GET /api/matches": own("/api/matches"),
  "POST /api/matches/:id/skip": { request: (t) => ({ path: `/api/matches/${t.matchId}/skip` }) },
  "POST /api/matches/:id/queue": { request: (t) => ({ path: `/api/matches/${t.matchId}/queue` }) },

  // An unsupported link is refused before any fetch, so the import never leaves the process.
  "POST /api/jobs/import": own("/api/jobs/import", { url: "https://example.com/jobs/1" }),
  "GET /api/jobs/:jobId/fit": { request: (t) => ({ path: `/api/jobs/${t.jobId}/fit` }) },
  "POST /api/jobs/:jobId/tailor": { request: (t) => ({ path: `/api/jobs/${t.jobId}/tailor` }) },

  "GET /api/resume": own("/api/resume"),
  "PUT /api/resume": own("/api/resume", {
    name: "Base resume", density: "comfortable", contact: { name: "Test User", email: "user@test.local", phone: "", location: "", links: [] }, sections: [],
  }),
  "POST /api/resume/suggestions": { request: (t) => ({ path: "/api/resume/suggestions", body: { scope: "resume", jobId: t.jobId } }) },

  "GET /api/applications": own("/api/applications"),
  "GET /api/applications/:id": { request: (t) => ({ path: `/api/applications/${t.applicationId}` }) },
  "PATCH /api/applications/:id": { request: (t) => ({ path: `/api/applications/${t.applicationId}`, body: { coverLetter: null } }) },
  "POST /api/applications/approve": {
    fresh: true,
    request: (t) => ({ path: "/api/applications/approve", body: { applicationIds: [t.applicationId], channel: "extension" } }),
    foreign: 200,
    why: "approves the caller's own drafts among the ids sent; another user's id is left out ({ approved: [] })",
  },
  "POST /api/applications/:id/drafts": { request: (t) => ({ path: `/api/applications/${t.applicationId}/drafts`, body: { kind: "cover_letter" } }) },
  "POST /api/applications/:id/withdraw": { request: (t) => ({ path: `/api/applications/${t.applicationId}/withdraw` }) },

  "GET /api/credits": own("/api/credits"),
  "GET /api/inbox": own("/api/inbox"),
  "POST /api/billing/checkout": { ...own("/api/billing/checkout", { plan: "starter", interval: "month" }), fresh: true },
  "POST /api/billing/portal": { ...own("/api/billing/portal"), fresh: true },

  "GET /api/extension/queue": own("/api/extension/queue"),
  "POST /api/extension/report": {
    request: (t) => ({
      path: "/api/extension/report",
      body: { applicationId: t.applicationId, outcome: "failed", filledFields: [], submittedAt: "2026-11-03T00:00:00.000Z" },
    }),
  },

  "GET /api/files/*key": { request: (t) => ({ path: `/api/files/${t.fileKey}` }) },

  // WP-44: every statement filters by the caller's user id; read-all touches only the caller's unread rows.
  "GET /api/notifications": own("/api/notifications"),
  "POST /api/notifications/read": own("/api/notifications/read", { all: true }),
};

type Layer = { route?: { path: string | string[]; methods: Record<string, boolean> }; handle: { stack?: Layer[] }; mountPath?: string | string[] };
type Stacked = { stack: Layer[] };

/**
 * From now on, tags every layer Router#use adds with the path it was mounted at: Express 5 keeps only a matcher closure,
 * so a nested router's prefix cannot be read back otherwise. Call it before importing the app.
 * ponytail: patches Router.prototype.use in the test worker; the route registry (05-api 2.2) makes it unnecessary.
 */
export function recordMountPaths(): void {
  const proto = express.Router.prototype as { use: (this: Stacked, ...args: unknown[]) => unknown };
  const use = proto.use;
  if (use.name === "recordingUse") return;
  proto.use = function recordingUse(this: Stacked, ...args: unknown[]) {
    const before = this.stack.length;
    const result = use.apply(this, args);
    // Router#use's own rule: the first argument is the path unless it (or its first nested element) is a function.
    let first = args[0];
    while (Array.isArray(first) && first.length > 0) first = first[0];
    const path = (typeof first === "function" ? "/" : args[0]) as string | string[];
    for (const layer of this.stack.slice(before)) layer.mountPath = path;
    return result;
  };
}

/** "METHOD /path" for every route `app` serves, nested routers included; "ALL" for app.all. Sorted, unique. */
export function listRoutes(app: unknown): string[] {
  const out = new Set<string>();
  const walk = (stack: Layer[], prefix: string) => {
    for (const layer of stack) {
      if (layer.route) {
        const { methods } = layer.route;
        // app.all registers every method one by one; Route#all sets _all.
        const all = methods._all || METHODS.every((m) => methods[m.toLowerCase()]);
        for (const path of [layer.route.path].flat()) {
          const full = path === "/" && prefix ? prefix : prefix + path;
          for (const method of all ? ["ALL"] : Object.keys(methods).map((m) => m.toUpperCase())) out.add(`${method} ${full}`);
        }
      } else if (layer.handle.stack) {
        if (layer.mountPath === undefined) throw new Error("A router was mounted before recordMountPaths() ran; import the app after calling it");
        for (const mount of [layer.mountPath].flat()) walk(layer.handle.stack, mount === "/" ? prefix : prefix + mount);
      }
    }
  };
  walk((app as { router: Stacked }).router.stack, "");
  return [...out].sort();
}

/** Mounted routes without a matrix entry, and entries that name no mounted route. Both must be empty. */
export function uncovered(routes: string[], matrix: Record<string, unknown> = MATRIX) {
  return { missing: routes.filter((r) => !(r in matrix)), stale: Object.keys(matrix).filter((k) => !routes.includes(k)) };
}
