"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ApplicationDetail } from "@/hooks/use-applications";
import { Panel } from "../../shared/panel";
import { APPLICATION_STATUS } from "../../shared/status";
import { WithdrawButton, inlineLink } from "../queue/send-controls";

const stamp = (iso: string) => new Date(iso).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });

/** Label and value, two columns from sm, hairline rows. The one list layout for everything a receipt states. */
function Rows({ rows, short }: { rows: [string, ReactNode][]; short?: boolean }) {
  return (
    <dl>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className={`grid border-t border-line px-6 py-3 ${short ? "grid-cols-[6rem_minmax(0,1fr)] gap-4" : "gap-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6"}`}
        >
          <dt className="text-sm text-faint">{label}</dt>
          <dd className="text-sm break-words text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** What was actually sent: every field, the channel and the confirmation the board showed. Failures say so plainly. */
export function ReceiptView({ application }: { application: ApplicationDetail["application"] }) {
  const { status, receipt } = application;
  const word = APPLICATION_STATUS[status];

  if (status === "submitted" && receipt) {
    return (
      <div className="@container">
      <div className="grid gap-6 @4xl:grid-cols-[minmax(0,1fr)_22rem] @4xl:grid-rows-[auto_1fr] @4xl:items-start @6xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel flush title="Receipt" className="@4xl:col-start-2 @4xl:row-start-1">
          <Rows
            short
            rows={[
              ["Sent by", receipt.channel === "cloud" ? "Cloud applier" : "Chrome extension"],
              ["Sent at", application.submittedAt ? <time dateTime={application.submittedAt}>{stamp(application.submittedAt)}</time> : "Not recorded"],
              ["Credit", "1 used"],
            ]}
          />
        </Panel>

        <Panel
          flush
          title="Filled fields"
          description={`Exactly what the form received, ${receipt.filledFields.length} ${receipt.filledFields.length === 1 ? "field" : "fields"}.`}
          className="@4xl:col-start-1 @4xl:row-span-2 @4xl:row-start-1"
        >
          {receipt.filledFields.length ? (
            <Rows rows={receipt.filledFields.map((f) => [f.label, f.value || <span className="text-faint">Left empty</span>])} />
          ) : (
            <p className="border-t border-line px-6 py-4 text-sm text-body">No fields were reported.</p>
          )}
        </Panel>

        <Panel title="Employer's confirmation" className="@4xl:col-start-2 @4xl:row-start-2">
          {receipt.confirmationText ? (
            <blockquote className="rounded-input bg-sunk px-4 py-3 text-sm leading-relaxed text-ink">{receipt.confirmationText}</blockquote>
          ) : (
            <p className="text-sm text-body">The employer&apos;s page showed no confirmation text.</p>
          )}
        </Panel>
      </div>
      </div>
    );
  }

  const reason = application.failureReason ?? "No reason was reported.";
  const states: Record<string, { title: string; body: ReactNode; rows?: [string, ReactNode][] }> = {
    submitted: { title: "Submitted", body: "The receipt for this application is not available yet. Check back in a minute." },
    approved: {
      title: "Approved, not sent yet",
      body: "It goes out from the extension side panel when you press Send, or from the cloud applier if you chose it. Until then you can withdraw it.",
    },
    submitting: { title: "Sending now", body: "The form is being filled in and submitted. Refresh in a minute to see the receipt." },
    failed: {
      title: "Not sent",
      body: "The application did not go through.",
      rows: [
        ["Reason", reason],
        ["Credit", "None charged. Failed applications cost nothing."],
      ],
    },
    refunded: {
      title: "Not sent, credit refunded",
      body: (
        <>
          The application did not go through, so the credit it used went back to your balance.{" "}
          <Link href="/billing" className={inlineLink}>
            See the credit ledger
          </Link>
        </>
      ),
      rows: [
        ["Reason", reason],
        ["Credit", "Refunded"],
      ],
    },
    withdrawn: { title: "Withdrawn", body: "You withdrew it before it was sent. Nothing went to the employer and no credit was used." },
  };
  const state = states[status] ?? { title: word.label, body: "No receipt yet." };

  return (
    <Panel flush title={state.title} className="max-w-3xl">
      <p className="px-6 pb-4 text-sm text-body">{state.body}</p>
      {state.rows ? <Rows short rows={state.rows} /> : null}
      {status === "approved" ? (
        <div className="border-t border-line px-6 py-3">
          <WithdrawButton id={application.id} noun="application" />
        </div>
      ) : null}
    </Panel>
  );
}
