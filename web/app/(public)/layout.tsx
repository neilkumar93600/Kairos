import { LandingShell } from "@/components/landing/landing-shell";

/** Pages anyone can visit, signed in or not. Same nav, footer and .lp system as the landing. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <LandingShell>{children}</LandingShell>;
}
