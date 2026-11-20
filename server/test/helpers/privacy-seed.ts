import { randomBytes, randomUUID } from "node:crypto";
import { encrypt } from "../../src/lib/crypto";
import { eq, sql } from "drizzle-orm";
import type { Db } from "../../src/db/client";
import * as schema from "../../src/db/schema";
import { llmCalls } from "../../src/db/schema/platform";
import { userHashBytes } from "../../src/llm/redact";

// Shared by the WP-25 privacy integration tests (erasure drill, export).

export const MARK = "zqerasuremarker";

/** A verified user with a row in every table of the privacy registry, and one llm_calls row under their hash. */
export async function seedEverything(db: Db, email: string, mark = MARK) {
  const id = randomUUID();
  await db.insert(schema.user).values({ id, name: `Ann ${mark}`, email, emailVerified: true });
  const { bootstrapUser } = await import("../../src/services/bootstrap");
  await bootstrapUser(db, id); // profile, free plan, free grant, consent
  await db.update(schema.profiles).set({ phone: "555-0100", city: mark }).where(eq(schema.profiles.userId, id));
  await db.insert(schema.session).values({ id: randomUUID(), token: randomUUID(), userId: id, expiresAt: new Date(Date.now() + 3600_000), ipAddress: "203.0.113.9", userAgent: mark });
  await db.insert(schema.account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: `hash-${mark}` });
  const [rp] = await db.insert(schema.resumeProfiles).values({ userId: id, name: "Main", sourceText: `resume ${mark}` }).returning();
  const [resume] = await db.insert(schema.resumes).values({ userId: id, resumeProfileId: rp!.id, document: { marker: mark } as never }).returning();
  await db.insert(schema.resumeRevisions).values({ resumeId: resume!.id, document: { marker: mark } as never });
  await db.insert(schema.facts).values({ userId: id, resumeProfileId: rp!.id, kind: "skill" as never, text: `Go ${mark}` });
  const importId = randomUUID();
  const enc = encrypt(`resume ${mark}`, { table: "resume_imports", id: importId, column: "source_text" });
  await db.insert(schema.resumeImports).values({
    id: importId,
    userId: id,
    resumeProfileId: rp!.id,
    sourceKind: "text",
    sourceTextEnc: enc,
    sourceHash: randomBytes(32).toString("hex"),
    parseStatus: "parsed",
    parsedAt: new Date(),
  });
  await db.insert(schema.employments).values({
    userId: id,
    resumeProfileId: rp!.id,
    title: `Role ${mark}`,
    company: `Co ${mark}`,
    importKey: randomBytes(32).toString("hex"),
    assertedBy: "user",
    confirmed: true,
    confirmedAt: new Date(),
  });
  await db.insert(schema.savedAnswers).values({ userId: id, questionKey: "visa", label: "Visa?", answer: mark });
  const [co] = await db.insert(schema.companies).values({ name: "Co", ats: "greenhouse", boardToken: randomUUID() }).returning();
  const [job] = await db
    .insert(schema.jobs)
    .values({ companyId: co!.id, externalId: randomUUID(), title: "Engineer", descriptionText: "Build", applyUrl: "https://job-boards.greenhouse.io/x/jobs/1" })
    .returning();
  await db.insert(schema.matches).values({ userId: id, jobId: job!.id, passedFilters: true, score: 80, reasons: [mark] });
  await db.insert(schema.boardRequests).values({ userId: id, host: "careers.example.com", path: `/${mark}` });
  const [app] = await db
    .insert(schema.applications)
    .values({
      userId: id, jobId: job!.id, status: "submitted", channel: "extension", approvedAt: new Date(), submittedAt: new Date(),
      answers: [{ fieldKey: "q", label: "Gender", value: mark, source: "saved_answer" }],
      receipt: { filledFields: [{ fieldKey: "q", label: "Gender", value: mark }], channel: "extension" },
    })
    .returning();
  const [trackerItem] = await db.insert(schema.trackerItems).values({
    userId: id,
    jobId: job!.id,
    applicationId: app!.id,
    title: `Role ${mark}`,
    company: `Co ${mark}`,
    stage: "applied",
  }).returning();
  // WP-21: a contact and an interview linked to the item, each table of the erasure and export inventory.
  const [contact] = await db.insert(schema.contacts).values({ userId: id, name: "Recruiter", notes: mark }).returning();
  await db.insert(schema.contactJobs).values({ contactId: contact!.id, trackerItemId: trackerItem!.id });
  const [interview] = await db.insert(schema.interviews).values({ userId: id, trackerItemId: trackerItem!.id, startsAt: new Date(), timeZone: "UTC", durationMinutes: 30, kind: "video", notes: mark }).returning();
  await db.insert(schema.interviewContacts).values({ interviewId: interview!.id, contactId: contact!.id });
  await db.insert(schema.applicationEvents).values({
    trackerItemId: trackerItem!.id,
    applicationId: app!.id,
    userId: id,
    kind: "sent",
    actor: "system",
  });
  await db.insert(schema.submissionAttempts).values({
    applicationId: app!.id,
    userId: id,
    attemptNo: 1,
    channel: "extension",
    ats: "greenhouse",
    phase: "reported",
    state: "submitted",
    finishedAt: new Date(),
  });
  await db.insert(schema.emailSends).values({
    kind: "digest",
    entityId: id,
    userId: id,
    status: "sent",
    sentAt: new Date(),
  });
  await db.insert(schema.notifications).values({
    userId: id,
    kind: "autopilot_sent",
    entityId: app!.id,
  });
  await db.insert(schema.creditLedger).values({ userId: id, delta: -1, reason: "submission", applicationId: app!.id });
  // WP-35: bootstrapUser made the default saved search; a reminder about the application.
  await db.insert(schema.reminders).values({ userId: id, kind: "no_reply", applicationId: app!.id, dueAt: new Date() });
  await db.insert(schema.inboundEmails).values({ userId: id, applicationId: app!.id, providerMessageId: randomUUID(), sender: "hr@co.example", subject: "Re", textBody: mark });
  // WP-24: a Gmail code held for the user; privacy-scripts.int.test.ts needs a row in every exported table.
  await db.insert(schema.forwardingVerifications).values({ userId: id, provider: "gmail", code: "123456", expiresAt: new Date(Date.now() + 3 * 86_400_000) });
  await db.insert(schema.contactMessages).values({ name: "Ann", email: email.toUpperCase(), topic: "support", message: mark });
  await db.insert(schema.newsletterSubscribers).values({ email: email.toLowerCase(), source: "popup" }); // WP-50, by address
  await db.execute(sql`insert into user_daily_usage (user_id, day) values (${id}, current_date)`);
  await db.execute(sql`insert into ai_usage (user_id, day, feature, used) values (${id}, current_date, 'jobTailor', 1)`);
  await db.insert(llmCalls).values({
    agentId: "fit-scorer", promptVersion: 1, promptSha256: Buffer.alloc(32), model: "claude-haiku-5-5", workspace: "batch", userHash: userHashBytes(id),
    inputHash: Buffer.alloc(32), status: "ok",
  });
  return { id, applicationId: app!.id };
}

/** Every text-like column of the public schema that holds `needle`, as "table.column". */
export async function columnsHolding(db: Db, needle: string): Promise<string[]> {
  const { rows } = await db.execute<{ t: string; c: string }>(sql`
    select c.table_name as t, c.column_name as c from information_schema.columns c
      join pg_class k on k.relname = c.table_name and k.relnamespace = 'public'::regnamespace and not k.relispartition
     where c.table_schema = 'public' and c.data_type in ('text', 'character varying', 'jsonb', 'json', 'ARRAY', 'bytea')`);
  const hits: string[] = [];
  for (const { t, c } of rows) {
    const found = await db.execute(sql`select 1 from ${sql.identifier(t)} where position(lower(${needle}) in lower(${sql.identifier(c)}::text)) > 0 limit 1`);
    if (found.rows.length) hits.push(`${t}.${c}`);
  }
  return hits;
}
