import { LandingShell } from "@/components/landing/landing-shell";

/** "/" only: wraps the landing in the .lp scope so its styles never reach other routes (ARCH 1.3). */
export default function LandingLayout({ children }: LayoutProps<"/">) {
  return <LandingShell>{children}</LandingShell>;
}
