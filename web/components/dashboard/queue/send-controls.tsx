"use client";

import Link from "next/link";
import { useState } from "react";
import type { SubmitChannel } from "@auto-career/shared";
import { useApplicationActions } from "@/hooks/use-applications";
import { ApiError } from "@/lib/api";
import { Button } from "../../shared/button";
import { Select } from "../../shared/field";

/** Inline text link (DESIGN.md: ink, 1px underline at 3px offset, never coloured). */
export const inlineLink =
  "text-ink underline decoration-1 underline-offset-[3px] hover:decoration-2 active:text-body focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink";

/** Sticky action bars sit above the phone tab bar; the dashboard layout sets --app-tabbar-h (0 from lg). */
export const stickyAboveTabBar = "bottom-[var(--app-tabbar-h,0px)]";

export const CHANNEL_LABEL: Record<SubmitChannel, string> = { extension: "the extension", cloud: "the cloud" };

export function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/** Who sends approved drafts. The cloud applier is Pro and Max only; the API enforces it as well (403). */
export function ChannelSelect({
  id,
  value,
  onChange,
  cloudAllowed,
  disabled,
}: {
  id: string;
  value: SubmitChannel;
  onChange: (c: SubmitChannel) => void;
  cloudAllowed: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <label htmlFor={id} className="shrink-0 text-sm text-body">
        Send with
      </label>
      <Select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as SubmitChannel)} className="h-11 w-auto min-w-0 flex-1">
        <option value="extension">Extension</option>
        <option value="cloud" disabled={!cloudAllowed}>
          {cloudAllowed ? "Cloud" : "Cloud (Pro and Max)"}
        </option>
      </Select>
    </div>
  );
}

/** Approve failures said plainly, with the way out: 402 not enough credits, 403 cloud plan. */
export function ApproveError({ error }: { error: unknown }) {
  if (!error) return null;
  const e = error instanceof ApiError ? error : null;
  if (e?.status === 402) {
    return (
      <p role="alert" className="text-sm text-bad">
        Not approved. {e.message}.{" "}
        <Link href="/billing" className={inlineLink}>
          Get more credits
        </Link>
      </p>
    );
  }
  if (e?.status === 403 && e.code === "forbidden") {
    return (
      <p role="alert" className="text-sm text-bad">
        Not approved. {e.message}.{" "}
        <Link href="/billing" className={inlineLink}>
          Upgrade your plan
        </Link>
      </p>
    );
  }
  return (
    <p role="alert" className="text-sm text-bad">
      {apiMessage(error, "Could not approve. Try again.")}
    </p>
  );
}

/** Withdraw with a second press to confirm. Drafts and approved applications can be withdrawn until they are sent. */
export function WithdrawButton({ id, noun }: { id: string; noun: string }) {
  const { withdraw } = useApplicationActions();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button variant="ghost" className="-ml-5 text-bad" onClick={() => setAsking(true)}>
        Withdraw this {noun}
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-ink">Withdraw this {noun}? It will not be sent, and no credit is used.</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" className="text-bad" disabled={withdraw.isPending} onClick={() => withdraw.mutate(id)}>
          {withdraw.isPending ? "Withdrawing…" : "Yes, withdraw"}
        </Button>
        <Button variant="ghost" disabled={withdraw.isPending} onClick={() => setAsking(false)}>
          Keep it
        </Button>
      </div>
      {withdraw.error ? (
        <p role="alert" className="text-sm text-bad">
          {apiMessage(withdraw.error, "Could not withdraw. Try again.")}
        </p>
      ) : null}
    </div>
  );
}
