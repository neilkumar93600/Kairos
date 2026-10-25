import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms for using Kairos, operated by Gray Matter Labs.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of service"
      updated="2026-10-13"
      intro="These terms cover your use of Kairos, operated by Gray Matter Labs. Draft for legal review before launch."
      sections={[
        { heading: "What we do", body: ["Kairos finds job postings, prepares applications from information you provide and confirm, and submits only the applications you approve."] },
        { heading: "Your responsibilities", body: ["You confirm that the facts in your profile are true and that you are entitled to apply for the roles you approve. You are responsible for every application you approve."] },
        { heading: "Acceptable use", body: ["You may not use Kairos to apply on behalf of someone else, to submit false information, or to send applications to employers who ask not to receive automated submissions."] },
        { heading: "Billing", body: ["Paid plans renew each week, month or quarter until cancelled. A credit is used only when an application is submitted successfully. See the refund policy for charges."] },
        { heading: "Liability", body: ["We do not guarantee interviews or offers. Employers decide how they review applications."] },
      ]}
    />
  );
}
