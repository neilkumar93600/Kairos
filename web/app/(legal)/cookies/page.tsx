import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = { title: "Cookie policy" };

export default function CookiesPage() {
  return (
    <LegalDocument
      title="Cookie policy"
      updated="2026-10-13"
      intro="Kairos uses a small number of cookies."
      sections={[
        { heading: "Essential", body: ["A session cookie keeps you signed in. It is required for the dashboard and expires after 30 days of inactivity."] },
        { heading: "Analytics", body: ["If we add product analytics, we will list the cookies here and ask for consent where the law requires it."] },
      ]}
    />
  );
}
