"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, X } from "@phosphor-icons/react";
import { REFINE_OPTIONS, type ResumeSuggestion } from "@auto-career/shared";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Fact } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { Button } from "../shared/button";
import { Textarea } from "../shared/field";
import { ConfirmFacts, FactChips, HIT, IconButton, InlineError, NewFactNote, SuggestionSkeletons } from "./bits";
import { acceptState, locateLine, unconfirmedIds, type FactMap, type LineAt } from "./model";
import { AddFact } from "./review";
import { useWs } from "./workspace";

type Refine = (typeof REFINE_OPTIONS)[number];
const CHIPS: [Refine, string][] = [
  ["shorter", "Shorter"],
  ["longer", "Longer"],
  ["result_first", "Lead with the result"],
  ["natural", "More natural"],
  ["use_numbers", "Use numbers from my facts"],
];
const NO_FACTS: FactMap = new Map();

/** AI rewriter (spec 2.5): a dialog on desktop, a full-height sheet on phones. */
export function Rewriter({ lineId, onClose }: { lineId: string | null; onClose: () => void }) {
  const ws = useWs();
  const at = lineId ? locateLine(ws.doc, lineId) : null;
  return (
    <Dialog open={Boolean(at)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        showCloseButton={false}
        className="max-h-dvh max-w-none gap-0 overflow-y-auto glass-panel rounded-card p-0 text-base ring-0 max-sm:inset-0 max-sm:h-dvh max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:max-h-[88dvh] sm:max-w-[min(1040px,calc(100%-4rem))]"
      >
        {at ? <Body key={at.line.id} at={at} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({ at, onClose }: { at: LineAt; onClose: () => void }) {
  const ws = useWs();
  const id = useId();
  const facts = ws.facts ?? NO_FACTS;
  const [refine, setRefine] = useState<Refine | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<{ busy: boolean; error: unknown; list: ResumeSuggestion[]; made: Fact | null }>({ busy: true, error: null, list: [], made: null });
  const started = useRef(false);

  const linked = [...new Set([...at.entry.lines.flatMap((l) => l.factIds), ...(at.entry.headingFactId ? [at.entry.headingFactId] : [])])];
  const hasMetric = linked.some((f) => facts.get(f)?.kind === "metric" && facts.get(f)?.confirmed);
  const keep = (list: ResumeSuggestion[]) => list.filter((s) => s.lineId === at.line.id).slice(0, 3);

  async function run(opts: { refine?: Refine; note?: string } = {}) {
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const r = await ws.ask({ scope: "line", sectionId: at.section.id, entryId: at.entry.id, lineId: at.line.id, ...opts }, { merge: false });
      setState((s) => ({ busy: false, error: null, list: keep(r.suggestions), made: r.factCreated ?? s.made }));
      if (opts.note) setNote("");
    } catch (error) {
      setState((s) => ({ ...s, busy: false, error }));
    }
  }

  // First suggestions as the dialog opens; refine and own words ask again.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opened line
  }, []);

  const words = note.trim();
  return (
    <div className="grid sm:grid-cols-[15rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)_17rem]">
      <div className="col-span-full flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <DialogTitle className="font-display text-[22px] leading-tight font-normal tracking-[-0.02em] text-ink">Rewrite with AI</DialogTitle>
          <DialogDescription className="text-sm text-body">Every suggestion is written from your confirmed facts and cites them. Nothing changes until you pick one.</DialogDescription>
        </div>
        <DialogClose render={<IconButton label="Close" className="-mt-1 -mr-2" />}>
          <X size={20} weight="light" />
        </DialogClose>
      </div>

      <section aria-labelledby={`${id}-orig`} className="flex flex-col gap-3 border-b border-line px-5 py-5 sm:border-r sm:border-b-0 sm:px-6">
        <h3 id={`${id}-orig`} className="text-sm font-medium text-ink">
          Your line
        </h3>
        <p className="text-[15px] leading-relaxed text-ink">{at.line.text}</p>
        <p className="text-xs text-faint">
          {at.section.title}
          {at.entry.heading ? ` · ${at.entry.heading}` : ""}
        </p>
        <FactChips ids={at.line.factIds} />
      </section>

      <section aria-labelledby={`${id}-sug`} aria-busy={state.busy} className="flex min-w-0 flex-col gap-3 border-b border-line px-5 py-5 sm:px-6 lg:border-b-0">
        <h3 id={`${id}-sug`} className="text-sm font-medium text-ink">
          Suggestions
        </h3>
        {state.busy ? <SuggestionSkeletons /> : null}
        {state.error && !state.busy ? <InlineError error={state.error} onRetry={() => run({ refine: refine ?? undefined })} /> : null}
        {!state.busy && !state.error && !state.list.length ? (
          <p role="status" className="text-sm text-body">
            No changes to suggest from your facts. Pick a refine option, or tell Kairos more in your own words.
          </p>
        ) : null}
        {!state.busy ? (
          <ol className="flex flex-col gap-3">
            {state.list.map((s) => {
              const ok = acceptState(s, facts);
              return (
                <li key={s.id} className="flex flex-col gap-3 rounded-card border border-line p-4">
                  {ok === "needs_fact" ? (
                    <AddFact s={s} onAgain={() => run(refine ? { refine } : {})} />
                  ) : (
                    <p className="text-[15px] leading-relaxed text-ink">{s.after}</p>
                  )}
                  <p className="text-sm text-body">{s.why}</p>
                  {s.factIds.length ? <FactChips ids={s.factIds} /> : null}
                  {ok === "ok" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className={cn(HIT, "self-start")}
                      onClick={() => {
                        ws.accept(s);
                        onClose();
                      }}
                    >
                      Use this<span className="sr-only">: {s.after}</span>
                    </Button>
                  ) : ok === "unconfirmed" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <ConfirmFacts ids={unconfirmedIds(s.factIds, facts)} />
                      <p className="text-sm text-faint">Then you can use it.</p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>

      <section aria-labelledby={`${id}-ref`} className="flex flex-col gap-4 px-5 py-5 sm:col-span-full sm:px-6 lg:col-span-1 lg:border-l lg:border-line">
        <h3 id={`${id}-ref`} className="text-sm font-medium text-ink">
          Not what you want?
        </h3>
        <div role="group" aria-label="Refine" className="flex flex-wrap gap-2">
          {CHIPS.map(([value, label]) => {
            const off = value === "use_numbers" && !hasMetric;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={refine === value}
                disabled={off}
                aria-describedby={off ? `${id}-nometric` : undefined}
                onClick={() => setRefine(refine === value ? null : value)}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-pill border border-rule bg-surface px-4 text-sm font-medium text-ink transition-colors duration-300 ease-out hover:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink active:bg-sunk/70 disabled:cursor-not-allowed disabled:border-line disabled:text-faint aria-pressed:border-ink aria-pressed:bg-sunk gap-1.5"
              >
                {refine === value ? <Check size={14} weight="bold" aria-hidden /> : null}
                {label}
              </button>
            );
          })}
        </div>
        {!hasMetric ? (
          <p id={`${id}-nometric`} className="-mt-1 text-sm text-faint">
            Use numbers needs a confirmed metric fact linked to this entry. There is none yet, and Kairos will not make one up.
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-own`} className="text-sm font-medium text-ink">
            Or say it in your own words
          </label>
          <Textarea id={`${id}-own`} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby={`${id}-own-hint`} className="min-h-20 field-sizing-content" />
          <p id={`${id}-own-hint`} className="text-sm text-faint">
            Saved as a new fact, unconfirmed until you confirm it here. Only facts can be cited.
          </p>
        </div>
        {state.made ? <NewFactNote fact={state.made} /> : null}
        <Button
          className="self-start"
          disabled={state.busy || (words.length > 0 && words.length < 3)}
          onClick={() => run({ ...(refine ? { refine } : {}), ...(words.length >= 3 ? { note: words } : {}) })}
        >
          {state.busy ? "Rewriting…" : "Rewrite"}
        </Button>
      </section>
    </div>
  );
}
