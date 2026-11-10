/**
 * sessionStorage for the wizard, so a reload or a retry picks up where it was. Storage can throw (blocked, private
 * mode); then it starts over. Also the pending base guard shared by upload, paste and the fill-in form.
 */
export function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: string | null) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // no storage: nothing to pick up after a reload
  }
}

const MADE = "kairos.onboarding.resumeId"; // { resumeId, from }: a base made whose /default failed; a retry from the same basis only repeats /default

/** A pending base is reused only for what it was built from (the same import or the form, and target roles); anything else makes a new one. */
export const basis = (from: string | null, roles: string[]) => JSON.stringify([from, roles]);

export function pendingBase(from: string): string | undefined {
  try {
    const p = JSON.parse(readSession(MADE) ?? "null") as { resumeId: string; from: string } | null;
    return p?.from === from ? p.resumeId : undefined;
  } catch {
    return undefined;
  }
}

/** Heard from createBase's onCreated, before /default: a retry passes it back as resumeId. */
export const keepPendingBase = (resumeId: string, from: string) => writeSession(MADE, JSON.stringify({ resumeId, from }));

/** A base resume exists now, or its basis changed (a new import, another file, a lost import): forget the pending one. */
export const forgetPendingBase = () => writeSession(MADE, null);

/** Sign-out: the wizard's drafts and ids in this tab belong to the account leaving, not to whoever signs in next. */
export function forgetOnboarding() {
  try {
    const keys = Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i) ?? "");
    for (const k of keys) if (k.startsWith("kairos.onboarding.")) sessionStorage.removeItem(k);
  } catch {
    // no storage: nothing kept to forget
  }
}
