import { pgEnum } from "drizzle-orm/pg-core";
import {
  APPLICATION_STATUSES,
  ATS_PROVIDERS,
  BILLING_INTERVALS,
  CREDIT_REASONS,
  EMAIL_KINDS,
  FACT_KINDS,
  MATCH_STATUSES,
  PLAN_IDS,
  SUBMIT_CHANNELS,
} from "@auto-career/shared";

export const atsProvider = pgEnum("ats_provider", ATS_PROVIDERS);
export const matchStatus = pgEnum("match_status", MATCH_STATUSES);
export const applicationStatus = pgEnum("application_status", APPLICATION_STATUSES);
export const submitChannel = pgEnum("submit_channel", SUBMIT_CHANNELS);
export const factKind = pgEnum("fact_kind", FACT_KINDS);
export const emailKind = pgEnum("email_kind", EMAIL_KINDS);
export const creditReason = pgEnum("credit_reason", CREDIT_REASONS);
export const planId = pgEnum("plan_id", PLAN_IDS);
export const billingInterval = pgEnum("billing_interval", BILLING_INTERVALS);
