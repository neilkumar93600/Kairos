import type { ApplicationAnswer, SubmissionReport } from "@auto-career/shared";
import { detectAdapter, type AtsFormAdapter } from "./ats";
import { pageText } from "./ats/types";
import { attachFile, findField, setValue, waitFor } from "./lib/fill";
import type { FillPayload } from "./lib/messages";

/** Splits "first_name"/"last_name" answers into the single full-name field some boards use, and back. */
function expandAnswers(answers: ApplicationAnswer[]): ApplicationAnswer[] {
  const first = answers.find((a) => a.fieldKey === "first_name")?.value ?? "";
  const last = answers.find((a) => a.fieldKey === "last_name")?.value ?? "";
  const full = `${first} ${last}`.trim();
  return full ? [...answers, { fieldKey: "full_name", label: "Full name", value: full, source: "profile" }] : answers;
}

function fieldFor(doc: Document, adapter: AtsFormAdapter | null, answer: ApplicationAnswer) {
  for (const alias of adapter?.fieldAliases[answer.fieldKey] ?? []) {
    const el = findField(doc, alias, "");
    if (el) return el;
  }
  return findField(doc, answer.fieldKey, answer.label);
}

/** The report, plus whether the page already read "application received" before the click (the cloud applier uses it). */
export type FillReport = SubmissionReport & { matchedBefore?: boolean };

/**
 * Fills the current page's application form and, when payload.submit is true, submits it and waits
 * for the board's confirmation. Runs in the content script and, injected, in the cloud applier.
 */
export async function fillApplication(payload: FillPayload, doc: Document = document, location: Location = window.location): Promise<FillReport> {
  const url = new URL(location.href);
  const adapter = detectAdapter(url);
  const filledFields: SubmissionReport["filledFields"] = [];
  const missing: string[] = [];

  for (const answer of expandAnswers(payload.answers)) {
    if (!answer.value) continue;
    const el = fieldFor(doc, adapter, answer);
    if (el && setValue(el, answer.value)) filledFields.push({ fieldKey: answer.fieldKey, label: answer.label, value: answer.value });
    else if (answer.fieldKey !== "full_name" && answer.fieldKey !== "first_name" && answer.fieldKey !== "last_name") missing.push(answer.label);
  }

  if (payload.resumePdfUrl && adapter) {
    const input = doc.querySelector<HTMLInputElement>(adapter.resumeInputSelector);
    if (input && (await attachFile(input, payload.resumePdfUrl, "resume.pdf"))) {
      filledFields.push({ fieldKey: "resume", label: "Resume", value: "resume.pdf" });
    } else missing.push("Resume");
  }

  let matchedBefore = false;
  const fail = (reason: string): FillReport => ({
    applicationId: payload.applicationId,
    outcome: "failed",
    failureReason: reason,
    matchedBefore,
    filledFields,
    submittedAt: new Date().toISOString(),
  });

  if (!adapter) return fail(`Unsupported application page: ${url.hostname}`);
  const requiredEmpty = Array.from(doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[required]")).filter(
    (el) => el.type !== "file" && !el.value,
  );
  if (requiredEmpty.length > 0) return fail(`Required fields left empty: ${requiredEmpty.length}. Review the form in the tab.`);
  if (!payload.submit) return fail("Filled for review; not submitted");

  const button = doc.querySelector<HTMLElement>(adapter.submitSelector);
  if (!button) return fail("Submit button not found");
  // Only the board's own confirmation address, reached by the submit, confirms (CEO decision 2026-11-27, R3c). Page text never does:
  // a job description or an error after a refused POST can say "application received" (B1, B3, B4 settled a 422 as submitted).
  // So a board that confirms in place (Ashby) ends as "No confirmation", which settles as needs_check: never a charge.
  matchedBefore = adapter.isConfirmation(doc, url);
  const hrefBefore = location.href;
  button.click();

  const confirmed = await waitFor(() => (location.href !== hrefBefore && adapter.isConfirmationUrl(new URL(location.href)) ? true : null), 20_000);
  if (!confirmed) return fail(missing.length ? `No confirmation; unfilled: ${missing.join(", ")}` : "No confirmation after submit");

  return {
    applicationId: payload.applicationId,
    outcome: "submitted",
    matchedBefore,
    filledFields,
    confirmationText: pageText(doc).slice(0, 1000),
    submittedAt: new Date().toISOString(),
  };
}

// Exposed for the cloud applier, which injects this bundle with Playwright.
(globalThis as unknown as { __kairosFill: typeof fillApplication }).__kairosFill = (payload) => fillApplication(payload);
