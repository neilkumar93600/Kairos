import type { Metadata } from "next";
import { ApplicationsTable } from "@/components/dashboard/applications/applications-table";
import { PageTitle } from "@/components/shared/page-title";

export const metadata: Metadata = { title: "Applications" };

export default function ApplicationsPage() {
  return (
    <>
      <PageTitle title="Applications" body="Everything approved, sent or failed, with a receipt for each one sent." />
      <ApplicationsTable />
    </>
  );
}
