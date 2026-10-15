import type { Metadata } from "next";
import { OverviewPanel } from "@/components/dashboard/overview/overview-panel";
import { PageTitle } from "@/components/shared/page-title";

export const metadata: Metadata = { title: "Overview" };

export default function DashboardPage() {
  return (
    <>
      <PageTitle title="Overview" body="Where your search stands today." />
      <OverviewPanel />
    </>
  );
}
