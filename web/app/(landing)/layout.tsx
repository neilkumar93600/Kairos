import { LandingShell } from "@/components/landing/landing-shell";

/** "/" only: the landing is the one page with a #pricing skip target. */
export default function LandingLayout({ children }: LayoutProps<"/">) {
  return <LandingShell skipPricing>{children}</LandingShell>;
}
