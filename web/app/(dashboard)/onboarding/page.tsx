import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/dashboard/onboarding/onboarding-flow";
import { PageTitle } from "@/components/shared/page-title";

export const metadata: Metadata = { title: "Set up" };

export default function OnboardingPage() {
  return (
    <>
      <PageTitle title="Set up Kairos" body="Three steps, about five minutes. Nothing is sent to an employer until you approve it." />
      <OnboardingFlow />
    </>
  );
}
