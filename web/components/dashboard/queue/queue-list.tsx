"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type MouseEvent } from "react";
import { ArrowUpRight, CaretRight } from "@phosphor-icons/react";
import type { SubmitChannel } from "@auto-career/shared";
import { useApplication, useApplicationActions, useApplications } from "@/hooks/use-applications";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "../../shared/button";
import { EmptyState } from "../../shared/empty-state";
import { ErrorNote } from "../../shared/error-note";
import { Panel } from "../../shared/panel";
import { Skeleton } from "../../shared/skeleton";
import { ReceiptView } from "../applications/receipt-view";
import { ApplicationEditor, EditorSkeleton } from "./application-editor";
import { TrayArt } from "./empty-art";
import { ApproveError, CHANNEL_LABEL, ChannelSelect, inlineLink, stickyAboveTabBar } from "./send-controls";

const box = "size-[18px] cursor-pointer accent-action focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink";

// Three panes from lg (shell sidebar, this list, the open draft). Below lg a row links to /applications/[id].
const WIDE = "(min-width: 1024px)";
const onWideChange = (cb: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useWide = () => useSyncExternalStore(onWideChange, () => window.matchMedia(WIDE).matches, () => false);

/** Drafts waiting for approval. Approve sends them to the extension, or to the cloud applier on Pro and Max. */
export function QueueList() {
  const { data, isLoading, error, refetch } = useApplications("draft");
  const me = useMe();
  const { approve } = useApplicationActions();
  const wide = useWide();
  const [selected, setSelected] = useState<string[]>([]);
  const [channel, setChannel] = useState<SubmitChannel>("extension");
  const [done, setDone] = useState<{ count: number; waiting: number; channel: SubmitChannel } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading) return <QueueSkeleton />;
  if (error) return <ErrorNote error={error} onRetry={() => refetch()} />;

  const drafts = data ?? [];
  const ids = drafts.map((a) => a.id);
  const sel = selected.filter((id) => ids.includes(id));
  const all = sel.length > 0 && sel.length === ids.length;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const current = openId && ids.includes(openId) ? openId : (ids[0] ?? null);

  const cloudAllowed = Boolean(me.data?.plan.cloudApplier);
  const via: SubmitChannel = cloudAllowed ? channel : "extension";
  const available = me.data?.credits.available;
  const short = available !== undefined && sel.length > available;

  const run = () =>
    approve.mutate(
      { applicationIds: sel, channel: via },
      {
        onSuccess: (r) => {
          // The server moves only drafts that are ready (lines and answers); the rest stay drafts, not failures.
          const moved = new Set(r.approved);
          const waiting = sel.filter((id) => !moved.has(id));
          setSelected(waiting);
          setDone({ count: r.approved.length, waiting: waiting.length, channel: via });
        },
      },
    );

  // On wide screens a plain click opens the draft in the right pane; new-tab clicks and phones follow the link.
  const open = (id: string) => (e: MouseEvent) => {
    if (!wide || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setOpenId(id);
  };

  const notice = done ? (
    <p role="status" className="rounded-card bg-sunk px-4 py-3 text-sm text-ink">
      {done.count === 0
        ? done.waiting
          ? `Not approved yet. ${done.waiting === 1 ? "This draft is" : "These drafts are"} still being prepared; try again in a few seconds.`
          : "Nothing was approved. The drafts may have changed; refresh the queue and try again."
        : `Approved ${done.count}. ${
            done.channel === "cloud"
              ? "The cloud applier sends them, and each receipt appears in Applications."
              : "They wait in the extension side panel until you press Send."
          }${done.waiting ? ` ${done.waiting} still being prepared ${done.waiting === 1 ? "stays" : "stay"} selected; approve again in a few seconds.` : ""}`}
    </p>
  ) : null;

  if (!drafts.length) {
    return (
      <div className="flex flex-col gap-6">
        {notice}
        <EmptyState
          icon={TrayArt}
          large
          title="Your queue is empty"
          body="Pick matches and press Prepare draft. Drafts land here for you to check and approve."
          action={
            <ButtonLink href="/matches" variant="secondary">
              See matches
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {notice}
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[23rem_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-h)+1.5rem)] lg:max-h-[calc(100dvh-var(--app-header-h)-3rem)] lg:overflow-y-auto">
          <Panel
            flush
            title="Drafts to approve"
            className="@container"
            action={<span className="text-sm text-faint tabular-nums">{drafts.length === 1 ? "1 draft" : `${drafts.length} drafts`}</span>}
          >
            <label className="flex min-h-11 cursor-pointer items-center gap-1 border-t border-line pr-6 pl-3 text-sm text-body">
              <span className="flex size-11 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  className={box}
                  checked={all}
                  ref={(el) => {
                    if (el) el.indeterminate = sel.length > 0 && !all;
                  }}
                  onChange={() => setSelected(all ? [] : ids)}
                />
              </span>
              Select all
            </label>

            <ul>
              {drafts.map((a) => {
                const isOpen = wide && a.id === current;
                return (
                  <li
                    key={a.id}
                    className={cn(
                      "relative flex items-center gap-1 border-t border-line pr-4 pl-3 transition-colors duration-300 ease-out hover:bg-sunk/40 has-[:checked]:bg-sunk/50",
                      isOpen && "bg-sunk before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-ink hover:bg-sunk has-[:checked]:bg-sunk",
                    )}
                  >
                    <label className="relative z-10 flex size-11 shrink-0 cursor-pointer items-center justify-center">
                      <input type="checkbox" className={box} aria-label={`Select ${a.job.title} at ${a.company.name}`} checked={sel.includes(a.id)} onChange={() => toggle(a.id)} />
                    </label>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-3">
                      <Link
                        href={`/applications/${a.id}`}
                        onClick={open(a.id)}
                        aria-current={isOpen ? "true" : undefined}
                        className="text-base font-medium text-ink after:absolute after:inset-0 after:rounded-none focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ink"
                      >
                        {a.job.title}
                        <span className="sr-only">, review and edit</span>
                      </Link>
                      <p className="text-sm text-faint">
                        {a.company.name} · {a.job.location ?? "Location not listed"}
                      </p>
                    </div>
                    <CaretRight aria-hidden size={16} weight="light" className={cn("shrink-0 text-icon", isOpen && "lg:text-ink")} />
                  </li>
                );
              })}
            </ul>

            <div className={cn("sticky z-10 flex flex-col gap-3 glass-panel rounded-b-card px-4 py-4 @sm:px-6", stickyAboveTabBar)}>
              <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:justify-between">
                <p className="text-sm" aria-live="polite">
                  {sel.length === 0 ? (
                    <span className="text-faint">Select drafts to approve them together.</span>
                  ) : short ? (
                    <span className="text-warn">
                      {sel.length} selected, and you have {available} {available === 1 ? "credit" : "credits"} available. Approve fewer or{" "}
                      <Link href="/billing" className={inlineLink}>
                        get more credits
                      </Link>
                      .
                    </span>
                  ) : (
                    <span className="text-body">
                      <span className="text-ink tabular-nums">{sel.length} selected.</span>{" "}
                      {available === undefined
                        ? "Each one uses a credit only when it is sent."
                        : `Uses ${sel.length} of your ${available} credits, each charged only when it is sent.`}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-3">
                  <ChannelSelect id="queue-channel" value={via} onChange={setChannel} cloudAllowed={cloudAllowed} disabled={approve.isPending} />
                  <Button className="shrink-0" disabled={!sel.length || approve.isPending} onClick={run}>
                    {approve.isPending ? (
                      "Approving…"
                    ) : (
                      <>
                        <span className="@xl:hidden">{sel.length ? `Approve ${sel.length}` : "Approve"}</span>
                        <span className="hidden @xl:inline">
                          {sel.length ? `Approve ${sel.length}` : "Approve"} for {CHANNEL_LABEL[via]}
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <ApproveError error={approve.error} />
            </div>
          </Panel>

          {me.data && !cloudAllowed ? (
            <p className="text-sm text-faint">
              The cloud applier sends approved drafts while your laptop is closed. It is on Pro and Max.{" "}
              <Link href="/billing" className={inlineLink}>
                See plans
              </Link>
            </p>
          ) : null}
        </div>

        {wide && current ? <DraftPane id={current} /> : null}
      </div>
    </div>
  );
}

/** The open draft on wide screens: the same editor (or status) the full page shows, under a compact header. */
function DraftPane({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useApplication(id);
  if (isLoading) return <EditorSkeleton />;
  if (error || !data) return <ErrorNote error={error} onRetry={() => refetch()} />;

  return (
    <section aria-labelledby="draft-pane-title" className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="draft-pane-title" className="font-display text-2xl leading-tight tracking-[-0.02em] text-ink">
            {data.job.title}
          </h2>
          <p className="text-sm text-body">
            {data.companyName} · {data.job.location ?? "Location not listed"}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <a href={data.job.applyUrl} target="_blank" rel="noreferrer" className={cn(inlineLink, "inline-flex min-h-11 items-center gap-1 text-sm")}>
            View posting
            <ArrowUpRight aria-hidden size={14} weight="light" className="text-icon" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <Link href={`/applications/${id}`} className={cn(inlineLink, "inline-flex min-h-11 items-center text-sm")}>
            Open full page
          </Link>
        </div>
      </header>
      {data.application.status === "draft" ? <ApplicationEditor key={id} detail={data} /> : <ReceiptView application={data.application} />}
    </section>
  );
}

/** Same frame as the loaded queue: the list pane (header, select-all, rows, action bar) and, from lg, the open draft. */
function QueueSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading drafts" className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[23rem_minmax(0,1fr)]">
      <section className="glass-panel rounded-card">
        <div className="px-6 pt-6 pb-4">
          <Skeleton className="h-6 w-44" />
        </div>
        <div className="flex h-11 items-center gap-4 border-t border-line px-6">
          <Skeleton className="size-[18px]" />
          <Skeleton className="h-4 w-20" />
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-line px-6 py-4">
            <Skeleton className="size-[18px]" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
        <div className="flex flex-col gap-3 border-t border-line px-6 py-4">
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-3">
            <Skeleton className="h-11 flex-1" />
            <Skeleton className="h-11 w-28 rounded-pill" />
          </div>
        </div>
      </section>
      <div className="hidden lg:block">
        <EditorSkeleton />
      </div>
    </div>
  );
}
