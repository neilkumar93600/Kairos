"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import type { DraftRequest } from "@auto-career/shared";
import { useDraftText } from "@/hooks/use-drafts";
import type { Fact } from "@/hooks/use-profile";
import { ApiError } from "@/lib/api";
import { Button } from "../../shared/button";
import { Textarea } from "../../shared/field";
import { apiMessage, inlineLink } from "./send-controls";

// True whether the value came from the profile, a saved answer or the user's own edit.
export const PROFILE_ONLY_LINE = "AI never drafts this answer";

/** Keys are snake_case, so underscores become spaces first (the hook regex wants "work authorization"). True when the question is a protected one (EEO, visa, salary...). Tests both the field key and the label. */
export { isProfileOnly } from "@/hooks/use-drafts";

/**
 * "Draft from my facts" / "Draft cover letter" for one field. The draft shows beside the current text with the facts it
 * cites; nothing changes until Accept (or Edit, then Accept). Accepting hands the text to the editor, which saves it
 * the same way as any other edit.
 */
export function DraftAssist({
  applicationId,
  request,
  current,
  label,
  profileOnly,
  facts,
  onAccept,
}: {
  applicationId: string;
  request: DraftRequest;
  current: string;
  label: string;
  profileOnly: boolean;
  facts: Map<string, Fact>;
  onAccept: (text: string) => void;
}) {
  const draft = useDraftText(applicationId);
  const [text, setText] = useState<string | null>(null); // null = no proposal open
  const [editing, setEditing] = useState(false);
  const id = useId();

  const refused = draft.error instanceof ApiError && draft.error.code === "profile_only";
  if (profileOnly || refused) return <p className="text-sm text-body">{PROFILE_ONLY_LINE}.</p>;

  const close = () => {
    setText(null);
    setEditing(false);
    draft.reset();
  };
  const ask = () =>
    draft.mutate(request, {
      onSuccess: (r) => {
        setText(r.text);
        setEditing(false);
      },
    });
  const factIds = draft.data?.factIds ?? [];

  return (
    <div className="flex flex-col gap-3">
      {text === null ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button variant="secondary" size="sm" onClick={ask} disabled={draft.isPending} className="min-h-11">
            {draft.isPending ? "Drafting…" : request.kind === "cover_letter" ? "Draft cover letter" : "Draft from my facts"}
          </Button>
          {draft.isPending ? <span className="text-sm text-faint">Writing from your confirmed facts.</span> : null}
        </div>
      ) : (
        <section aria-label={`Draft for ${label}`} className="flex flex-col gap-4 rounded-input border border-line bg-sunk/40 p-4">
          <div className="grid gap-4 @2xl:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="text-xs text-faint">Now</p>
              <p className="text-sm whitespace-pre-line text-body">{current || "Empty"}</p>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={id} className="text-xs text-faint">
                Draft
              </label>
              {editing ? (
                <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} className="min-h-32 field-sizing-content" />
              ) : (
                <p id={id} className="text-sm whitespace-pre-line text-ink">
                  {text}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            <span className="text-xs text-faint">Uses</span>
            {factIds.length === 0 ? (
              <span className="text-xs text-bad">no fact</span>
            ) : (
              factIds.map((f) => {
                const fact = facts.get(f);
                return (
                  <span key={f} className="inline-flex h-7 max-w-full items-center rounded-pill border border-line px-2.5 text-xs text-body">
                    <span className="truncate">{fact?.text ?? "Fact removed"}</span>
                  </span>
                );
              })
            )}
          </div>
          <p className="text-xs text-faint">Your text stays as it is until you accept. Check the draft against the job.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="min-h-11"
              disabled={!text.trim()}
              onClick={() => {
                onAccept(text);
                close();
              }}
            >
              {editing ? "Accept edited draft" : "Accept"}
            </Button>
            {editing ? null : (
              <Button variant="secondary" size="sm" className="min-h-11" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            <Button variant="ghost" size="sm" className="min-h-11" onClick={close}>
              Ignore
            </Button>
          </div>
        </section>
      )}
      {draft.isError && !refused ? (
        <p role="alert" className="text-sm text-bad">
          {draftError(draft.error)}
        </p>
      ) : null}
    </div>
  );
}

/** The refusals the drafts endpoint returns, said plainly with the next step. */
function draftError(error: unknown): ReactNode {
  const code = error instanceof ApiError ? error.code : null;
  if (code === "forbidden")
    return (
      <>
        Cover letter drafts come with paid plans.{" "}
        <Link href="/billing" className={inlineLink}>
          See plans
        </Link>
      </>
    );
  if (code === "truth_lock")
    return (
      <>
        Your confirmed facts do not support a draft for this question. Write it yourself, or{" "}
        <Link href="/profile" className={inlineLink}>
          add a fact
        </Link>
        .
      </>
    );
  if (code === "rate_limited") return "That was a lot of drafts in a minute. Try again shortly.";
  return apiMessage(error, "Could not write a draft. Try again.");
}
