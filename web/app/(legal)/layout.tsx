import { LandingShell } from "@/components/landing/landing-shell";

/** Terms, privacy, cookies and refunds: the marketing shell around a quiet reading layout (no art). */
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return <LandingShell>{children}</LandingShell>;
}
