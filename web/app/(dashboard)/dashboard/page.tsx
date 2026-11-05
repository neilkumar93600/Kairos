import type { Metadata } from "next";
import { GreetingHeader } from "@/components/dashboard/overview/greeting-header";
import { OverviewPanel } from "@/components/dashboard/overview/overview-panel";

export const metadata: Metadata = { title: "Overview" };

export default function DashboardPage() {
  return (
    <>
      <GreetingHeader />
      <OverviewPanel />
    </>
  );
}
