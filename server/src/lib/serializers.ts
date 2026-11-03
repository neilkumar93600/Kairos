import { PUBLIC_PLAN_KEYS, type Plan, type PublicPlan } from "@auto-career/shared";
import { applications, creditLedger, facts, jobs, profiles, resumeProfiles, subscriptions } from "../db/schema";

/**
 * Response pick-lists (05-api 10.2, 12.1, 12.4; CISO should-fix "serializers"). Routes select these columns or copy these
 * keys, never a whole row, so a column a migration adds stays internal until it is named here. Never exposed: Stripe
 * ids, plan cost controls, raw provider payloads, resume source text, sensitive_answers_enc and normalized_email_hash.
 */

export const publicPlan = (plan: Plan): PublicPlan => Object.fromEntries(PUBLIC_PLAN_KEYS.map((k) => [k, plan[k]])) as PublicPlan;

/** GET /api/me `subscription`: no customer or subscription id, no owner, no grace anchor. */
export const SUBSCRIPTION_COLUMNS = {
  plan: subscriptions.plan,
  interval: subscriptions.interval,
  status: subscriptions.status,
  currentPeriodEnd: subscriptions.currentPeriodEnd,
  cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
  pausedUntil: subscriptions.pausedUntil,
  updatedAt: subscriptions.updatedAt,
};

/** GET /api/credits entries: no Stripe invoice id. */
export const LEDGER_COLUMNS = {
  id: creditLedger.id,
  userId: creditLedger.userId,
  delta: creditLedger.delta,
  reason: creditLedger.reason,
  applicationId: creditLedger.applicationId,
  note: creditLedger.note,
  createdAt: creditLedger.createdAt,
};

/** The frozen profile shape. */
export const PROFILE_COLUMNS = {
  userId: profiles.userId,
  phone: profiles.phone,
  city: profiles.city,
  country: profiles.country,
  linkedinUrl: profiles.linkedinUrl,
  githubUrl: profiles.githubUrl,
  portfolioUrl: profiles.portfolioUrl,
  preferences: profiles.preferences,
  onboardingStep: profiles.onboardingStep,
  forwardingAddress: profiles.forwardingAddress,
  createdAt: profiles.createdAt,
  updatedAt: profiles.updatedAt,
};

/** POST /api/profile/resumes: the new row without the pasted text or the file key (the web ignores the body). */
export const RESUME_PROFILE_COLUMNS = {
  id: resumeProfiles.id,
  userId: resumeProfiles.userId,
  name: resumeProfiles.name,
  isDefault: resumeProfiles.isDefault,
  createdAt: resumeProfiles.createdAt,
};

/** Facts as the profile routes return them. */
export const FACT_COLUMNS = {
  id: facts.id,
  kind: facts.kind,
  text: facts.text,
  sourceSpan: facts.sourceSpan,
  confirmed: facts.confirmed,
  assertedBy: facts.assertedBy,
  confirmedAt: facts.confirmedAt,
  createdAt: facts.createdAt,
  updatedAt: facts.updatedAt,
};

/** GET and PATCH /api/applications/:id `application`: the frozen keys; lease, snapshot and attempt columns stay out. */
export const APPLICATION_COLUMNS = {
  id: applications.id,
  userId: applications.userId,
  jobId: applications.jobId,
  matchId: applications.matchId,
  resumeProfileId: applications.resumeProfileId,
  status: applications.status,
  channel: applications.channel,
  resumeLines: applications.resumeLines,
  answers: applications.answers,
  coverLetter: applications.coverLetter,
  receipt: applications.receipt,
  failureReason: applications.failureReason,
  approvedAt: applications.approvedAt,
  submittedAt: applications.submittedAt,
  createdAt: applications.createdAt,
  updatedAt: applications.updatedAt,
};

/** GET /api/applications/:id `job`: the frozen keys minus `raw`, the ATS payload no client reads. */
export const JOB_COLUMNS = {
  id: jobs.id,
  companyId: jobs.companyId,
  externalId: jobs.externalId,
  title: jobs.title,
  location: jobs.location,
  remote: jobs.remote,
  department: jobs.department,
  descriptionText: jobs.descriptionText,
  applyUrl: jobs.applyUrl,
  salaryMinUsd: jobs.salaryMinUsd,
  salaryMaxUsd: jobs.salaryMaxUsd,
  postedAt: jobs.postedAt,
  firstSeenAt: jobs.firstSeenAt,
  closedAt: jobs.closedAt,
  source: jobs.source,
};
