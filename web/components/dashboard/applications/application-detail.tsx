"use client";

import { useParams } from "next/navigation";
import { useApplication } from "@/hooks/use-applications";
import { Badge } from "../../shared/badge";
import { ErrorNote } from "../../shared/error-note";
import { PageTitle } from "../../shared/page-title";
import { ListSkeleton } from "../../shared/skeleton";
import { ApplicationEditor } from "../queue/application-editor";
import { ReceiptView } from "./receipt-view";

export function ApplicationDetailView() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useApplication(id);
  if (isLoading) return <ListSkeleton rows={6} />;
  if (error || !data) return <ErrorNote error={error} />;

  return (
    <>
      <PageTitle
        title={data.job.title}
        body={`${data.companyName} · ${data.job.location ?? "Location not listed"}`}
        action={<Badge tone={data.application.status === "submitted" ? "good" : "neutral"}>{data.application.status}</Badge>}
      />
      {data.application.status === "draft" ? <ApplicationEditor detail={data} /> : <ReceiptView application={data.application} />}
    </>
  );
}
