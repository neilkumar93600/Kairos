"use client";

import { useState } from "react";
import { useMe } from "@/hooks/use-me";
import { Button } from "../../shared/button";
import { Skeleton } from "../../shared/skeleton";

/** The private address replies are forwarded to, plus the Gmail filter that does it. */
export function ForwardingAddress() {
  const { data } = useMe();
  const [copied, setCopied] = useState(false);
  if (!data) return <Skeleton className="h-24 w-full" />;
  const address = data.forwardingAddress ?? "";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded-[6px] border border-line bg-surface px-3 py-2 tabular-nums text-sm">{address}</code>
        <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(address).then(() => setCopied(true))}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-body">
        <li>In Gmail, open Settings, then Forwarding and POP/IMAP, and add this address. Confirm it with the code Gmail sends.</li>
        <li>Create a filter for emails with words like &quot;application&quot;, &quot;interview&quot; or &quot;candidate&quot;.</li>
        <li>Choose &quot;Forward it to&quot; this address. Your inbox stays yours; we only see what the filter sends.</li>
      </ol>
    </div>
  );
}
