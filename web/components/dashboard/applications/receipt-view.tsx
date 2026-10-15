import type { ApplicationDetail } from "@/hooks/use-applications";
import { formatDate } from "@/lib/utils";

/** What was actually sent: every field, the channel and the confirmation the board showed. */
export function ReceiptView({ application }: { application: ApplicationDetail["application"] }) {
  const receipt = application.receipt;
  if (!receipt) {
    return <p className="text-sm text-body">{application.failureReason ? `Not sent: ${application.failureReason}` : "No receipt yet."}</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-body">
        Sent {application.submittedAt ? formatDate(application.submittedAt) : ""} by the {receipt.channel === "cloud" ? "cloud applier" : "Chrome extension"}.
      </p>
      <dl className="divide-y divide-line border-y border-line">
        {receipt.filledFields.map((f) => (
          <div key={f.fieldKey} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[1fr_2fr]">
            <dt className="text-sm text-body">{f.label}</dt>
            <dd className="text-sm">{f.value}</dd>
          </div>
        ))}
      </dl>
      {receipt.confirmationText ? (
        <blockquote className="rounded-card border border-line bg-surface p-4 text-sm text-body">{receipt.confirmationText}</blockquote>
      ) : null}
    </div>
  );
}
