import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AtsProvider } from "@auto-career/shared";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/db/client";
import type { CloudOutcome } from "../src/jobs/cloud-apply";
import { closeTestDbs, hasTestDb, resetDb, seedUser, testDb, testDbUrl } from "./helpers/test-db";
import { formUrl } from "./fake-ats";

/**
 * T-006.5 settlement against Postgres for the outcomes the cloud applier reaches on the fake-ATS forms. The form fill
 * itself (custom question, stored sensitive answers, resume, confirmation, challenge, closed page) is proven in a real
 * Chromium by applier-fake-ats.browser.test.ts; CI has no browser, so the pool's run returns those same outcomes here and
 * everything around it is real: the claim, the launch mark, the payload, the result write, settlement, the ledger.
 */

const OWNER = "fake-ats-owner"; // the owner bypass passes the plan check at claim (cloudAllowed)
if (hasTestDb) process.env.DATABASE_URL = testDbUrl("applierfakeats");
process.env.OWNER_USER_IDS = OWNER;
process.env.FILLER_SCRIPT_PATH = join(tmpdir(), "kairos-applier-fake-ats-filler.js");
writeFileSync(process.env.FILLER_SCRIPT_PATH, "window.__kairosFill = async () => ({});");

const enqueue = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));

const { closeDb } = await import("../src/db/client");
const schema = await import("../src/db/schema");
const { processCloudApply } = await import("../src/jobs/cloud-apply");
const { applierPool, closeBrowser } = await import("../src/jobs/browser-pool");
const { settleAll } = await import("./helpers/settle");
const { recordExtensionReport } = await import("../src/services/settle");
const { resendApplication } = await import("../src/services/submissions");

const ANSWERS = [
  { fieldKey: "first_name", label: "First name", value: "Ada", source: "profile" as const },
  { fieldKey: "why", label: "Why Acme?", value: "I build billing systems.", source: "generated" as const },
  { fieldKey: "work_auth", label: "Are you legally authorized to work in the United States?", value: "Yes", source: "saved_answer" as const },
];
const LINE = { id: "l1", section: "Experience", text: "Built the billing service", factIds: [] as string[] };

/** What fillInBrowser returned on the fake forms (applier-fake-ats.browser.test.ts). */
const SUBMITTED = (applicationId: string): CloudOutcome => ({
  submitted: true,
  report: {
    applicationId,
    outcome: "submitted",
    filledFields: [{ fieldKey: "resume", label: "Resume", value: "Ada Lovelace - Resume.pdf" }],
    confirmationText: "Thank you for applying. Your application has been received.",
    submittedAt: new Date().toISOString(),
  },
});
const CHALLENGE: CloudOutcome = { submitted: false, code: "challenge", detail: "recaptcha" };
const CLOSED: CloudOutcome = { submitted: false, code: "posting_closed", detail: "closed_on_apply_page" };
const UNCONFIRMED: CloudOutcome = { submitted: false, code: "unconfirmed", detail: "fill_interrupted" };

describe.skipIf(!hasTestDb)("T-006.5 cloud applier settlement on the fake-ATS outcomes", () => {
  let db: Db;
  let run: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await testDb("applierfakeats");
  });
  beforeEach(async () => {
    await resetDb(db);
    await seedUser(db, { id: OWNER, credits: 5 });
  });
  afterEach(async () => {
    await closeBrowser();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await closeDb();
    await closeTestDbs();
  });

  /** The pool runs nothing: each call yields the outcome the browser test proved for that form. */
  function pool(outcome: (applicationId: string) => CloudOutcome, applicationId: string) {
    run = vi.fn(async () => outcome(applicationId));
    vi.spyOn(applierPool(), "run").mockImplementation(run as never);
  }

  let n = 0;
  async function application(ats: AtsProvider, status: "approved" | "draft" = "approved", channel: "cloud" | "extension" = "cloud") {
    n += 1;
    const [c] = await db.insert(schema.companies).values({ name: `Acme ${n}`, ats, boardToken: `acme-${n}` }).returning();
    const [job] = await db
      .insert(schema.jobs)
      .values({ companyId: c!.id, externalId: `fit-${n}`, title: "Junior Engineer", descriptionText: "Build things", applyUrl: formUrl(ats, "fit") })
      .returning();
    const approved = status === "approved" ? { channel, approvedAt: new Date(), approvedBy: "user" as const, attemptNo: 1 } : {};
    const [row] = await db.insert(schema.applications).values({ userId: OWNER, jobId: job!.id, resumeLines: [LINE], answers: ANSWERS, status, ...approved }).returning();
    return { id: row!.id, jobId: job!.id };
  }
  const appOf = async (id: string) => (await db.select().from(schema.applications).where(eq(schema.applications.id, id)))[0]!;
  const attemptsOf = (id: string) => db.select().from(schema.submissionAttempts).where(eq(schema.submissionAttempts.applicationId, id));
  const charges = (id: string) => db.select().from(schema.creditLedger).where(and(eq(schema.creditLedger.applicationId, id), eq(schema.creditLedger.reason, "submission")));
  const deliver = (id: string) => processCloudApply({ data: { applicationId: id, attemptNo: 1 } } as never);

  it.each(["greenhouse", "lever", "ashby"] as const)("%s: a confirmed run stores the receipt and charges exactly one credit; a re-delivery sends nothing more (INV-5)", async (ats) => {
    const { id } = await application(ats);
    pool(SUBMITTED, id);

    await expect(deliver(id)).resolves.toEqual({ submitted: true });
    await settleAll(db);
    await expect(deliver(id)).resolves.toEqual({ skipped: true });
    await settleAll(db);

    expect(run).toHaveBeenCalledTimes(1);
    const app = await appOf(id);
    expect(app.status).toBe("submitted");
    expect(app.receipt).toMatchObject({ channel: "cloud", confirmationText: expect.stringMatching(/thank you/i), filledFields: [{ fieldKey: "resume", value: "PDF attached" }] });
    expect(await attemptsOf(id)).toMatchObject([{ state: "submitted", ats }]);
    expect(await charges(id)).toHaveLength(1);
  });

  it("two deliveries racing on one approved application claim once and submit once (INV-4)", async () => {
    const { id } = await application("greenhouse");
    pool(SUBMITTED, id);
    const results = await Promise.all([deliver(id), deliver(id)]);
    await settleAll(db);
    expect(results).toContainEqual({ submitted: true });
    expect(results).toContainEqual({ skipped: true });
    expect(run).toHaveBeenCalledTimes(1);
    expect(await attemptsOf(id)).toHaveLength(1);
    expect(await charges(id)).toHaveLength(1);
  });

  it("a challenged form fails with no charge (INV-8)", async () => {
    const { id } = await application("lever");
    pool(() => CHALLENGE, id);
    await expect(deliver(id)).resolves.toEqual({ submitted: false });
    await settleAll(db);
    expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: "challenge" });
    expect(await charges(id)).toEqual([]);
  });

  it("a closed posting fails as posting_closed with no charge, and closes the job (INV-23)", async () => {
    const { id, jobId } = await application("ashby");
    pool(() => CLOSED, id);
    await deliver(id);
    await settleAll(db);
    expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: "posting_closed" });
    expect(await charges(id)).toEqual([]);
    const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId));
    expect(job!.closedAt).not.toBeNull();
  });

  it("a run that may have clicked but saw no confirmation is unconfirmed, never charged, never resent blind", async () => {
    const { id } = await application("greenhouse");
    pool(() => UNCONFIRMED, id);
    await deliver(id);
    await settleAll(db);
    expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: "unconfirmed" });
    expect(await attemptsOf(id)).toMatchObject([{ state: "needs_check" }]);
    expect(await charges(id)).toEqual([]);
  });

  it("an extension report of 'No confirmation' after the click is unconfirmed: no charge, no blind resend, a late confirmation still settles once (R3b)", async () => {
    const { id } = await application("greenhouse", "approved", "extension");
    const failed = { applicationId: id, outcome: "failed" as const, failureReason: "No confirmation after submit", filledFields: [], submittedAt: new Date().toISOString() };
    await expect(recordExtensionReport(db, OWNER, "s1", failed)).resolves.toEqual({ status: "failed" });

    expect(await appOf(id)).toMatchObject({ status: "failed", failureCode: "unconfirmed" });
    expect(await attemptsOf(id)).toMatchObject([{ channel: "extension", state: "needs_check", failureCode: "unconfirmed" }]);
    expect(await charges(id)).toEqual([]);
    // The employer may have it: a resend needs the user's acknowledgement (a second application otherwise).
    await expect(resendApplication(db, OWNER, id, "extension", false)).rejects.toMatchObject({ code: "acknowledgement_required" });

    await recordExtensionReport(db, OWNER, "s1", { ...failed, outcome: "submitted", failureReason: undefined, confirmationText: "Thank you for applying." });
    expect((await appOf(id)).status).toBe("submitted");
    expect(await charges(id)).toHaveLength(1);
  });

  it("only an approved row is claimed: a draft is never run (INV-3)", async () => {
    const { id } = await application("greenhouse", "draft");
    pool(SUBMITTED, id);
    await expect(deliver(id)).resolves.toEqual({ skipped: true });
    expect(run).not.toHaveBeenCalled();
    expect(await attemptsOf(id)).toEqual([]);
    expect((await appOf(id)).status).toBe("draft");
  });
});
