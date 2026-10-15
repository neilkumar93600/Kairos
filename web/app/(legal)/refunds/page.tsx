import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = { title: "Refund policy" };

export default function RefundsPage() {
  return (
    <LegalDocument
      title="Refund policy"
      updated="2026-10-13"
      intro="We would rather refund you than argue about it. Draft for legal review before launch."
      sections={[
        { heading: "Failed submissions", body: ["A credit is used only when the employer's form confirms the submission. Failed or unconfirmed submissions never use a credit."] },
        { heading: "Charges", body: ["If you are charged for a period you did not use, write to us within 14 days and we refund it. Cancelling stops all future charges immediately."] },
        { heading: "Got the job?", body: ["When an offer email reaches your forwarding address, we pause your plan automatically so you are not charged again."] },
      ]}
    />
  );
}
