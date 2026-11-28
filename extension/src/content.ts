import type { SubmissionReport } from "@auto-career/shared";
import { detectAdapter } from "./ats";
import { pageText } from "./ats/types";
import { fillApplication } from "./filler";
import { waitFor } from "./lib/fill";
import type { FillPayload } from "./lib/messages";

const REVIEW_WINDOW_MS = 15 * 60_000;

/**
 * Runs on supported application pages. If the background worker opened this tab for an approved
 * application, it answers with the payload; otherwise the page is left alone.
 */
async function main() {
  const adapter = detectAdapter(new URL(window.location.href));
  if (!adapter) return;
  const payload = (await chrome.runtime.sendMessage({ type: "content:ready" })) as (FillPayload & { confirmOnly?: undefined }) | { confirmOnly: true; applicationId: string } | null;
  if (!payload) return;
  if (payload.confirmOnly) {
    // The page after a navigating submit. Only the board's own confirmation address counts; text on a page proves nothing here.
    if (!adapter.isConfirmationUrl(new URL(window.location.href))) return;
    await chrome.runtime.sendMessage({
      type: "content:report",
      report: { applicationId: payload.applicationId, outcome: "submitted", filledFields: [], confirmationText: pageText(document).slice(0, 1000), submittedAt: new Date().toISOString() },
    });
    return;
  }
  const loadHref = window.location.href;
  if (!payload.submit) {
    // Review mode: the user presses the board's own submit button, possibly before the fill below finishes (a slow resume
    // download). Once they do, tell the worker: from then on the claim is never released (a release offers Send again and
    // would double-apply) and later pages are confirm-only. So the listeners go on before the fill, not after it.
    const handOver = () => void chrome.runtime.sendMessage({ type: "content:handed", applicationId: payload.applicationId });
    document.addEventListener("submit", handOver, true);
    document.addEventListener("click", (e) => (e.target instanceof Element && e.target.closest(adapter.submitSelector) ? handOver() : undefined), true);
  }
  const report: SubmissionReport = await fillApplication(payload);

  if (!payload.submit) {
    // Same rule as the filler: only the board's confirmation address, reached after load, confirms. Page text never does
    // (a description can say "application received"). Ashby confirms in place, so it reports nothing and settles as needs_check.
    const confirmed = await waitFor(
      () => (window.location.href !== loadHref && adapter.isConfirmationUrl(new URL(window.location.href)) ? true : null),
      REVIEW_WINDOW_MS,
      1000,
    );
    if (!confirmed) return;
    await chrome.runtime.sendMessage({
      type: "content:report",
      report: { ...report, outcome: "submitted", failureReason: undefined, confirmationText: pageText(document).slice(0, 1000), submittedAt: new Date().toISOString() },
    });
    return;
  }
  await chrome.runtime.sendMessage({ type: "content:report", report });
}

void main();
