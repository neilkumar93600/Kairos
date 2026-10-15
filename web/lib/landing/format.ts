/**
 * Display helpers for the landing page. Money is integer arithmetic only: cents for charges,
 * thousandths of a dollar for price per application. Fixed en-US so server and client agree.
 */

const GROUP = new Intl.NumberFormat("en-US");

/** COPY {approvedAt}: one string shared by the DOM stamp, the canvas stamp and entries 01, 05 and 10. */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sample"; // the deck's word for "visitor has not approved"
  return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(d);
}

/** COPY {approvedTime}: time only, in the visitor's locale (entries 01, 04 and 10). "" for an unparseable string. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(d);
}

/** 3900 -> "$39.00" */
export function formatUsd(cents: number): string {
  const whole = Math.trunc(cents / 100);
  return `$${GROUP.format(whole)}.${String(Math.abs(cents % 100)).padStart(2, "0")}`;
}

/** 65 -> "$0.065", 39000 -> "$39.000" */
export function formatPerApp(thousandths: number): string {
  const whole = Math.trunc(thousandths / 1000);
  return `$${GROUP.format(whole)}.${String(Math.abs(thousandths % 1000)).padStart(3, "0")}`;
}

/** 1200 -> "1,200" */
export function formatCredits(n: number): string {
  return GROUP.format(n);
}
