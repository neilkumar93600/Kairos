"use client";

import { useId, useState } from "react";
import type { ResumeSuggestion, SuggestionRequest } from "@auto-career/shared";
import type { Fact } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { Button } from "../shared/button";
import { EmptyState } from "../shared/empty-state";
import { Textarea } from "../shared/field";
import { ConfirmFacts, FactChips, HIT, InlineError, NewFactNote, SuggestionSkeletons } from "./bits";
import { acceptState, unconfirmedIds, type FactMap } from "./model";
import { useWs } from "./workspace";

const NO_FACTS: FactMap = new Map();
const clip = (t: string | null) => (t && t.length > 60 ? `${t.slice(0, 60)}…` : (t ?? ""));

/** The request that asks again about the same spot, used when the user answers a suggestion's question. */
export function scopeOf(s: Pick<ResumeSuggestion, "sectionId" | "entryId" | "lineId">): Omit<SuggestionRequest, "jobId"> {
  if (s.lineId) return { scope: "line", sectionId: s.sectionId, entryId: s.entryId ?? undefined, lineId: s.lineId };
  if (s.entryId) return { scope: "entry", sectionId: s.sectionId, entryId: s.entryId };
  return { scope: "section", sectionId: s.sectionId };
}

/**
 * Accept, Confirm or Answer, then Ignore. Truth rules 3 and 4: a suggestion that needs a fact has no Accept; one that
 * cites an unconfirmed fact offers Confirm first. `inline` is the compact form inside the Suggested edits page.
 */
export function SuggestionActions({ s, inline, onEdit }: { s: ResumeSuggestion; inline?: boolean; onEdit?: () => void }) {
  const ws = useWs();
  const facts = ws.facts ?? NO_FACTS;
  const state = acceptState(s, facts);
  const what = clip(s.after ?? s.before);
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5 align-middle", inline && "ml-1 font-sans text-sm")}>
      {state === "ok" ? (
        <Button size="sm" variant="secondary" className={HIT} onClick={() => ws.accept(s)}>
          Accept<span className="sr-only">: {what}</span>
        </Button>
      ) : state === "unconfirmed" ? (
        <ConfirmFacts ids={unconfirmedIds(s.factIds, facts)} />
      ) : inline ? (
        <Button size="sm" variant="secondary" className={HIT} onClick={() => ws.openLeft("review")}>
          Answer in AI review
        </Button>
      ) : null}
      {onEdit && state === "ok" && s.action !== "remove" ? (
        <Button size="sm" variant="ghost" className={HIT} onClick={onEdit}>
          Edit then accept
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" className={HIT} onClick={() => ws.ignore([s.id])}>
        Ignore<span className="sr-only">: {what}</span>
      </Button>
    </span>
  );
}

/** One proposal: before and after, why, the facts it uses, and what you can do with it. */
export function SuggestionCard({ s }: { s: ResumeSuggestion }) {
  const ws = useWs();
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const section = ws.doc.sections.find((x) => x.id === s.sectionId);
  const entry = section?.entries.find((e) => e.id === s.entryId);
  const needs = acceptState(s, ws.facts ?? NO_FACTS) === "needs_fact";
  const verb = needs ? "Needs a detail" : s.action === "add" ? "Add" : s.action === "remove" ? "Remove" : "Rewrite";
  return (
    <article aria-labelledby={`${id}-k`} className="flex flex-col gap-3 rounded-card border border-line p-4">
      <p id={`${id}-k`} className="text-xs text-faint">
        {verb}
        {section ? ` · ${section.title}` : ""}
        {entry?.heading ? ` · ${entry.heading}` : ""}
      </p>
      {s.before ? (
        <p className={cn("text-sm leading-relaxed", needs ? "text-body" : "text-faint")}>
          {needs ? (
            <>
              <span className="sr-only">Now: </span>
              {s.before}
            </>
          ) : (
            <del>
              <span className="sr-only">{s.action === "remove" ? "Remove: " : "Now: "}</span>
              {s.before}
            </del>
          )}
        </p>
      ) : null}
      {s.after && !needs ? (
        draft === null ? (
          <p className="text-[15px] leading-relaxed text-ink">
            <span className="sr-only">Suggested: </span>
            {s.after}
          </p>
        ) : (
          <EditThenAccept s={s} text={draft} setText={setDraft} />
        )
      ) : null}
      {needs ? (
        <AddFact
          s={s}
          onAgain={async () => {
            await ws.ask(scopeOf(s));
            ws.ignore([s.id]); // the question is answered; what comes back replaces it
          }}
        />
      ) : null}
      <p className="text-sm text-body">{s.why}</p>
      {s.factIds.length ? <FactChips ids={s.factIds} /> : null}
      {draft === null ? <SuggestionActions s={s} onEdit={() => setDraft(s.after ?? "")} /> : null}
    </article>
  );
}

function EditThenAccept({ s, text, setText }: { s: ResumeSuggestion; text: string; setText: (t: string | null) => void }) {
  const ws = useWs();
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Your wording
      </label>
      <Textarea id={id} rows={3} maxLength={400} value={text} onChange={(e) => setText(e.target.value)} autoFocus className="min-h-20 field-sizing-content" />
      <p className="text-sm text-faint">It keeps citing the same facts. Keep to what they say.</p>
      <div className="flex gap-2">
        <Button size="sm" className={HIT} disabled={!text.trim()} onClick={() => ws.accept(s, text.trim())}>
          Accept edit
        </Button>
        <Button size="sm" variant="ghost" className={HIT} onClick={() => setText(null)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * A suggestion that needs a detail asks for it instead of inventing it (truth rule 3). The answer is saved as a new fact
 * of the kind the question names (POST /profile/facts, unconfirmed). Once the user confirms it, `onAgain` asks the
 * Resume Writer again so a suggestion can cite it.
 */
export function AddFact({ s, onAgain }: { s: ResumeSuggestion; onAgain: () => Promise<unknown> }) {
  const ws = useWs();
  const id = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [made, setMade] = useState<Fact | null>(null);
  const question = s.needsFact?.question ?? "What fact would this line rest on?";
  const confirmed = made ? Boolean(ws.facts?.get(made.id)?.confirmed) : false;
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const add = () => run(async () => setMade(await ws.newFact(s.needsFact?.kind ?? "project", text.trim())));
  const again = () => run(onAgain);
  if (made)
    return (
      <div className="flex flex-col gap-3 rounded-input bg-sunk p-3">
        <p className="text-[15px] font-medium text-ink">{question}</p>
        <NewFactNote fact={made} className="bg-sunk" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button size="sm" variant="secondary" className={HIT} disabled={!confirmed || busy} onClick={again} aria-describedby={confirmed ? undefined : `${id}-wait`}>
            {busy ? "Asking…" : "Suggest again with it"}
          </Button>
          {confirmed ? null : (
            <p id={`${id}-wait`} className="text-sm text-faint">
              Confirm it first. Only confirmed facts can be cited.
            </p>
          )}
        </div>
        {error ? <InlineError error={error} onRetry={again} /> : null}
      </div>
    );
  return (
    <div className="flex flex-col gap-2 rounded-input bg-sunk p-3">
      <label htmlFor={id} className="text-[15px] font-medium text-ink">
        {question}
      </label>
      <p id={`${id}-hint`} className="text-sm text-body">
        Kairos does not guess this. Your answer is saved as a fact, unconfirmed until you confirm it.
      </p>
      <Textarea id={id} rows={2} maxLength={400} value={text} onChange={(e) => setText(e.target.value)} aria-describedby={`${id}-hint`} className="min-h-16 field-sizing-content" />
      {error ? <InlineError error={error} onRetry={add} /> : null}
      <Button size="sm" variant="secondary" className={cn(HIT, "self-start")} disabled={busy || text.trim().length < 3} onClick={add}>
        {busy ? "Adding…" : "Add this fact"}
      </Button>
    </div>
  );
}

/** AI review: one pass over the whole resume, grouped by section, with Accept all and Ignore all per section. */
export function ReviewTab() {
  const ws = useWs();
  const [state, setState] = useState<{ busy: boolean; error: unknown; ran: boolean }>({ busy: false, error: null, ran: false });
  const run = async () => {
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      await ws.ask({ scope: "resume" });
      setState({ busy: false, error: null, ran: true });
    } catch (error) {
      setState((s) => ({ ...s, busy: false, error }));
    }
  };
  const facts = ws.facts ?? NO_FACTS;
  const groups = ws.doc.sections.map((sec) => ({ sec, list: ws.pending.filter((s) => s.sectionId === sec.id) })).filter((g) => g.list.length);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-body">
          One pass over the whole {ws.mode === "tailor" ? "copy, aimed at this job" : "resume"}. Each edit shows the change, the reason and the facts it uses. Nothing
          changes until you accept.
        </p>
        <Button size="sm" variant="secondary" className={HIT} onClick={run} disabled={state.busy || !ws.factList.length}>
          {state.busy ? "Reviewing…" : groups.length || state.ran ? "Review again" : "Review my resume"}
        </Button>
        {!ws.factList.length && ws.facts ? <p className="text-sm text-faint">Add facts on Profile first; the review only writes from them.</p> : null}
      </div>
      {state.busy ? <SuggestionSkeletons /> : null}
      {state.error ? <InlineError error={state.error} onRetry={run} /> : null}
      {!state.busy && !groups.length ? (
        <EmptyState
          flat
          title={state.ran ? "No changes to suggest from your facts" : "No suggestions yet"}
          body={state.ran ? "Nothing is waiting for you. Add or confirm facts on Profile, then review again." : "Run a review and Kairos proposes edits from your confirmed facts."}
        />
      ) : null}
      {groups.map(({ sec, list }) => {
        const ready = list.filter((s) => acceptState(s, facts) === "ok");
        return (
          <section key={sec.id} aria-labelledby={`rv-${sec.id}`} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-x-2">
              <h3 id={`rv-${sec.id}`} className="flex items-baseline gap-2 text-[15px] font-medium text-ink">
                {sec.title}
                <span className="font-normal text-faint tabular-nums">{list.length}</span>
              </h3>
              <div className="-mr-2 flex">
                <Button size="sm" variant="ghost" className={HIT} disabled={!ready.length} onClick={() => ws.acceptMany(ready)}>
                  Accept all<span className="sr-only"> in {sec.title}</span>
                </Button>
                <Button size="sm" variant="ghost" className={HIT} onClick={() => ws.ignore(list.map((s) => s.id))}>
                  Ignore all<span className="sr-only"> in {sec.title}</span>
                </Button>
              </div>
            </div>
            {ready.length < list.length ? <p className="-mt-1 text-sm text-faint">Accept all skips edits that need a fact or a confirmation.</p> : null}
            {list.map((s) => (
              <SuggestionCard key={s.id} s={s} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
