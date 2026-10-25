"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import type { Fact } from "@/hooks/use-profile";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "../shared/button";
import { StatusWord } from "../shared/status";
import { useWs } from "./workspace";

/** shadcn Tabs (Base UI) themed to the Bone-track toggle: white active pill with the ring, 44px targets. */
export const tabList = "w-full rounded-pill bg-sunk p-1 group-data-horizontal/tabs:h-11";
export const tabTrigger =
  "h-full rounded-pill px-3 text-sm font-medium text-faint transition-colors duration-300 ease-out hover:text-ink data-active:bg-surface data-active:text-ink group-data-[variant=default]/tabs-list:data-active:shadow-edge focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** 36px dense pills keep a 44px hit area. */
export const HIT = "relative after:absolute after:inset-x-0 after:-inset-y-1";

export const iconButton =
  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill text-icon transition-colors duration-300 ease-out hover:bg-sunk active:bg-sunk/70 data-popup-open:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-40";

/** Icon-only quiet button: 44px, a name for screen readers and a tooltip, Bone wash on hover and press. */
export function IconButton({ label, className, children, ...props }: { label: string } & ComponentProps<"button">) {
  return (
    <button type="button" aria-label={label} title={label} className={cn(iconButton, className)} {...props}>
      {children}
    </button>
  );
}

/** A side panel folded to its 56px rail: one button per tab, with a count or score beside the icon. */
export function Rail({ label, items }: { label: string; items: { label: string; icon: ReactNode; note?: ReactNode; onClick: () => void }[] }) {
  return (
    <nav aria-label={label} className="flex h-full flex-col items-center gap-2 glass-panel rounded-card py-2">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={it.onClick}
          aria-label={it.label}
          title={it.label}
          className="flex min-h-11 w-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-input py-1.5 text-icon transition-colors duration-300 ease-out hover:bg-sunk active:bg-sunk/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span aria-hidden>{it.icon}</span>
          {it.note !== undefined ? (
            <span aria-hidden className="text-xs leading-none font-medium text-ink tabular-nums">
              {it.note}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}

export const menuItem = "min-h-11 gap-3 rounded-input px-3 text-[15px] text-ink";

/** Small section badge: AI, Empty, Hidden. */
export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ink" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-pill border px-2 text-xs whitespace-nowrap",
        tone === "ink" ? "border-ink text-ink" : tone === "warn" ? "border-warn/30 text-warn" : "border-line text-faint",
      )}
    >
      {children}
    </span>
  );
}

/** The facts a line rests on. Unconfirmed facts say so in words; a missing fact id is an error. */
export function FactChips({ ids, className }: { ids: string[]; className?: string }) {
  const { facts } = useWs();
  if (!ids.length) return <p className={cn("text-sm text-bad", className)}>Cites no fact</p>;
  return (
    <ul aria-label="Facts cited" className={cn("flex min-w-0 max-w-full flex-wrap gap-1.5", className)}>
      {ids.map((id) => {
        const f = facts?.get(id);
        return (
          <li
            key={id}
            title={f?.text}
            className={cn(
              "inline-flex h-7 max-w-full items-center gap-1.5 rounded-pill px-2.5 text-xs",
              !facts ? "bg-sunk text-faint" : !f ? "border border-bad/30 text-bad" : f.confirmed ? "bg-sunk text-ink" : "border border-dashed border-rule text-body",
            )}
          >
            {f && !f.confirmed ? (
              <>
                <span aria-hidden className="size-2 shrink-0 border border-ink" />
                <span className="shrink-0 text-faint">Unconfirmed</span>
              </>
            ) : null}
            <span className="truncate">{!facts ? "Loading fact" : (f?.text ?? "Fact not in your profile")}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Confirm buttons for facts a suggestion or requirement cites but the user has not confirmed. */
export function ConfirmFacts({ ids, label, describedBy }: { ids: string[]; label?: string; describedBy?: string }) {
  const { confirm, confirming } = useWs();
  const busy = ids.some((id) => confirming.has(id));
  return (
    <Button size="sm" variant="secondary" className={HIT} disabled={busy} aria-describedby={describedBy} onClick={() => confirm(ids)}>
      {busy ? "Confirming…" : (label ?? (ids.length > 1 ? `Confirm ${ids.length} facts` : "Confirm fact"))}
    </Button>
  );
}

/** A fact the server just made from the user's own words: unconfirmed until confirmed here, in one click. */
export function NewFactNote({ fact, className }: { fact: Fact; className?: string }) {
  const { facts } = useWs();
  const confirmed = facts?.get(fact.id)?.confirmed ?? fact.confirmed;
  const id = `newfact-${fact.id}`;
  return (
    <div className={cn("flex flex-col gap-3 rounded-input bg-sunk p-3", className)}>
      <p id={id} className="text-sm text-ink">
        Saved as a new fact: “{fact.text}”
      </p>
      {confirmed ? (
        <StatusWord tone="positive">Confirmed, lines can cite it</StatusWord>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <StatusWord tone="open">Unconfirmed</StatusWord>
          <ConfirmFacts ids={[fact.id]} label="Confirm" describedBy={id} />
        </div>
      )}
    </div>
  );
}

const isRateLimit = (error: unknown) => error instanceof ApiError && error.status === 429;

/** Errors from the Resume Writer in words: 429 says when to retry, invalid_scope offers a plain retry. */
export function askErrorText(error: unknown) {
  if (isRateLimit(error)) return "Too many requests in the last minute. Try again in a minute; nothing here is lost.";
  if (error instanceof ApiError && error.code === "invalid_scope") return "Kairos could not work on that part of the resume. Try again.";
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Could not reach Kairos. Check your connection and try again.";
}

/** Inline error with a retry. A rate limit is a pause, not a failure, so it reads calm. */
export function InlineError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const calm = isRateLimit(error);
  return (
    <div role={calm ? "status" : "alert"} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className={cn("text-sm", calm ? "text-body" : "text-bad")}>{askErrorText(error)}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="min-h-11 cursor-pointer text-sm font-medium text-ink underline underline-offset-3 hover:no-underline">
          Try again
        </button>
      ) : null}
    </div>
  );
}

/** Text input that commits on blur or Enter, so one edit is one undo step. Follows the document when it changes. */
export function CommitInput({ value, onCommit, multiline, ...props }: { value: string; onCommit: (v: string) => void; multiline?: boolean } & Omit<ComponentProps<"input">, "value" | "onChange">) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setDraft(value);
  }
  const commit = () => (draft !== value ? onCommit(draft) : undefined);
  const control =
    "w-full rounded-input border border-body bg-field px-3 text-base text-ink transition-colors duration-300 ease-out placeholder:text-faint focus:border-action focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink";
  if (multiline)
    return (
      <textarea
        {...(props as ComponentProps<"textarea">)}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        className={cn(control, "min-h-24 py-2.5 leading-normal", props.className)}
      />
    );
  return (
    <input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        commit();
        props.onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(value);
      }}
      className={cn(control, "h-11", props.className)}
    />
  );
}

/** Loading shape for suggestion lists: cards, not a spinner. */
export function SuggestionSkeletons({ n = 3 }: { n?: number }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Writing suggestions from your facts</span>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} aria-hidden className="flex flex-col gap-2.5 glass-panel rounded-card p-4">
          <div className="h-3 w-24 animate-pulse rounded-input bg-sunk motion-reduce:animate-none" />
          <div className="h-4 w-full animate-pulse rounded-input bg-sunk motion-reduce:animate-none" />
          <div className="h-4 w-4/5 animate-pulse rounded-input bg-sunk motion-reduce:animate-none" />
          <div className="mt-1 flex gap-2">
            <div className="h-7 w-28 animate-pulse rounded-pill bg-sunk motion-reduce:animate-none" />
            <div className="h-7 w-20 animate-pulse rounded-pill bg-sunk motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}
