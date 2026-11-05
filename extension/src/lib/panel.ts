import type { QueueOutcome } from "./messages";

/** What one row in the side panel is showing. */
export type RowState =
  | { kind: "idle"; note?: string }
  | { kind: "sending" }
  | { kind: "review" }
  | { kind: "submitted" }
  | { kind: "failed"; text: string }
  | { kind: "unrecorded" };

const BOARDS: Record<string, string> = { "greenhouse.io": "Greenhouse", "lever.co": "Lever", "ashbyhq.com": "Ashby" };

/**
 * "Acme corp · Greenhouse" from the apply URL. All four supported boards put the company slug first in the path.
 * ponytail: a slug, not the company's name; add `company` to GET /api/extension/queue (additive, one join) for the real one.
 */
export function describeSource(applyUrl: string): string {
  let url: URL;
  try {
    url = new URL(applyUrl);
  } catch {
    return "";
  }
  const board = Object.entries(BOARDS).find(([host]) => url.hostname === host || url.hostname.endsWith(`.${host}`))?.[1] ?? url.hostname;
  const slug = url.pathname.split("/").find(Boolean);
  if (!slug) return board;
  const words = decodeURIComponent(slug).replace(/[-_]+/g, " ").trim();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} · ${board}`;
}

export function summarize(count: number): string {
  if (count === 0) return "Nothing left to send.";
  return `${count} approved application${count === 1 ? "" : "s"} waiting.`;
}

/**
 * The filler's reason, in words a person can act on. "No confirmation" can mean the employer did receive it, so that case
 * must never say nothing was sent (same wording as FAILURE_MESSAGES.unconfirmed on the server). No failure costs a credit.
 */
export function failureText(reason?: string): string {
  if (reason?.startsWith("No confirmation")) {
    return "We could not confirm whether the employer received this application. No credit was used. Check your email for their confirmation before you send it again.";
  }
  const clean = reason?.trim().replace(/\.$/, "");
  return `${clean ? `${clean}. ` : ""}Nothing was sent and no credit was used.`;
}

export function stateFor(update: QueueOutcome): RowState {
  switch (update.outcome) {
    case "submitted":
      return { kind: "submitted" };
    case "failed":
      return { kind: "failed", text: failureText(update.reason) };
    case "unrecorded":
      return { kind: "unrecorded" };
    case "closed":
      return { kind: "idle", note: "The tab closed before Kairos saw a result. Check your email for the employer's confirmation before you send it again." };
  }
}
