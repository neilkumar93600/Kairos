import type { Metadata } from "next";
import { Suspense } from "react";
import { ApplicationDetailSkeleton, ApplicationDetailView } from "@/components/dashboard/applications/application-detail";

export const metadata: Metadata = { title: "Application" };

export default function ApplicationPage() {
  return (
    <Suspense fallback={<ApplicationDetailSkeleton />}>
      <ApplicationDetailView />
    </Suspense>
  );
}
