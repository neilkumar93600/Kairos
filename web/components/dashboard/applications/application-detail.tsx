"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "@phosphor-icons/react";
import { useApplication } from "@/hooks/use-applications";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ButtonLink } from "../../shared/button";
import { EmptyState } from "../../shared/empty-state";
import { ErrorNote } from "../../shared/error-note";
import { PageTitle } from "../../shared/page-title";
import { Skeleton } from "../../shared/skeleton";
import { APPLICATION_STATUS, StatusWord } from "../../shared/status";
import { ApplicationEditor, EditorSkeleton } from "../queue/application-editor";
import { inlineLink } from "../queue/send-controls";
import { ReceiptView } from "./receipt-view";

const back = "-ml-1 mb-2 inline-flex min-h-11 items-center gap-2 px-1 text-sm text-body transition-colors duration-300 ease-out hover:text-ink active:text-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink";

export function ApplicationDetailView() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useApplication(id);

  if (isLoading) return <ApplicationDetailSkeleton />;
  if (error instanceof ApiError && error.status === 404) {
    return (
      <>
        <PageTitle title="Application not found" />
        <EmptyState
          title="Nothing at this link"
        body="It may have been withdrawn and removed, or the link is wrong."
        action={
          <ButtonLink href="/applications" variant="secondary">
              Back to applications
            </ButtonLink>
          }
        />
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageTitle title="Application" />
        <ErrorNote error={error} onRetry={() => refetch()} />
      </>
    );
  }

  const draft = data.application.status === "draft";
  const word = APPLICATION_STATUS[data.application.status];

  return (
    <>
      <Link href={draft ? "/queue" : "/applications"} className={back}>
        <ArrowLeft aria-hidden size={16} weight="light" className="text-icon" />
        {draft ? "Review queue" : "Applications"}
      </Link>
      <PageTitle
        title={data.job.title}
        body={`${data.companyName} · ${data.job.location ?? "Location not listed"}`}
        action={
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <StatusWord tone={word.tone}>{word.label}</StatusWord>
            <a href={data.job.applyUrl} target="_blank" rel="noreferrer" className={cn(inlineLink, "inline-flex min-h-11 items-center gap-1 text-sm")}>
              View posting
              <ArrowUpRight aria-hidden size={14} weight="light" className="text-icon" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        }
      />
      {draft ? <ApplicationEditor key={data.application.id} detail={data} /> : <ReceiptView application={data.application} />}
    </>
  );
}

/** Shaped like the editor: back link, title, the lines pane and the facts pane. */
export function ApplicationDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading application" className="flex flex-col">
      <Skeleton className="mb-4 h-5 w-28" />
      <div className="mb-8 flex flex-col gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
      <EditorSkeleton />
    </div>
  );
}
