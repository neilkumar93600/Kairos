import { and, eq, isNull, sql } from "drizzle-orm";
import type { EmailPreferences } from "@auto-career/shared";
import type { Db } from "../db/client";
import { consentRecords, mailOptOuts, profiles, user, type MAIL_OPT_OUTS } from "../db/schema";
import { CONSENT_PURPOSE } from "../lib/broadcast";
import { env } from "../lib/env";
import { addressHash } from "../lib/mailer";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Key = (typeof MAIL_OPT_OUTS)[number];

/** The API's names for the stored keys. */
const FIELD = { digest: "digest", outcome_report: "outcomeReport", autopilot_summary: "autopilotSummary", reminders: "reminders" } as const satisfies Record<Key, keyof EmailPreferences>;
const KEYS = Object.keys(FIELD) as Key[];

/** What the person gets now; null when there is no profile. */
export async function readEmailPreferences(db: Db | Tx, userId: string): Promise<EmailPreferences | null> {
  const [p] = await db.select({ optOut: profiles.mailOptOut }).from(profiles).where(eq(profiles.userId, userId));
  if (!p) return null;
  return Object.fromEntries(KEYS.map((k) => [FIELD[k], !p.optOut.includes(k)])) as unknown as EmailPreferences;
}

/**
 * Turns one optional mail kind on or off, in the caller's transaction, and keeps the consent record in step (WP-44
 * handoff): turning it on records the grant, turning it off (or an unsubscribe link) withdraws it. Idempotent. The
 * send path reads profiles.mail_opt_out at send time (jobs/notify.ts), so this takes effect for the very next email.
 */
export async function setMailKind(tx: Db | Tx, userId: string, key: Key, wanted: boolean): Promise<void> {
  await tx
    .update(profiles)
    .set({
      mailOptOut: wanted
        ? sql`array_remove(${profiles.mailOptOut}, ${key})`
        : sql`CASE WHEN ${key} = ANY(${profiles.mailOptOut}) THEN ${profiles.mailOptOut} ELSE array_append(${profiles.mailOptOut}, ${key}) END`,
    })
    .where(eq(profiles.userId, userId));
  // The objection outlives the account (registry: mail_opt_outs is kept on purpose), keyed by the address's hash. Without
  // USER_HASH_KEY (development) there is no hash to keep.
  if (env().USER_HASH_KEY) {
    const [account] = await tx.select({ email: user.email }).from(user).where(eq(user.id, userId));
    if (account) {
      const hash = addressHash(account.email);
      if (wanted) await tx.delete(mailOptOuts).where(and(eq(mailOptOuts.addressHash, hash), eq(mailOptOuts.kind, key)));
      else await tx.insert(mailOptOuts).values({ addressHash: hash, kind: key }).onConflictDoNothing();
    }
  }
  const purpose = CONSENT_PURPOSE[key];
  if (wanted) {
    await tx
      .insert(consentRecords)
      .values({ userId, purpose, version: env().PRIVACY_NOTICE_VERSION })
      .onConflictDoUpdate({
        target: [consentRecords.userId, consentRecords.purpose, consentRecords.version],
        set: { grantedAt: sql`now()`, withdrawnAt: null },
        setWhere: sql`${consentRecords.withdrawnAt} IS NOT NULL`,
      });
  } else {
    await tx
      .update(consentRecords)
      .set({ withdrawnAt: sql`now()` })
      .where(and(eq(consentRecords.userId, userId), eq(consentRecords.purpose, purpose), isNull(consentRecords.withdrawnAt)));
  }
}

/** Applies a PATCH of the API's field names. */
export async function patchEmailPreferences(tx: Db | Tx, userId: string, patch: Partial<EmailPreferences>): Promise<void> {
  for (const key of KEYS) {
    const wanted = patch[FIELD[key]];
    if (wanted !== undefined) await setMailKind(tx, userId, key, wanted);
  }
}

/** The kinds an address objected to before (a past account), so a new sign-up with it starts opted out of them. */
export async function keptOptOuts(tx: Db | Tx, email: string): Promise<Set<Key>> {
  if (!env().USER_HASH_KEY) return new Set();
  const rows = await tx.select({ kind: mailOptOuts.kind }).from(mailOptOuts).where(eq(mailOptOuts.addressHash, addressHash(email)));
  return new Set(rows.map((r) => r.kind as Key));
}
