import { describe, expect, it } from "vitest";
import { getPlan, PLAN_IDS } from "@auto-career/shared";
import {
  APPLICATION_COLUMNS,
  FACT_COLUMNS,
  JOB_COLUMNS,
  LEDGER_COLUMNS,
  PROFILE_COLUMNS,
  RESUME_PROFILE_COLUMNS,
  SUBSCRIPTION_COLUMNS,
  publicPlan,
} from "../src/lib/serializers";

/**
 * The response pick-lists (05-api 10.2, 12.1, 12.4; CISO should-fix "serializers"). Exact key lists: a column added to a
 * table stays internal until it is named here, and naming one is a visible change to this test.
 */
const keys = (o: object) => Object.keys(o).sort();

describe("response pick-lists", () => {
  it.each(PLAN_IDS)("the %s plan keeps every key the web reads and drops the cost controls", (id) => {
    const plan = publicPlan(getPlan(id));
    expect(keys(plan)).toEqual(
      keys({
        id, name: 0, tagline: 0, priceUsd: 0, applicationsPerCycle: 0, resumeProfiles: 0, cloudApplier: 0, priorityPolling: 0,
        outcomeReport: 0, coverLetters: 0, answerMemory: 0, highlighted: 0, features: 0, autopilotDailySendCap: 0,
      }),
    );
    expect(plan).toMatchObject({ id, name: getPlan(id).name, cloudApplier: getPlan(id).cloudApplier });
  });

  it("a subscription carries no Stripe ids, owner or grace anchor", () => {
    expect(keys(SUBSCRIPTION_COLUMNS)).toEqual(["cancelAtPeriodEnd", "currentPeriodEnd", "interval", "pausedUntil", "plan", "status", "updatedAt"]);
  });

  it("a ledger entry carries no Stripe invoice id", () => {
    expect(keys(LEDGER_COLUMNS)).toEqual(["applicationId", "createdAt", "delta", "id", "note", "reason", "userId"]);
  });

  it("a resume profile never echoes its source text or file key", () => {
    expect(keys(RESUME_PROFILE_COLUMNS)).toEqual(["createdAt", "id", "isDefault", "name", "userId"]);
  });

  it("a job leaves out the raw ATS payload", () => {
    expect(keys(JOB_COLUMNS)).not.toContain("raw");
    expect(keys(JOB_COLUMNS)).toEqual(
      ["applyUrl", "closedAt", "companyId", "department", "descriptionText", "externalId", "firstSeenAt", "id", "location",
        "postedAt", "remote", "salaryMaxUsd", "salaryMinUsd", "source", "title"].sort(),
    );
  });

  it("applications, facts and the profile keep their frozen keys only", () => {
    expect(keys(APPLICATION_COLUMNS)).toEqual(
      ["answers", "approvedAt", "channel", "coverLetter", "createdAt", "failureReason", "id", "jobId", "matchId", "receipt",
        "resumeLines", "resumeProfileId", "status", "submittedAt", "updatedAt", "userId"].sort(),
    );
    expect(keys(FACT_COLUMNS)).toEqual(["assertedBy", "confirmed", "confirmedAt", "createdAt", "id", "kind", "sourceSpan", "text", "updatedAt"]);
    expect(keys(PROFILE_COLUMNS)).not.toContain("sensitiveAnswersEnc");
    expect(keys(PROFILE_COLUMNS)).not.toContain("normalizedEmailHash");
    expect(keys(PROFILE_COLUMNS)).toHaveLength(12);
  });
});
