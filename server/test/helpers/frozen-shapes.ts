import { z } from "zod";
import { resumeSchema } from "@auto-career/shared";

/**
 * Contract level 2 (S-C1): what the frozen web and extension clients READ from each success response (05-api 18.2),
 * recorded 2026-11-03. Objects are passthrough: an additive field is allowed, a missing or retyped one fails
 * test/contract.int.test.ts. Add keys, never loosen or remove one without a frontend-handoff entry.
 */
const obj = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();
const date = z.string().min(10);

export const FROZEN_SHAPES = {
  "GET /api/me": obj({
    user: obj({ id: z.string(), email: z.string(), name: z.string() }),
    plan: obj({ id: z.string(), name: z.string(), priceUsd: z.number(), applicationsPerCycle: z.number(), cloudApplier: z.boolean(), coverLetters: z.boolean() }),
    subscription: obj({}).nullable(),
    credits: obj({ balance: z.number(), inFlight: z.number(), available: z.number() }),
    onboardingStep: z.string(),
    forwardingAddress: z.string().nullable(),
  }),
  "GET /api/credits": obj({
    balance: z.number(),
    inFlight: z.number(),
    available: z.number(),
    entries: z.array(obj({ id: z.string(), delta: z.number(), reason: z.string(), applicationId: z.string().nullable(), note: z.string().nullable(), createdAt: date })).min(1),
  }),
  "GET /api/profile": obj({ profile: obj({ phone: z.string().nullable(), city: z.string().nullable(), country: z.string().nullable(), linkedinUrl: z.string().nullable(), onboardingStep: z.string(), forwardingAddress: z.string().nullable() }) }),
  "GET /api/profile/facts": obj({ facts: z.array(obj({ id: z.string(), kind: z.string(), text: z.string(), confirmed: z.boolean() })).min(1) }),
  "GET /api/matches": obj({
    matches: z
      .array(
        obj({
          id: z.string(),
          score: z.number().nullable(),
          reasons: z.array(z.string()),
          status: z.string(),
          createdAt: date,
          job: obj({ id: z.string(), title: z.string(), location: z.string().nullable(), remote: z.boolean(), applyUrl: z.string(), firstSeenAt: date }),
          company: obj({ name: z.string(), ats: z.string() }),
        }),
      )
      .min(1),
  }),
  "GET /api/applications": obj({
    applications: z
      .array(
        obj({
          id: z.string(),
          status: z.string(),
          channel: z.string().nullable(),
          approvedAt: date.nullable(),
          submittedAt: date.nullable(),
          failureReason: z.string().nullable(),
          job: obj({ id: z.string(), title: z.string(), location: z.string().nullable(), applyUrl: z.string() }),
          company: obj({ name: z.string(), ats: z.string() }),
        }),
      )
      .min(1),
  }),
  "GET /api/applications/:id": obj({
    application: obj({ id: z.string(), status: z.string(), resumeLines: z.array(z.unknown()), answers: z.array(z.unknown()), coverLetter: z.string().nullable(), failureReason: z.string().nullable(), submittedAt: date.nullable() }),
    job: obj({ title: z.string(), location: z.string().nullable(), applyUrl: z.string(), descriptionText: z.string() }),
    companyName: z.string(),
  }),
  "GET /api/inbox": obj({
    emails: z.array(obj({ id: z.string(), sender: z.string(), subject: z.string(), kind: z.string().nullable(), applicationId: z.string().nullable(), receivedAt: date, preview: z.string().max(280) })).min(1),
  }),
  "GET /api/resume": obj({ resume: resumeSchema }),
  "GET /api/extension/queue": obj({ queue: z.array(z.unknown()) }),
} as const;

/** Deterministic refusals the clients branch on: [method, path, body, status, code]. A missing id is a fresh UUID. */
const MISSING = "00000000-0000-4000-8000-000000000000";
export const FROZEN_ERRORS: [method: "get" | "post" | "put" | "patch" | "delete", path: string, body: object | undefined, status: number, code: string | null][] = [
  ["get", `/api/applications/${MISSING}`, undefined, 404, "not_found"],
  ["post", `/api/applications/${MISSING}/withdraw`, undefined, 404, "not_found"],
  ["post", `/api/matches/${MISSING}/skip`, undefined, 404, "not_found"],
  ["post", `/api/matches/${MISSING}/queue`, undefined, 404, "not_found"],
  ["get", `/api/jobs/${MISSING}/fit`, undefined, 404, "not_found"],
  ["post", `/api/applications/approve`, {}, 422, "invalid_body"],
  ["put", `/api/profile/preferences`, {}, 422, "invalid_body"],
  ["post", `/api/profile/facts`, {}, 422, "invalid_body"],
  ["post", `/api/resume/suggestions`, {}, 422, "invalid_body"],
  ["post", `/api/jobs/import`, {}, 422, "invalid_body"],
  ["get", `/api/applications?status=bogus`, undefined, 400, "invalid_param"],
  ["delete", `/api/profile/facts/${MISSING}`, undefined, 204, null],
];
