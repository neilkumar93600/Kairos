import { and, asc, desc, eq, isNull, or, sql, type AnyColumn } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { keysetBefore, slicePage, tsKey, type After } from "../lib/pagination";
import type { PlanId, ResumeDetail, ResumeInput, ResumeSummary } from "@auto-career/shared";
import { MAX_BASE_RESUMES_PER_PROFILE } from "@auto-career/shared";
import { db, type Db } from "../db/client";
import { applications, companies, employments, facts, jobs, matches, profiles, resumeImports, resumeProfiles, resumeRevisions, resumes, user } from "../db/schema";
import type { SessionUser } from "../lib/auth";
import { HttpError, notFound } from "../lib/errors";
import { profileFor } from "./import/imports";
import { claimViolations, defaultResume, profileContactFrom, truthLockViolations } from "./resume-doc";

/**
 * The resume library (PRD 6, 11; 05-api 9.2a): base resumes and tailored copies, the default base per resume profile
 * that the legacy /resume routes alias, the truth-locked save, revisions through snapshot_resume(), and the saved
 * tailored copy per job (D2). Every read and write is scoped by user id; another user's id is a 404.
 */

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Row = typeof resumes.$inferSelect;

/**
 * Sent or on its way: the tailored copy is frozen (PRD 6.1). Coordinator ruling (WP-17 review): this is UI protection
 * only. What was sent is applications.resume_snapshot (WP-42, written by WP-29 in the approving transaction): the
 * receipt, the render and the applier attach read that, and nothing treats this resumes row as the sent document.
 */
const SENT = ["approved", "submitting", "submitted"] as const;
const DEFAULTS = { templateId: "kairos-single-v1", accent: null, pageSize: "letter", level: "mid", headline: null } as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One of the caller's resumes, or a 404 (also for an id that is not a uuid). */
export async function ownResume(userId: string, id: string, tx: Db | Tx = db()): Promise<Row> {
  if (!UUID.test(id)) throw notFound("Resume");
  const [row] = await tx.select().from(resumes).where(and(eq(resumes.id, id), eq(resumes.userId, userId), isNull(resumes.archivedAt)));
  if (!row) throw notFound("Resume");
  return row;
}

/** With `tx`, the application row is read FOR SHARE, so an approval cannot land between this check and the write. */
async function isReadOnly(row: Row, tx?: Tx): Promise<boolean> {
  if (row.kind !== "tailored" || !row.applicationId) return false;
  const q = (tx ?? db()).select({ status: applications.status }).from(applications).where(eq(applications.id, row.applicationId));
  const [app] = tx ? await q.for("share") : await q;
  return Boolean(app && (SENT as readonly string[]).includes(app.status));
}

/** The caller's resume inside a write transaction, refused when it is frozen. */
async function writable(tx: Tx, userId: string, id: string): Promise<Row> {
  const row = await ownResume(userId, id, tx);
  if (await isReadOnly(row, tx)) throw readOnlyError();
  return row;
}

/** What every /resumes route returns (resumeDetailSchema): the document with its design defaults and the library fields. */
export async function toDetail(row: Row): Promise<ResumeDetail> {
  const base = row.baseResumeId
    ? (await db().select({ name: resumes.name, version: resumes.version }).from(resumes).where(eq(resumes.id, row.baseResumeId)))[0]
    : undefined;
  return {
    ...DEFAULTS,
    ...row.document,
    id: row.id,
    updatedAt: row.updatedAt.toISOString(),
    kind: row.kind,
    libraryName: row.name,
    isDefault: row.isDefault,
    targetRoles: row.targetRoles,
    baseResumeId: row.baseResumeId,
    baseName: base?.name ?? null,
    baseChanged: Boolean(base && row.baseVersion !== null && base.version > row.baseVersion),
    jobId: row.jobId,
    applicationId: row.applicationId,
    readOnly: await isReadOnly(row),
  } as ResumeDetail;
}

/** GET /resumes: the caller's library, newest first within kind, with the job and application each copy belongs to. */
/**
 * The library list in keyset pages (lib/pagination.ts, opt-in): bases first, the default first among them, then newest
 * edit, all descending so one tuple compares. A tailored copy per job makes this list grow with applications.
 */
export async function listSummaries(
  userId: string,
  kind: "base" | "tailored" | undefined,
  page: { limit: number; after?: After },
): Promise<{ resumes: ResumeSummary[]; nextCursor?: string }> {
  const base = alias(resumes, "base");
  // A computed sort key: keysetBefore joins it like a column.
  const isBase = sql<boolean>`(${resumes.kind} = 'base')` as unknown as AnyColumn;
  const rows = await db()
    .select({
      r: resumes,
      cursorTs: tsKey(resumes.updatedAt),
      profileName: resumeProfiles.name,
      baseName: base.name,
      jobTitle: jobs.title,
      company: companies.name,
      matchScore: matches.score,
      appStatus: applications.status,
    })
    .from(resumes)
    .leftJoin(resumeProfiles, eq(resumeProfiles.id, resumes.resumeProfileId))
    .leftJoin(base, eq(base.id, resumes.baseResumeId))
    .leftJoin(jobs, eq(jobs.id, resumes.jobId))
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(matches, and(eq(matches.jobId, resumes.jobId), eq(matches.userId, userId)))
    .leftJoin(applications, eq(applications.id, resumes.applicationId))
    .where(
      and(
        eq(resumes.userId, userId),
        isNull(resumes.archivedAt),
        kind ? eq(resumes.kind, kind) : undefined,
        page.after && keysetBefore([isBase, resumes.isDefault, resumes.updatedAt], ["boolean", "boolean", "timestamptz"], resumes.id, page.after),
      ),
    )
    .orderBy(desc(isBase), desc(resumes.isDefault), desc(resumes.updatedAt), desc(resumes.id))
    .limit(page.limit + 1);
  const sliced = slicePage(rows, page.limit, "resumes", (x) => [x.r.kind === "base", x.r.isDefault, x.cursorTs], (x) => x.r.id);
  const profilesSeen = new Set(sliced.rows.map((x) => x.r.resumeProfileId));
  const many = profilesSeen.size > 1 || (await db().select({ id: resumeProfiles.id }).from(resumeProfiles).where(eq(resumeProfiles.userId, userId))).length > 1;
  const summaries = sliced.rows.map(({ r, cursorTs: _, ...x }): ResumeSummary => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    isDefault: r.isDefault,
    targetRoles: r.targetRoles,
    resumeProfileId: r.resumeProfileId ?? "",
    resumeProfileName: many ? x.profileName : null,
    baseResumeId: r.baseResumeId,
    baseName: x.baseName,
    jobId: r.jobId,
    jobTitle: x.jobTitle,
    company: x.company,
    // ponytail: tracker stages arrive with tracker_items (WP-21); until then null.
    stage: null,
    matchScore: x.matchScore === null ? null : Math.round(Number(x.matchScore)),
    // ponytail: the Resume check runs in the browser (PRD 6.6); a stored server score waits on WP-31's level-aware checks.
    checkScore: null,
    templateId: r.document.templateId ?? DEFAULTS.templateId,
    readOnly: r.kind === "tailored" && x.appStatus !== null && (SENT as readonly string[]).includes(x.appStatus),
    updatedAt: r.updatedAt.toISOString(),
  }));
  return { resumes: summaries, ...(sliced.nextCursor ? { nextCursor: sliced.nextCursor } : {}) };
}

/** The resume's contact for a new document: account and Profile, clipped to the schema's limits. */
async function contactFor(userId: string, tx: Db | Tx) {
  const [p] = await tx
    .select({ name: user.name, email: user.email, phone: profiles.phone, city: profiles.city, country: profiles.country, li: profiles.linkedinUrl, gh: profiles.githubUrl, pf: profiles.portfolioUrl })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(eq(user.id, userId));
  return {
    name: (p?.name ?? "").slice(0, 120),
    email: (p?.email ?? "").slice(0, 200),
    phone: (p?.phone ?? "").slice(0, 40),
    location: [p?.city, p?.country].filter(Boolean).join(", ").slice(0, 120),
    links: [p?.li, p?.gh, p?.pf].filter((l): l is string => Boolean(l)).map((l) => l.slice(0, 300)),
  };
}

/** Confirmed facts a resume of `profileId` may cite: that profile's, and the user's own typed ones (no profile). */
async function citable(tx: Db | Tx, userId: string, profileId: string | null) {
  return tx
    .select({ id: facts.id, kind: facts.kind, text: facts.text, sourceSpan: facts.sourceSpan, confirmed: facts.confirmed, employmentId: facts.employmentId, importId: facts.importId })
    .from(facts)
    .where(and(eq(facts.userId, userId), eq(facts.confirmed, true), profileId ? or(eq(facts.resumeProfileId, profileId), isNull(facts.resumeProfileId)) : undefined))
    .orderBy(asc(facts.createdAt), asc(facts.id));
}

/** A new document from confirmed facts, employment-aware; `importId` keeps that import's facts in file order. */
async function documentFromFacts(tx: Db | Tx, userId: string, profileId: string, importId?: string, duplicateIds: string[] = []): Promise<ResumeInput> {
  const rows = await citable(tx, userId, profileId);
  const picked = importId ? rows.filter((f) => f.importId === importId || duplicateIds.includes(f.id)) : rows;
  const roles = await tx
    .select({ id: employments.id, title: employments.title, company: employments.company, datesText: employments.datesText, confirmed: employments.confirmed })
    .from(employments)
    .where(and(eq(employments.userId, userId), eq(employments.resumeProfileId, profileId)))
    .orderBy(asc(employments.createdAt), asc(employments.id));
  return defaultResume(picked, await contactFor(userId, tx), roles);
}

/**
 * The default base resume of the user's default profile (the legacy /resume alias). On first use one is built from
 * confirmed facts; a concurrent first load converges on one row through resumes_default_uq.
 */
export async function defaultBase(userId: string, plan: PlanId): Promise<Row> {
  const find = async () => {
    const [row] = await db()
      .select({ r: resumes })
      .from(resumes)
      .innerJoin(resumeProfiles, eq(resumeProfiles.id, resumes.resumeProfileId))
      .where(and(eq(resumes.userId, userId), eq(resumes.kind, "base"), eq(resumes.isDefault, true), isNull(resumes.archivedAt)))
      .orderBy(desc(resumeProfiles.isDefault), asc(resumeProfiles.createdAt))
      .limit(1);
    return row?.r;
  };
  const found = await find();
  if (found) return found;
  await db().transaction(async (tx) => {
    const profileId = await profileFor(tx, userId, plan);
    const document = await documentFromFacts(tx, userId, profileId);
    await tx.insert(resumes).values({ userId, resumeProfileId: profileId, kind: "base", name: "Resume", isDefault: true, document }).onConflictDoNothing();
  });
  const stored = await find();
  if (!stored) throw new Error("Default resume insert returned no row");
  return stored;
}

/**
 * resumes_user_uq (one resume per user) is dropped by 0011, a contract migration that ships one release after this
 * code (WP-17 review): until it runs, a second resume of a user is refused here as 503, never a 500.
 * ponytail: delete this and its callers once 0011 has run everywhere.
 */
export const ONE_RESUME_UNTIL_0011 = () =>
  new HttpError(503, "service_unavailable", "A second resume opens with the next Kairos update. Your current resume is unchanged.", { reason: "resumes_user_uq" });
async function interim<T>(insert: () => Promise<T>): Promise<T> {
  try {
    return await insert();
  } catch (err) {
    const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
    if ((e.cause ?? e).code === "23505" && (e.cause ?? e).constraint === "resumes_user_uq") throw ONE_RESUME_UNTIL_0011();
    throw err;
  }
}

const limitReached = () =>
  new HttpError(409, "limit_reached", `You can keep ${MAX_BASE_RESUMES_PER_PROFILE} base resumes per profile. Delete one first.`, { limit: MAX_BASE_RESUMES_PER_PROFILE });

async function assertRoom(tx: Tx, profileId: string) {
  // The profile row is the lock: two creates at once cannot both pass the count.
  await tx.select({ id: resumeProfiles.id }).from(resumeProfiles).where(eq(resumeProfiles.id, profileId)).for("update");
  const [{ n }] = (await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(resumes)
    .where(and(eq(resumes.resumeProfileId, profileId), eq(resumes.kind, "base"), isNull(resumes.archivedAt)))) as [{ n: number }];
  if (n >= MAX_BASE_RESUMES_PER_PROFILE) throw limitReached();
  return n;
}

/** The truth lock of 05-api 11.1 step 2 for a document of `profileId`: 422 truth_lock with the offending line ids. */
async function assertTruthLock(tx: Db | Tx, userId: string, profileId: string | null, doc: ResumeInput, stored: ResumeInput | null) {
  const confirmed = await citable(tx, userId, profileId);
  const texts = new Map(confirmed.map((f) => [f.id, f.text]));
  const reasons = claimViolations(doc, texts, stored);
  const lineIds = [...new Set([...truthLockViolations(doc, new Set(texts.keys())), ...Object.keys(reasons)])];
  if (lineIds.length) {
    throw new HttpError(422, "truth_lock", "Some lines cite facts that are not confirmed in your profile, or add details those facts do not contain", {
      lineIds,
      ...(Object.keys(reasons).length ? { reasons } : {}),
    });
  }
}

export interface CreateFromFacts {
  name: string;
  targetRoles?: string[];
  resumeProfileId?: string;
  importId?: string;
}

/** POST /resumes from: facts (PRD 6.4 step 3): a new base from confirmed facts; the first base of a profile is its default. */
export async function createFromFacts(userId: string, plan: PlanId, input: CreateFromFacts): Promise<Row> {
  return db().transaction(async (tx) => {
    let profileId = await profileFor(tx, userId, plan, input.resumeProfileId);
    let duplicates: string[] = [];
    if (input.importId) {
      const [imp] = await tx
        .select({ profileId: resumeImports.resumeProfileId, dupes: resumeImports.duplicateFactIds })
        .from(resumeImports)
        .where(and(eq(resumeImports.userId, userId), eq(resumeImports.id, input.importId)));
      if (!imp) throw notFound("Import");
      profileId = imp.profileId;
      duplicates = imp.dupes;
    }
    const n = await assertRoom(tx, profileId);
    const document = await documentFromFacts(tx, userId, profileId, input.importId, duplicates);
    const [row] = await interim(() =>
      tx.insert(resumes).values({ userId, resumeProfileId: profileId, kind: "base", name: input.name, targetRoles: input.targetRoles ?? [], isDefault: n === 0, document }).returning(),
    );
    return row!;
  });
}

/** POST /resumes from: duplicate: a new base in the source's profile (also "Duplicate as a new base resume" of a sent copy). */
export async function duplicate(userId: string, sourceId: string, name: string, targetRoles?: string[]): Promise<Row> {
  return db().transaction(async (tx) => {
    const src = await ownResume(userId, sourceId, tx);
    const profileId = src.resumeProfileId ?? (await profileFor(tx, userId, "free"));
    await assertTruthLock(tx, userId, profileId, src.document, null);
    const n = await assertRoom(tx, profileId);
    const [row] = await interim(() =>
      tx.insert(resumes).values({ userId, resumeProfileId: profileId, kind: "base", name, targetRoles: targetRoles ?? src.targetRoles, isDefault: n === 0, document: src.document }).returning(),
    );
    return row!;
  });
}

const readOnlyError = () => new HttpError(409, "read_only", "This resume was sent with an application, so it cannot change. Duplicate it to edit.");

/**
 * Saves a whole document (PUT /resumes/:id, PUT /resume): truth lock, then the revision of the document as it was
 * (snapshot_resume coalesces an autosave burst), then the write. A default base writes its contact back to Profile,
 * since application forms are filled from it (B.8.3).
 */
export async function saveDocument(userId: string, id: string, doc: ResumeInput): Promise<Row> {
  return db().transaction(async (tx) => {
    const row = await writable(tx, userId, id);
    await assertTruthLock(tx, userId, row.resumeProfileId, doc, row.document);
    await tx.execute(sql`select snapshot_resume(${id}::uuid, ${userId}, 'edit', null, 'user')`);
    const [saved] = await tx.update(resumes).set({ document: doc, updatedAt: new Date() }).where(and(eq(resumes.id, id), eq(resumes.userId, userId))).returning();
    if (row.isDefault) {
      const [profile] = await tx.select({ country: profiles.country }).from(profiles).where(eq(profiles.userId, userId));
      if (profile) await tx.update(profiles).set({ ...profileContactFrom(doc.contact, profile.country), updatedAt: new Date() }).where(eq(profiles.userId, userId));
    }
    return saved!;
  });
}

export async function rename(userId: string, id: string, patch: { name?: string; targetRoles?: string[] }): Promise<Row> {
  return db().transaction(async (tx) => {
    const row = await writable(tx, userId, id);
    const [saved] = await tx
      .update(resumes)
      .set({ ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.targetRoles !== undefined ? { targetRoles: patch.targetRoles } : {}), updatedAt: new Date() })
      .where(eq(resumes.id, row.id))
      .returning();
    return saved!;
  });
}

/** DELETE /resumes/:id: the default base waits until another is default, and a profile keeps at least one base (PRD 6.6). */
export async function remove(userId: string, id: string): Promise<void> {
  await db().transaction(async (tx) => {
    const row = await ownResume(userId, id, tx);
    if (row.kind === "base") {
      if (row.isDefault) throw new HttpError(409, "is_default", "Make another resume the default before deleting this one.");
      const [{ n }] = (await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(resumes)
        .where(and(eq(resumes.resumeProfileId, row.resumeProfileId!), eq(resumes.kind, "base"), isNull(resumes.archivedAt)))) as [{ n: number }];
      if (n <= 1) throw new HttpError(409, "last_base", "You need at least one base resume.");
    }
    await tx.delete(resumes).where(eq(resumes.id, row.id));
  });
}

export async function setDefault(userId: string, id: string): Promise<Row> {
  return db().transaction(async (tx) => {
    const row = await ownResume(userId, id, tx);
    if (row.kind !== "base") throw new HttpError(409, "not_base", "Only a base resume can be the default.");
    await tx
      .update(resumes)
      .set({ isDefault: false })
      .where(and(eq(resumes.resumeProfileId, row.resumeProfileId!), eq(resumes.isDefault, true), sql`${resumes.id} <> ${row.id}`));
    const [saved] = await tx.update(resumes).set({ isDefault: true, updatedAt: new Date() }).where(eq(resumes.id, row.id)).returning();
    return saved!;
  });
}

/* ---- revisions ---- */

export async function listRevisions(userId: string, id: string) {
  await ownResume(userId, id);
  const rows = await db()
    .select({ id: resumeRevisions.id, name: resumeRevisions.name, reason: resumeRevisions.reason, createdAt: resumeRevisions.createdAt })
    .from(resumeRevisions)
    .where(eq(resumeRevisions.resumeId, id))
    .orderBy(desc(resumeRevisions.createdAt), desc(resumeRevisions.id));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

async function ownRevision(userId: string, id: string, revId: string) {
  await ownResume(userId, id);
  if (!UUID.test(revId)) throw notFound("Revision");
  const [rev] = await db().select().from(resumeRevisions).where(and(eq(resumeRevisions.id, revId), eq(resumeRevisions.resumeId, id)));
  if (!rev) throw notFound("Revision");
  return rev;
}

export async function getRevision(userId: string, id: string, revId: string) {
  const r = await ownRevision(userId, id, revId);
  return { id: r.id, name: r.name, reason: r.reason, createdAt: r.createdAt.toISOString(), document: r.document };
}

/** POST /resumes/:id/revisions: names the current document. */
export async function nameRevision(userId: string, id: string, name: string) {
  await ownResume(userId, id);
  const { rows } = await db().execute<{ id: string }>(sql`select snapshot_resume(${id}::uuid, ${userId}, 'named', ${name}, 'user') as id`);
  const [rev] = await db()
    .select({ id: resumeRevisions.id, name: resumeRevisions.name, reason: resumeRevisions.reason, createdAt: resumeRevisions.createdAt })
    .from(resumeRevisions)
    .where(eq(resumeRevisions.id, rows[0]!.id));
  return { ...rev!, createdAt: rev!.createdAt.toISOString() };
}

/** Restore re-runs the truth lock (a fact cited then may be unconfirmed now) and keeps the current document as a revision. */
export async function restore(userId: string, id: string, revId: string): Promise<Row> {
  const rev = await ownRevision(userId, id, revId);
  return db().transaction(async (tx) => {
    const row = await writable(tx, userId, id);
    await assertTruthLock(tx, userId, row.resumeProfileId, rev.document, null);
    await tx.execute(sql`select snapshot_resume(${id}::uuid, ${userId}, 'restore', null, 'user')`);
    const [saved] = await tx.update(resumes).set({ document: rev.document, updatedAt: new Date() }).where(eq(resumes.id, id)).returning();
    return saved!;
  });
}

/* ---- tailored copies (D2, PRD 6.1 to 6.3) ---- */

const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9+#]+/).filter((t) => t.length > 1));

/** PRD 6.2: the base whose target roles share the most words with the job title (ties to the newest edit), else the default. */
export function bestBaseFor<B extends { targetRoles: string[]; updatedAt: Date; isDefault: boolean }>(bases: B[], jobTitle: string): B | undefined {
  const want = tokens(jobTitle);
  let best: B | undefined;
  let bestScore = 0;
  for (const b of bases) {
    const have = new Set(b.targetRoles.flatMap((r) => [...tokens(r)]));
    const score = [...want].filter((t) => have.has(t)).length;
    if (score > bestScore || (score > 0 && score === bestScore && best && b.updatedAt > best.updatedAt)) {
      best = b;
      bestScore = score;
    }
  }
  return best ?? bases.find((b) => b.isDefault) ?? bases[0];
}

/** The active tailored copy of a job, if any. */
export async function copyFor(userId: string, jobId: string): Promise<Row | undefined> {
  const [row] = await db()
    .select()
    .from(resumes)
    .where(and(eq(resumes.userId, userId), eq(resumes.jobId, jobId), eq(resumes.kind, "tailored"), isNull(resumes.archivedAt)));
  return row;
}

/**
 * Saves the tailored copy of a job (D2): from `baseResumeId` (the caller's base) or the best base by target roles,
 * with the base's version for baseChanged, linked to the user's application for the job when one exists, and a
 * before_tailor revision. 409 exists when an active copy is already there (resumes_user_job_uq decides a race).
 */
export async function createCopy(user: Pick<SessionUser, "id">, plan: PlanId, job: { id: string; title: string; company: string }, baseResumeId?: string): Promise<Row> {
  const exists = (resumeId: string) => new HttpError(409, "exists", "This job already has a tailored resume.", { resumeId });
  const prior = await copyFor(user.id, job.id);
  if (prior) throw exists(prior.id);
  const base = baseResumeId
    ? await ownResume(user.id, baseResumeId)
    : bestBaseFor(
        await db().select().from(resumes).where(and(eq(resumes.userId, user.id), eq(resumes.kind, "base"), isNull(resumes.archivedAt))),
        job.title,
      ) ?? (await defaultBase(user.id, plan));
  if (base.kind !== "base") throw notFound("Resume");
  const [app] = await db().select({ id: applications.id }).from(applications).where(and(eq(applications.userId, user.id), eq(applications.jobId, job.id))).limit(1);
  const [row] = await db()
    .insert(resumes)
    .values({
      userId: user.id,
      resumeProfileId: base.resumeProfileId,
      kind: "tailored",
      name: `${job.title} at ${job.company}`.slice(0, 80),
      targetRoles: [],
      baseResumeId: base.id,
      baseVersion: base.version,
      jobId: job.id,
      applicationId: app?.id ?? null,
      document: base.document,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) {
    // A lost race on resumes_user_job_uq is a copy that exists; anything else is resumes_user_uq before 0011.
    const raced = await copyFor(user.id, job.id);
    throw raced ? exists(raced.id) : ONE_RESUME_UNTIL_0011();
  }
  await db().execute(sql`select snapshot_resume(${row.id}::uuid, ${user.id}, 'before_tailor', ${`Before tailoring for ${job.company}`.slice(0, 80)}, 'system')`);
  return row;
}

