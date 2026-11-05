import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import * as schema from "../src/db/schema";
import { llmCostDaily } from "../src/db/schema/platform";
import { Budget } from "../src/llm/budget";
import { resetBreakers } from "../src/llm/breaker";
import type { AnthropicLike, SentResponse } from "../src/llm/client";
import { configureGateway } from "../src/llm/gateway";
import { resetLimiter } from "../src/llm/limiter";
import { memorySpendStore } from "../src/llm/spend-store";
import { closeTestDbs, hasTestDb, testDb, testDbUrl } from "./helpers/test-db";

// The verifier's real stores (WP-26): the verified_claims memo, the cap's counts from llm_cost_daily, verifier_mode in
// ops_flags. The model is a stand-in, passed in through configureGateway; nothing here mocks a module.
process.env.DATABASE_URL = testDbUrl("verify");

/** The violated constraint, on the pg error itself or as drizzle's cause. */
const pgConstraint = (err: unknown) => {
  const e = err as { constraint?: string; cause?: { constraint?: string } } | null;
  return e?.constraint ?? e?.cause?.constraint;
};

describe.skipIf(!hasTestDb)("the claim verifier against Postgres (WP-26)", () => {
  let db: Db;
  let verify: typeof import("../src/services/verify");
  let flags: typeof import("../src/lib/flags");
  const models: string[] = [];

  /** Calls every claim `verdict` from either verifier and records the model of each send. */
  function judge(verdict: "supported" | "unsupported" | "uncertain", escalation: "supported" | "unsupported" = "supported"): AnthropicLike {
    return {
      messages: {
        async create(body) {
          const b = body as { model: string; messages: { content: { text: string }[] }[] };
          models.push(b.model);
          const text = b.messages.flatMap((m) => m.content.map((c) => c.text)).join("\n");
          const v = b.model === "claude-sonnet-5-5" ? escalation : verdict;
          const verdicts = [...text.matchAll(/^\[(c\d\d)\] kind=\S+ cites=(\S+) ::/gm)].map((m) => ({ claimId: m[1]!, verdict: v, factRef: v === "supported" ? m[2]!.split(",")[0]! : null }));
          return {
            data: { content: [{ type: "text", text: JSON.stringify({ verdicts }) }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null } },
            requestId: "req",
            rateRemaining: { requests: 999, inputTokens: 999_999, outputTokens: 99_999 },
            rateLimitRequests: 2_000,
            retryAfterSeconds: null,
          } satisfies SentResponse;
        },
      },
    };
  }

  const FACTS = new Map([["fact-a", "Built the billing service at Nordbeam"]]);
  const SECRET_TEXT = "Built the billing service at Nordbeam, a marker line";
  const item = (text = SECRET_TEXT) => ({ key: "k", kind: "resume_line" as const, text, factIds: ["fact-a"] });
  const opts = { path: "tailor" as const, target: null, ctx: {}, escalate: true };
  const today = () => new Date().toISOString().slice(0, 10);
  const seedCalls = (agentId: string, calls: number) => db.insert(llmCostDaily).values({ day: today(), agentId, workspace: "interactive", plan: "pro", model: "claude-haiku-5-5", isBatch: false, calls, costUsd: "0" });

  beforeAll(async () => {
    db = await testDb("verify");
    verify = await import("../src/services/verify");
    flags = await import("../src/lib/flags");
  });
  beforeEach(async () => {
    models.length = 0;
    await db.delete(schema.verifiedClaims);
    await db.delete(llmCostDaily).where(and(eq(llmCostDaily.day, today()), inArray(llmCostDaily.agentId, ["claim-verifier", "claim-verifier-escalation"])));
    await db.delete(schema.opsFlags).where(sql`key like 'verifier_mode:%'`);
    flags.resetFlagCache();
    verify.configureVerify(); // the real stores, and forgets the cached counts
    resetBreakers();
    resetLimiter();
    configureGateway({ client: () => judge("supported"), budget: new Budget(memorySpendStore()), writeRow: async () => "row", sleep: async () => {}, flags: () => ({ llmPaused: false, batchPaused: false, disabled: {}, promptPin: {} }) });
  });
  afterEach(() => configureGateway({ writeRow: async () => null }));
  afterAll(async () => {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
    await closeTestDbs();
  });

  describe("the memo", () => {
    it("stores a verdict under a 32-byte key with no text, inside its 24-hour check, and serves it without a model call", async () => {
      expect((await verify.verifyClaims([item()], FACTS, opts)).verdicts.get("k")).toBe("supported");
      expect(models).toHaveLength(1);

      const stored = await db.select().from(schema.verifiedClaims);
      expect(stored).toHaveLength(1);
      expect(stored[0]!.claimHash).toHaveLength(32);
      expect(stored[0]).toMatchObject({ verdict: "supported", checkSource: "verifier" });
      expect(stored[0]!.expiresAt.getTime() - stored[0]!.createdAt.getTime()).toBe(86_400_000);
      expect(JSON.stringify({ ...stored[0], claimHash: stored[0]!.claimHash.toString("latin1") })).not.toContain("marker line");

      expect((await verify.verifyClaims([item()], FACTS, opts)).verdicts.get("k")).toBe("supported");
      expect(models).toHaveLength(1);
    });

    it("rewrites an existing row without breaking the expiry check", async () => {
      const hash = verify.claimHash(item(), FACTS, null, 1, 1);
      await db.insert(schema.verifiedClaims).values({ claimHash: hash, verdict: "unsupported", checkSource: "verifier", createdAt: new Date(Date.now() - 172_800_000), expiresAt: new Date(Date.now() - 100_000_000) });
      expect((await verify.verifyClaims([item()], FACTS, opts)).verdicts.get("k")).toBe("supported"); // expired: judged again
      const stored = await db.select().from(schema.verifiedClaims);
      expect(stored).toHaveLength(1);
      expect(stored[0]!.verdict).toBe("supported");
      expect(stored[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("the checks refuse uncertain, a short key, an unknown source and a life over 24 hours", async () => {
      const row = { claimHash: Buffer.alloc(32, 9), verdict: "supported", checkSource: "verifier", expiresAt: new Date(Date.now() + 3_600_000) };
      const refused = async (values: typeof row, constraint: string) => {
        const err: unknown = await db.insert(schema.verifiedClaims).values(values).then(() => null, (e: unknown) => e);
        expect(pgConstraint(err)).toBe(constraint);
      };
      await refused({ ...row, verdict: "uncertain" }, "verified_claims_verdict_ck");
      await refused({ ...row, claimHash: Buffer.alloc(16, 9) }, "verified_claims_hash_ck");
      await refused({ ...row, checkSource: "guess" }, "verified_claims_source_ck");
      await refused({ ...row, expiresAt: new Date(Date.now() + 90_000_000) }, "verified_claims_expiry_ck");
    });
  });

  describe("the cap, from llm_cost_daily", () => {
    const uncertain = () => configureGateway({ client: () => judge("uncertain", "supported") });

    it("under the share the escalation runs on Sonnet and its verdict is stored as the escalation's", async () => {
      await seedCalls("claim-verifier", 100);
      await seedCalls("claim-verifier-escalation", 10);
      uncertain();
      const r = await verify.verifyClaims([item()], FACTS, opts);
      expect(r.verdicts.get("k")).toBe("supported");
      expect(models).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5"]);
      const stored = await db.select().from(schema.verifiedClaims);
      expect(stored.map((s) => s.checkSource)).toEqual(["escalation"]);
    });

    it("at 15% no Sonnet call is made and the claim is unverified, and not memoised", async () => {
      await seedCalls("claim-verifier", 100);
      await seedCalls("claim-verifier-escalation", 15);
      uncertain();
      const r = await verify.verifyClaims([item()], FACTS, opts);
      expect(r.verdicts.get("k")).toBe("unverified");
      expect(models).toEqual(["claude-haiku-5-5"]);
      expect(await db.select().from(schema.verifiedClaims)).toEqual([]);
    });
  });

  describe("verifier_mode, through ops_flags", () => {
    it("defaults to shadow with no row; an operator's enforce applies at once on this process", async () => {
      configureGateway({ client: () => judge("unsupported") });
      expect((await verify.verifyClaims([item("Claim one")], FACTS, opts)).dropped).toEqual([]);
      await flags.setFlag("verifier_mode:tailor", "enforce", "system:test");
      expect((await verify.verifyClaims([item("Claim two")], FACTS, opts)).dropped).toEqual([{ key: "k", rule: "unsupported_by_cited_facts" }]);
      // The other paths stay in shadow.
      expect((await verify.verifyClaims([item("Claim three")], FACTS, { ...opts, path: "drafts" })).dropped).toEqual([]);
    });

    it("every per-agent key lib/flags accepts passes ops_flags_key_ck, and a typo does not", async () => {
      await flags.setFlag("prompt_pin:claim-verifier", 1, "system:test");
      await flags.setFlag("model_pin:claim-verifier", "claude-sonnet-5-5", "system:test");
      await flags.setFlag("prompt_shadow:claim-verifier", { version: 1, percent: 0 }, "system:test");
      await flags.setFlag("prompt_canary:resume-tailor", { version: 1, percent: 0 }, "system:test");
      await flags.setFlag("agent_disabled:claim-verifier-escalation", false, "system:test");
      const keys = (await db.select({ key: schema.opsFlags.key }).from(schema.opsFlags)).map((r) => r.key);
      expect(keys).toEqual(expect.arrayContaining(["prompt_pin:claim-verifier", "model_pin:claim-verifier", "prompt_shadow:claim-verifier", "prompt_canary:resume-tailor", "agent_disabled:claim-verifier-escalation"]));
      const err: unknown = await db.insert(schema.opsFlags).values({ key: "prompt_pin:nobody", value: 1, updatedBy: "system:test" }).then(() => null, (e: unknown) => e);
      expect(pgConstraint(err)).toBe("ops_flags_key_ck");
    });
  });
});
