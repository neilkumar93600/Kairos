"use client";

import { useFacts, useProfileActions } from "@/hooks/use-profile";
import { Badge } from "../../shared/badge";
import { Button } from "../../shared/button";
import { EmptyState } from "../../shared/empty-state";
import { ErrorNote } from "../../shared/error-note";
import { ListSkeleton } from "../../shared/skeleton";

/** Facts parsed from the resume. Only confirmed facts can be cited by tailored lines. */
export function FactList() {
  const { data, isLoading, error } = useFacts();
  const { updateFact, deleteFact } = useProfileActions();
  if (isLoading) return <ListSkeleton />;
  if (error) return <ErrorNote error={error} />;
  if (!data?.length) return <EmptyState title="No facts yet" body="Add your resume first. Reading it takes about a minute." />;

  const unconfirmed = data.filter((f) => !f.confirmed);
  return (
    <div className="flex flex-col gap-4">
      {unconfirmed.length ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-body">{unconfirmed.length} waiting for your check</span>
          <Button size="sm" variant="secondary" onClick={() => unconfirmed.forEach((f) => updateFact.mutate({ id: f.id, confirmed: true }))}>
            Confirm all
          </Button>
        </div>
      ) : null}
      <ul className="divide-y divide-line border-y border-line">
        {data.map((f) => (
          <li key={f.id} className="flex items-start gap-4 py-4">
            <Badge tone={f.confirmed ? "good" : "warn"}>{f.kind}</Badge>
            <p className="flex-1 text-sm">{f.text}</p>
            {f.confirmed ? null : (
              <Button size="sm" variant="secondary" onClick={() => updateFact.mutate({ id: f.id, confirmed: true })}>
                Confirm
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => deleteFact.mutate(f.id)} aria-label="Remove fact">
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
