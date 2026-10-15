"use client";

import Link from "next/link";
import type { ApplicationStatus } from "@auto-career/shared";
import { useApplications } from "@/hooks/use-applications";
import { formatDate } from "@/lib/utils";
import { Badge } from "../../shared/badge";
import { EmptyState } from "../../shared/empty-state";
import { ErrorNote } from "../../shared/error-note";
import { ListSkeleton } from "../../shared/skeleton";

const TONE: Partial<Record<ApplicationStatus, "good" | "warn" | "bad" | "accent">> = {
  submitted: "good",
  approved: "accent",
  submitting: "accent",
  failed: "bad",
  withdrawn: "warn",
};

export function ApplicationsTable() {
  const { data, isLoading, error } = useApplications();
  if (isLoading) return <ListSkeleton />;
  if (error) return <ErrorNote error={error} />;
  if (!data?.length) return <EmptyState title="No applications yet" body="Approved applications and their receipts show up here." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-body">
            <th className="py-3 pr-4">Role</th>
            <th className="py-3 pr-4">Company</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Sent</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a) => (
            <tr key={a.id} className="border-b border-line">
              <td className="py-3 pr-4">
                <Link href={`/applications/${a.id}`} className=" hover:underline hover:underline-offset-4">
                  {a.job.title}
                </Link>
              </td>
              <td className="py-3 pr-4 text-body">{a.company.name}</td>
              <td className="py-3 pr-4">
                <Badge tone={TONE[a.status] ?? "neutral"}>{a.status}</Badge>
              </td>
              <td className="py-3 pr-4 tabular-nums text-body">{a.submittedAt ? formatDate(a.submittedAt) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
