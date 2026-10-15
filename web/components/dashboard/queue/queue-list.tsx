"use client";

import Link from "next/link";
import { useState } from "react";
import { useApplicationActions, useApplications } from "@/hooks/use-applications";
import { useMe } from "@/hooks/use-me";
import { ApiError } from "@/lib/api";
import { Button } from "../../shared/button";
import { EmptyState } from "../../shared/empty-state";
import { ErrorNote } from "../../shared/error-note";
import { ListSkeleton } from "../../shared/skeleton";

/** Drafts waiting for approval. Approve sends them to the extension, or to the cloud applier on Pro and Max. */
export function QueueList() {
  const { data, isLoading, error } = useApplications("draft");
  const me = useMe();
  const { approve } = useApplicationActions();
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  if (isLoading) return <ListSkeleton />;
  if (error) return <ErrorNote error={error} />;
  if (!data?.length) return <EmptyState title="Your queue is empty" body="Pick matches and press Prepare draft. Drafts land here for you to check and approve." />;

  const cloud = Boolean(me.data?.plan.cloudApplier);
  const approveError = approve.error instanceof ApiError ? approve.error.message : approve.error ? "Could not approve." : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-body">{selected.length} selected</span>
        <Button size="sm" disabled={!selected.length || approve.isPending} onClick={() => approve.mutate({ applicationIds: selected, channel: "extension" }, { onSuccess: () => setSelected([]) })}>
          Approve for the extension
        </Button>
        {cloud ? (
          <Button size="sm" variant="secondary" disabled={!selected.length || approve.isPending} onClick={() => approve.mutate({ applicationIds: selected, channel: "cloud" }, { onSuccess: () => setSelected([]) })}>
            Approve for the cloud applier
          </Button>
        ) : null}
      </div>
      {approveError ? <p role="alert" className="text-sm text-bad">{approveError}</p> : null}
      <ul className="divide-y divide-line border-y border-line">
        {data.map((a) => (
          <li key={a.id} className="flex items-center gap-4 py-4">
            <input type="checkbox" aria-label={`Select ${a.job.title}`} checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="size-4 accent-action" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{a.job.title}</span>
              <span className="text-sm text-body">{a.company.name}</span>
            </div>
            <Link href={`/applications/${a.id}`} className="text-sm text-foreground underline underline-offset-4">
              Review and edit
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
