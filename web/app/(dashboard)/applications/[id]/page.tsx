import type { Metadata } from "next";
import { Suspense } from "react";
import { ApplicationDetailView } from "@/components/dashboard/applications/application-detail";
import { ListSkeleton } from "@/components/shared/skeleton";

export const metadata: Metadata = { title: "Application" };

export default function ApplicationPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <ApplicationDetailView />
    </Suspense>
  );
}
