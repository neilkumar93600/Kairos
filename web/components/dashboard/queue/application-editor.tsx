"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import type { ApplicationAnswer, ResumeLine, SubmitChannel } from "@auto-career/shared";
import { useApplicationActions, type ApplicationDetail } from "@/hooks/use-applications";
import { useMe } from "@/hooks/use-me";
import { useFacts, type Fact } from "@/hooks/use-profile";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "../../shared/button";
import { ErrorNote } from "../../shared/error-note";
import { Field, Input, Textarea } from "../../shared/field";
import { Panel } from "../../shared/panel";
import { Skeleton } from "../../shared/skeleton";
import { StatusWord } from "../../shared/status";
import { DraftAssist, isProfileOnly } from "./draft-assist";
import { ApproveError, CHANNEL_LABEL, ChannelSelect, WithdrawButton, apiMessage, inlineLink } from "./send-controls";

const KIND: Record<string, string> = {
  role: "Role",
  project: "Project",
  skill: "Skill",
  metric: "Metric",
  education: "Education",
  certification: "Certification",
};

const SOURCE: Record<ApplicationAnswer["source"], string> = {
  profile: "From your profile.",
  saved_answer: "From an answer you saved.",
  generated: "Drafted for this job. Check it.",
  user_edit: "Edited by you.",
};

// Lines and facts side by side once the editor itself is wide enough (the full page, not the queue's right pane).
const editorGrid = "grid gap-6 @4xl:grid-cols-[minmax(0,1fr)_22rem] @4xl:items-start @6xl:grid-cols-[minmax(0,1fr)_24rem]";

// Floats 8px above the phone tab bar (--app-tabbar-h, set by the dashboard layout), 16px above the viewport from lg.
const floatAboveTabBar = "bottom-[calc(var(--app-tabbar-h,0px)_+_0.5rem)] lg:bottom-4";

/** Lines a 422 from PATCH /applications/:id names: truth_lock details ({ line, reason }) or zod issues on resumeLines. */
function lineProblems(error: unknown, lines: ResumeLine[]) {
  const out = new Map<string, string>();
  if (!(error instanceof ApiError) || error.status !== 422 || !Array.isArray(error.details)) return out;
  for (const d of error.details as { line?: { id?: string }; path?: unknown[]; message?: string }[]) {
    if (error.code === "truth_lock" && d?.line?.id) {
      out.set(d.line.id, "This line cites a fact that is not in your profile.");
    } else if (d?.path?.[0] === "resumeLines" && typeof d.path[1] === "number" && lines[d.path[1]]) {
      out.set(lines[d.path[1]].id, d.path[2] === "text" ? "A line needs between 1 and 400 characters." : (d.message ?? "This line is not valid."));
    }
  }
  return out;
}

// Centre the line so the sticky action bar never covers it.
function focusLine(id: string) {
  const el = document.getElementById(`line-${id}`);
  el?.focus({ preventScroll: true });
  el?.scrollIntoView({ block: "center" });
}

/** Edits a draft. Resume lines show the facts they cite; the API rejects lines that cite unknown facts (the truth lock). */
export function ApplicationEditor({ detail }: { detail: ApplicationDetail }) {
  const app = detail.application;
  const { update, approve } = useApplicationActions();
  const facts = useFacts();
  const me = useMe();
  // null until the user edits an answer: until then the server's answers show, including ones that arrive after the
  // draft was created (the server fills profile answers seconds later; useApplication polls for them).
  const [answerEdits, setAnswerEdits] = useState<ApplicationAnswer[] | null>(null);
  const answers = answerEdits ?? app.answers;
  // Approve moves only drafts that have resume lines and answers; until then the button waits (server rule).
  const ready = app.resumeLines.length > 0 && answers.length > 0;
  const [notReady, setNotReady] = useState(false);
  const [lines, setLines] = useState<ResumeLine[]>(app.resumeLines);
  const [coverLetter, setCoverLetter] = useState(app.coverLetter ?? "");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [channel, setChannel] = useState<SubmitChannel>("extension");
  const [activeLine, setActiveLine] = useState<string | null>(null);
  const rev = useRef(0); // edits made while a save is in flight keep the draft marked unsaved

  const edited = () => {
    rev.current += 1;
    setDirty(true);
    setSaved(false);
  };

  const save = () => {
    const at = rev.current;
    update.mutate(
      { id: app.id, input: { answers, resumeLines: lines, coverLetter: coverLetter || null } },
      {
        onSuccess: () => {
          if (rev.current !== at) return;
          setDirty(false);
          setSaved(true);
        },
        onError: (err) => {
          const first = lineProblems(err, lines).keys().next().value;
          if (first) focusLine(first);
        },
      },
    );
  };

  const cloudAllowed = Boolean(me.data?.plan.cloudApplier);
  const via: SubmitChannel = cloudAllowed ? channel : "extension";
  const problems = lineProblems(update.error, lines);

  const factById = new Map<string, Fact>((facts.data ?? []).map((f) => [f.id, f]));
  const cited = new Map<string, { n: number; lineId: string }[]>();
  lines.forEach((l, i) => l.factIds.forEach((id) => cited.set(id, [...(cited.get(id) ?? []), { n: i + 1, lineId: l.id }])));

  const groups: { section: string; items: { line: ResumeLine; n: number; i: number }[] }[] = [];
  lines.forEach((line, i) => {
    const last = groups.at(-1);
    if (last && last.section === line.section) last.items.push({ line, n: i + 1, i });
    else groups.push({ section: line.section, items: [{ line, n: i + 1, i }] });
  });

  return (
    <div className="@container flex flex-col gap-6">
      <div className={editorGrid}>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Tailored resume" description="Change the wording freely. Each line keeps the facts it cites, and the truth lock checks them again when you save.">
            {lines.length === 0 ? (
              <p className="text-sm text-body">Tailoring is still running. Refresh in a minute.</p>
            ) : (
              <div className="flex flex-col gap-6">
                {groups.map((g, gi) => (
                  <section key={`${g.section}-${gi}`} aria-label={g.section} className="flex flex-col gap-5 border-t border-line pt-5 first:border-t-0 first:pt-0">
                    <h3 className="text-sm font-medium text-ink">{g.section}</h3>
                    {g.items.map(({ line, n, i }) => {
                      const problem = problems.get(line.id);
                      return (
                        <div key={line.id} className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-3">
                            <span aria-hidden className="hidden w-5 shrink-0 pt-2.5 text-right text-xs text-faint tabular-nums sm:block">
                              {n}
                            </span>
                            <label htmlFor={`line-${line.id}`} className="text-xs text-faint sm:sr-only">
                              <span className="sr-only">{line.section}, </span>Line {n}
                            </label>
                            <Textarea
                              id={`line-${line.id}`}
                              rows={2}
                              value={line.text}
                              aria-invalid={problem ? true : undefined}
                              aria-describedby={problem ? `cites-${line.id} problem-${line.id}` : `cites-${line.id}`}
                              className={cn(
                                "min-h-16 scroll-mb-40 leading-relaxed field-sizing-content",
                                activeLine === line.id && "border-ink",
                              )}
                              onFocus={() => setActiveLine(line.id)}
                              onBlur={() => setActiveLine((cur) => (cur === line.id ? null : cur))}
                              onChange={(e) => {
                                edited();
                                setLines((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)));
                              }}
                            />
                          </div>
                          <div id={`cites-${line.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-4 sm:pl-8">
                            <span className="text-xs text-faint">Cites</span>
                            {line.factIds.length === 0 ? (
                              <span className="text-xs text-bad">no fact</span>
                            ) : (
                              line.factIds.map((id) => <FactChip key={id} id={id} fact={factById.get(id)} loading={facts.isLoading} unavailable={facts.isError} />)
                            )}
                          </div>
                          {problem ? (
                            <p id={`problem-${line.id}`} className="text-sm text-bad sm:pl-8">
                              {problem}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </section>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Answers" description="What the form receives, field by field.">
            <div className="flex flex-col gap-6">
              {answers.map((a, i) => {
                const id = `answer-${a.fieldKey}`;
                const long = a.source === "generated" || (app.answers[i]?.value.length ?? 0) > 60;
                const change = (value: string) => {
                  edited();
                  setAnswerEdits((prev) => (prev ?? app.answers).map((x, j) => (j === i ? { ...x, value } : x)));
                };
                return (
                  <div key={a.fieldKey} className="flex flex-col gap-3">
                    <Field label={a.label} htmlFor={id} hint={SOURCE[a.source]}>
                      {long ? (
                        <Textarea id={id} value={a.value} onChange={(e) => change(e.target.value)} className="min-h-24 scroll-mb-40 field-sizing-content" />
                      ) : (
                        <Input id={id} value={a.value} onChange={(e) => change(e.target.value)} className="scroll-mb-40" />
                      )}
                    </Field>
                    <DraftAssist
                      applicationId={app.id}
                      request={{ kind: "answer", fieldKey: a.fieldKey }}
                      current={a.value}
                      label={a.label}
                      profileOnly={isProfileOnly(a.fieldKey, a.label)}
                      facts={factById}
                      onAccept={change}
                    />
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Cover letter" description="Optional. Leave it empty if the form does not ask for one.">
            <label htmlFor="cover-letter" className="sr-only">
              Cover letter
            </label>
            <Textarea
              id="cover-letter"
              value={coverLetter}
              onChange={(e) => (edited(), setCoverLetter(e.target.value))}
              className="min-h-64 scroll-mb-40 leading-relaxed"
            />
            <div className="mt-4">
              <DraftAssist
                applicationId={app.id}
                request={{ kind: "cover_letter" }}
                current={coverLetter}
                label="cover letter"
                profileOnly={false}
                facts={factById}
                onAccept={(t) => (edited(), setCoverLetter(t))}
              />
            </div>
          </Panel>
        </div>

        <aside aria-label="Evidence and sending" className="flex min-w-0 flex-col gap-6">
          <Panel flush title="Facts these lines cite" description="From your profile. Select a line to highlight the facts it uses.">
            {facts.isLoading ? (
              <div aria-busy="true" aria-label="Loading facts" className="flex flex-col gap-3 border-t border-line px-6 py-4">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : facts.isError ? (
              <div className="border-t border-line px-6 py-4">
                <ErrorNote error={facts.error} onRetry={() => facts.refetch()} />
              </div>
            ) : cited.size === 0 ? (
              <p className="border-t border-line px-6 py-4 text-sm text-body">No lines yet, so nothing is cited.</p>
            ) : (
              <ul>
                {[...cited].map(([id, by]) => {
                  const fact = factById.get(id);
                  const lit = activeLine !== null && by.some((b) => b.lineId === activeLine);
                  return (
                    <li
                      key={id}
                      id={`fact-${id}`}
                      className={cn(
                        "flex scroll-mt-24 flex-col gap-1.5 border-t border-line px-6 py-4 transition-colors duration-300 ease-out target:bg-sunk",
                        lit && "bg-sunk",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-faint">{fact ? KIND[fact.kind] ?? fact.kind : "Unknown"}</span>
                        {!fact ? (
                          <StatusWord tone="bad">Not in your profile</StatusWord>
                        ) : fact.confirmed ? (
                          <StatusWord tone="positive">Confirmed</StatusWord>
                        ) : (
                          <StatusWord tone="warn">Not confirmed</StatusWord>
                        )}
                      </div>
                      <p className="text-sm text-ink">{fact?.text ?? "This fact was removed from your profile."}</p>
                      <p className="text-xs text-faint tabular-nums">
                        {by.length === 1 ? "Line" : "Lines"}{" "}
                        {by.map((b, k) => (
                          <span key={b.lineId}>
                            {k ? ", " : ""}
                            <button
                              type="button"
                              onClick={() => focusLine(b.lineId)}
                              className="relative underline decoration-1 underline-offset-[3px] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink after:absolute after:-inset-x-1.5 after:-inset-y-3"
                            >
                              {b.n}
                            </button>
                          </span>
                        ))}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="border-t border-line px-6 py-2">
              <Link href="/profile" className={cn(inlineLink, "inline-flex min-h-11 items-center text-sm")}>
                Confirm or edit facts on Profile
              </Link>
            </div>
          </Panel>

          <Panel title="Sending">
            <div className="flex flex-col gap-4">
              <ChannelSelect id="draft-channel" value={via} onChange={setChannel} cloudAllowed={cloudAllowed} disabled={approve.isPending} />
              <p className="text-sm text-body">
                {via === "cloud"
                  ? "The cloud applier fills in and submits the form on its own. You get the receipt here."
                  : "The extension fills in the form in your browser when you press Send in its side panel."}{" "}
                {me.data && !cloudAllowed ? (
                  <>
                    The cloud applier is on Pro and Max.{" "}
                    <Link href="/billing" className={inlineLink}>
                      See plans
                    </Link>
                  </>
                ) : null}
              </p>
              <div className="border-t border-line pt-3">
                <WithdrawButton id={app.id} noun="draft" />
              </div>
            </div>
          </Panel>

          <details className="group glass-panel rounded-card">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-card px-6 text-base font-medium text-ink transition-colors duration-300 ease-out hover:bg-sunk/50 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink [&::-webkit-details-marker]:hidden">
              Job description
              <CaretDown aria-hidden size={16} weight="light" className="text-icon transition-transform duration-300 ease-out group-open:rotate-180" />
            </summary>
            <p className="px-6 pb-6 text-sm leading-relaxed whitespace-pre-line text-body">{detail.job.descriptionText}</p>
          </details>
        </aside>
      </div>

      <div className={cn("sticky z-20 flex flex-col gap-3 glass-panel rounded-card px-4 py-3 sm:px-5", floatAboveTabBar)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p id="draft-status" aria-live="polite" className={cn("text-sm", !dirty && ready && !notReady && "max-sm:sr-only")}>
            {dirty ? (
              <span className="text-warn">Unsaved changes. Save them before you approve.</span>
            ) : notReady ? (
              <span className="text-warn">Not approved yet: this draft is still being prepared. Try again in a few seconds.</span>
            ) : !ready ? (
              <span className="text-faint">Preparing your answers from your profile. Approve unlocks when they are ready.</span>
            ) : (
              <span className="text-faint">Approving uses 1 credit, charged only when it is sent.</span>
            )}
          </p>
          <div className="flex gap-3 *:flex-1 sm:*:flex-none">
            <Button variant="secondary" onClick={save} disabled={update.isPending}>
              {update.isPending ? "Saving…" : saved && !dirty ? "Saved" : "Save changes"}
            </Button>
            <Button
              aria-describedby="draft-status"
              disabled={dirty || !ready || update.isPending || approve.isPending}
              // An id missing from `approved` means not ready yet, not a failure (the server leaves it a draft).
              onClick={() => approve.mutate({ applicationIds: [app.id], channel: via }, { onSuccess: (r) => setNotReady(!r.approved.includes(app.id)) })}
            >
              {approve.isPending ? (
                "Approving…"
              ) : (
                <>
                  <span className="sm:hidden">Approve</span>
                  <span className="hidden sm:inline">Approve for {CHANNEL_LABEL[via]}</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {problems.size ? (
          <div role="alert" className="flex flex-col gap-1 text-sm text-bad">
            <p>
              Not saved.{" "}
              {update.error instanceof ApiError && update.error.code === "truth_lock"
                ? problems.size === 1
                  ? "This line cites facts that are not in your profile:"
                  : `These ${problems.size} lines cite facts that are not in your profile:`
                : "Fix the marked lines:"}
            </p>
            <ul className="flex flex-col">
              {lines.map((l, i) =>
                problems.has(l.id) ? (
                  <li key={l.id} className="min-w-0">
                    <a
                      href={`#line-${l.id}`}
                      onClick={(e) => (e.preventDefault(), focusLine(l.id))}
                      className={cn(inlineLink, "block min-h-8 truncate py-1 text-bad")}
                    >
                      Line {i + 1}: {l.text}
                    </a>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        ) : update.error ? (
          <p role="alert" className="text-sm text-bad">
            {apiMessage(update.error, "Could not save. Try again.")}
          </p>
        ) : null}
        <ApproveError error={approve.error} />
      </div>
    </div>
  );
}

/** A citation: points at the fact it uses. Unconfirmed and unknown facts say so in words. */
function FactChip({ id, fact, loading, unavailable }: { id: string; fact: Fact | undefined; loading: boolean; unavailable: boolean }) {
  if (loading) return <Skeleton className="h-7 w-36 rounded-pill" />;
  const unknown = !fact && !unavailable;
  const prefix = unknown ? "Not in your profile" : !fact ? "Fact" : fact.confirmed ? (KIND[fact.kind] ?? fact.kind) : "Not confirmed";
  return (
    <a
      href={`#fact-${id}`}
      className={cn(
        "relative inline-flex h-7 max-w-[min(100%,22rem)] items-center gap-1.5 rounded-pill border px-2.5 text-xs transition-colors duration-300 ease-out",
        "after:absolute after:inset-x-0 after:-inset-y-2 hover:bg-sunk active:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink",
        unknown ? "border-bad/30 text-bad" : fact && !fact.confirmed ? "border-warn/30 text-warn" : "border-line text-body hover:text-ink",
      )}
    >
      <span className="shrink-0 font-medium">{prefix}</span>
      {fact ? <span className="truncate">{fact.text}</span> : null}
    </a>
  );
}

/** Shaped like the editor: the lines pane (lines with citation chips) and the facts pane. */
export function EditorSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading draft" className="@container">
      <div className={editorGrid}>
        <div className="flex flex-col gap-5 glass-panel rounded-card p-6">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-4/5" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3 sm:pl-8">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-7 w-56 max-w-full rounded-pill" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4 glass-panel rounded-card p-6">
          <Skeleton className="h-6 w-48" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 border-t border-line pt-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
