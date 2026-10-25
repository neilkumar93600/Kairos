import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Kairos collects, why, who it is shared with, and how to export or delete it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy policy"
      updated="2026-10-13"
      intro="What we collect, why, and how to remove it. Draft for legal review (DPDP Act 2023 and GDPR) before launch."
      sections={[
        { heading: "What we collect", body: ["Account details, your resume and the facts you confirm, your search preferences, the applications you approve with their receipts, and replies you forward to us."] },
        { heading: "How we use it", body: ["Only to find matching jobs, prepare and submit applications you approve, and show you their outcomes. We do not sell your data and do not use it to train AI models."] },
        { heading: "Who processes it", body: ["Hosting (Vercel, Railway), email (Postmark), payments (Stripe) and the AI model provider we use for scoring and tailoring. Each receives only what its job needs."] },
        { heading: "Retention and deletion", body: ["Delete your account from Settings at any time. That removes your profile, applications, receipts and forwarded replies. Payment records are kept as tax law requires."] },
      ]}
    />
  );
}
