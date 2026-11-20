"use client";

import { useSyncExternalStore } from "react";

/**
 * When this person last opened Replies on this device (ISO string). The API keeps no read state, so this is all the
 * header bell knows: it counts replies received after this mark. Storage can throw (private mode, blocked site data):
 * then nothing is stored and the bell shows no count.
 */
const KEY = "kairos.inbox.seen";
const EVENT = "kairos:inbox-seen";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** The mark in ms, or null when none is stored (first visit, blocked storage, server render). */
export function useInboxSeen(): number | null {
  const t = Date.parse(useSyncExternalStore(subscribe, read, () => null) ?? "");
  return Number.isNaN(t) ? null : t;
}

/**
 * Marks `emails` as seen: the mark moves to the newest receivedAt (now when there are none) and never moves back.
 * ponytail: a reply whose receivedAt is older than the mark (forwarded days late) never counts; a server-side
 * read state is the fix if that turns out to matter.
 */
export function markInboxSeen(emails: { receivedAt: string }[]) {
  const newest = emails.reduce((max, e) => Math.max(max, Date.parse(e.receivedAt) || 0), 0) || Date.now();
  if (Date.parse(read() ?? "") >= newest) return; // NaN (no mark yet) compares false, so it writes
  try {
    localStorage.setItem(KEY, new Date(newest).toISOString());
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}
