"use client";

import Link from "next/link";
import type { EmailKind } from "@auto-career/shared";
import { useInbox } from "@/hooks/use-inbox";
import { formatRelative } from "@/lib/utils";
import { Badge } from "../../shared/badge";
import { EmptyState } from "../../shared/empty-state";
import { ErrorNote } from "../../shared/error-note";
import { ListSkeleton } from "../../shared/skeleton";

const TONE: Record<EmailKind, "good" | "warn" | "bad" | "accent" | "neutral"> = {
  offer: "good",
  interview: "accent",
  assessment: "accent",
  rejection: "bad",
  confirmation: "neutral",
  other: "neutral",
};

export function ReplyList() {
  const { data, isLoading, error } = useInbox();
  if (isLoading) return <ListSkeleton />;
  if (error) return <ErrorNote error={error} />;
  if (!data?.length) {
    return (
      <EmptyState
        title="No replies yet"
        body="Set up the forwarding filter in Settings. Confirmations, interview invites and rejections then land here, tagged to the right application."
      />
    );
  }
  return (
    <ul className="divide-y divide-line border-y border-line">
      {data.map((e) => (
        <li key={e.id} className="flex flex-col gap-1 py-4">
          <div className="flex items-center justify-between gap-4">
            <span className="truncate">{e.subject || "(no subject)"}</span>
            <span className="shrink-0 tabular-nums text-xs text-body">{formatRelative(e.receivedAt)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-body">
            <Badge tone={TONE[e.kind ?? "other"]}>{e.kind ?? "unread"}</Badge>
            <span className="truncate">{e.sender}</span>
            {e.applicationId ? (
              <Link href={`/applications/${e.applicationId}`} className="text-foreground underline underline-offset-4">
                View application
              </Link>
            ) : null}
          </div>
          <p className="line-clamp-2 text-sm text-body">{e.preview}</p>
        </li>
      ))}
    </ul>
  );
}
