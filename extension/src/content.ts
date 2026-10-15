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
  const payload = (await chrome.runtime.sendMessage({ type: "content:ready" })) as FillPayload | null;
  if (!payload) return;
  const report: SubmissionReport = await fillApplication(payload);

  if (!payload.submit && report.outcome === "failed") {
    // Review mode: the user checks the filled form and presses the board's own submit button.
    // When the board shows its confirmation, record the submission with what we filled.
    const confirmed = await waitFor(() => adapter.isConfirmation(document, new URL(window.location.href)) || null, REVIEW_WINDOW_MS, 1000);
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
