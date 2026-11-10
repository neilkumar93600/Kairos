import type { ApplicationDetails } from "@auto-career/shared";
import { decrypt, type Aad, type Keyring } from "../lib/crypto";
import { HttpError } from "../lib/errors";
import { logger } from "../lib/logger";

/** AAD of profiles.sensitive_answers_enc: the profile row (keyed by user id) and the column (lib/crypto.ts). */
export const detailsAad = (userId: string): Aad => ({ table: "profiles", id: userId, column: "sensitive_answers_enc" });

/** Replaces only the three application-detail keys; any other sensitive answer already stored (EEO, visa...) stays. */
export function mergeDetails(stored: Record<string, unknown> | null, patch: ApplicationDetails): Record<string, unknown> {
  return { ...stored, noticePeriod: patch.noticePeriod, openToRelocation: patch.openToRelocation, expectedSalary: patch.expectedSalary };
}

/** The stored object; null only when nothing is stored. Throws when an envelope exists but cannot be read or parsed. */
export function readDetailsStrict(envelope: Uint8Array | null, userId: string, keys?: Keyring): Record<string, unknown> | null {
  if (!envelope) return null;
  const parsed: unknown = JSON.parse(decrypt(envelope, detailsAad(userId), keys).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("stored details are not an object");
  return parsed as Record<string, unknown>;
}

/** For reads: an unreadable envelope reads as empty (logged by user only, never by content) so the wizard still renders. */
export function readDetails(envelope: Uint8Array | null, userId: string, keys?: Keyring): Record<string, unknown> | null {
  try {
    return readDetailsStrict(envelope, userId, keys);
  } catch {
    logger.warn({ userId }, "application details unreadable; treated as empty");
    return null;
  }
}

/** For writes: refuse rather than overwrite what a restored key could still read. */
export function readDetailsForWrite(envelope: Uint8Array | null, userId: string, keys?: Keyring): Record<string, unknown> | null {
  try {
    return readDetailsStrict(envelope, userId, keys);
  } catch {
    logger.warn({ userId }, "application details unreadable; write refused");
    throw new HttpError(409, "details_unreadable", "Your saved details can't be read right now.");
  }
}

/** What the API returns: only the three known keys, null when absent or of the wrong shape. */
export function publicDetails(stored: Record<string, unknown> | null): ApplicationDetails {
  const s = stored ?? {};
  return {
    noticePeriod: (s.noticePeriod as ApplicationDetails["noticePeriod"]) ?? null,
    openToRelocation: typeof s.openToRelocation === "boolean" ? s.openToRelocation : null,
    expectedSalary: (s.expectedSalary as ApplicationDetails["expectedSalary"]) ?? null,
  };
}
