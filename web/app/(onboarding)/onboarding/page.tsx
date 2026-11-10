import type { Metadata } from "next";
import { Wizard } from "@/components/onboarding/wizard";

export const metadata: Metadata = { title: "Set up" };

export default function OnboardingPage() {
  return <Wizard />;
}
