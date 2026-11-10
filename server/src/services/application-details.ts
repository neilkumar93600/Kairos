import type { ApplicationDetails } from "@auto-career/shared";
import { decrypt, type Aad, type Keyring } from "../lib/crypto";
import { logger } from "../lib/logger";

/** AAD of profiles.sensitive_answers_enc: the profile row (keyed by user id) and the column (lib/crypto.ts). */
export const detailsAad = (userId: string): Aad => ({ table: "profiles", id: userId, column: "sensitive_answers_enc" });

/** Replaces only the three application-detail keys; any other sensitive answer already stored (EEO, visa...) stays. */
export function mergeDetails(stored: Record<string, unknown> | null, patch: ApplicationDetails): Record<string, unknown> {
  return { ...stored, noticePeriod: patch.noticePeriod, openToRelocation: patch.openToRelocation, expectedSalary: patch.expectedSalary };
}

/**
 * The stored object, or null when nothing is stored or the envelope cannot be read (wrong key, foreign row, corrupt).
 * An unreadable envelope is logged by user only, never by content, and treated as empty so the wizard cannot 500.
 */
export function readDetails(envelope: Uint8Array | null, userId: string, keys?: Keyring): Record<string, unknown> | null {
  if (!envelope) return null;
  try {
    const parsed: unknown = JSON.parse(decrypt(envelope, detailsAad(userId), keys).toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    logger.warn({ userId }, "application details unreadable; treated as empty");
    return null;
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
