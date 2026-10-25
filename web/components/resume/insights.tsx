"use client";

import { useId, useState } from "react";
import { CaretLineLeft, CaretLineRight, Check, ListChecks, Target } from "@phosphor-icons/react";
import type { JobFit } from "@auto-career/shared";
import type { Fact } from "@/hooks/use-profile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Button } from "../shared/button";
import { EmptyState } from "../shared/empty-state";
import { Textarea } from "../shared/field";
import { StatusWord, type StatusTone } from "../shared/status";
import { ConfirmFacts, FactChips, HIT, IconButton, InlineError, NewFactNote, Rail, tabList, tabTrigger } from "./bits";
import { addLine, unconfirmedIds, visibleLines, type FactMap } from "./model";
import { useWs } from "./workspace";

const NO_FACTS: FactMap = new Map();
const numeral = "font-display text-[48px] leading-none tracking-[-0.045em] text-ink tabular-nums slashed-zero";

/** Right panel: the Resume check and Job match. From 1280 it folds to a rail that still shows both numbers. */
export function RightPanel() {
  const ws = useWs();
  const show = (t: typeof ws.rightTab) => {
    ws.setRightTab(t);
    ws.setSide("right", true);
  };
  const matchScore = ws.mode === "tailor" && ws.fit ? ws.fit.score : undefined;
  if (ws.folded.right)
    return (
      <Rail
        label="Check and job match panel"
        items={[
          { label: "Open the check panel", icon: <CaretLineLeft size={20} weight="light" />, onClick: () => ws.setSide("right", true) },
          { label: ws.check.score === null ? "Resume check, no score yet" : `Resume check, ${ws.check.score} of 100`, icon: <ListChecks size={20} weight="light" />, note: ws.check.score ?? "…", onClick: () => show("check") },
          { label: matchScore === undefined ? "Job match" : `Job match, ${matchScore} of 100`, icon: <Target size={20} weight="light" />, note: matchScore, onClick: () => show("match") },
        ]}
      />
    );
  return (
    <section aria-labelledby="right-title" className="flex min-h-0 flex-1 flex-col glass-panel rounded-card">
      <h2 id="right-title" className="sr-only">
        Check and job match
      </h2>
      <Tabs value={ws.rightTab} onValueChange={(v) => ws.setRightTab(v as typeof ws.rightTab)} className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="flex items-center gap-1 border-b border-line p-3">
          <IconButton label="Fold the check panel" className="max-xl:hidden" onClick={() => ws.setSide("right", false)}>
            <CaretLineRight size={20} weight="light" />
          </IconButton>
          <TabsList className={tabList}>
            <TabsTrigger value="check" className={tabTrigger}>
              Check
            </TabsTrigger>
            <TabsTrigger value="match" className={tabTrigger}>
              Job match
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="check" className="relative min-h-0 flex-1 overflow-y-auto p-4">
          <CheckTab />
        </TabsContent>
        <TabsContent value="match" className="relative min-h-0 flex-1 overflow-y-auto p-4">
          <MatchTab />
        </TabsContent>
      </Tabs>
    </section>
  );
}

/** Resume check (truth rule 5): plain checks computed here from the document, each named with what it flags. */
function CheckTab() {
  const { check, jump } = useWs();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 className="text-[15px] font-medium text-ink">Resume check</h3>
        {check.score === null ? (
          <p className="text-sm text-body">{check.basis}.</p>
        ) : (
          <>
            <p className="flex items-baseline gap-2">
              <span className={numeral}>{check.score}</span>
              <span className="text-sm text-faint">of 100</span>
            </p>
            <p className="text-sm text-body">{check.basis}. The same document always gets the same result.</p>
          </>
        )}
      </div>
      <ul className="flex flex-col">
        {check.checks.map((c) => {
          const tone: StatusTone = c.status === "pass" ? "positive" : c.status === "fail" ? "warn" : "neutral";
          return (
            <li key={c.id} className="flex flex-col gap-1.5 border-t border-line py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[15px] text-ink">{c.label}</p>
                <StatusWord tone={tone} className="pt-0.5">
                  {c.status === "pass" ? "Passes" : c.status === "fail" ? "To fix" : c.status === "pending" ? "Checking" : "Not yet"}
                </StatusWord>
              </div>
              <p className="text-sm text-body">{c.detail}</p>
              {c.status === "fail" && c.targets.length ? (
                <ul className="flex flex-col" aria-label={`Flagged by: ${c.label}`}>
                  {c.targets.slice(0, 8).map((t) => (
                    <li key={t.label}>
                      {t.lineId || t.sectionId || t.contact ? (
                        <button
                          type="button"
                          onClick={() => jump(t)}
                          className="min-h-11 cursor-pointer py-2 text-left text-sm text-ink underline decoration-1 underline-offset-3 transition-colors duration-300 ease-out hover:no-underline"
                        >
                          {t.label}
                        </button>
                      ) : (
                        <p className="py-1 text-sm text-faint">{t.label}</p>
                      )}
                    </li>
                  ))}
                  {c.targets.length > 8 ? <li className="py-1 text-sm text-faint">and {c.targets.length - 8} more</li> : null}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const BAND: Record<NonNullable<JobFit["band"]>, { label: string; tone: StatusTone }> = {
  great: { label: "Great match", tone: "positive" },
  fair: { label: "Fair match", tone: "open" },
  poor: { label: "Poor match", tone: "warn" },
};
const REQ: Record<JobFit["requirements"][number]["status"], { label: string; tone: StatusTone }> = {
  covered: { label: "Covered", tone: "positive" },
  unconfirmed: { label: "Unconfirmed", tone: "open" },
  missing: { label: "Missing", tone: "neutral" },
};

/**
 * Job match (truth rule 5): the backend's deterministic coverage score with its band and four categories, then the
 * posting's requirements and keywords. It counts confirmed facts only and is never presented as a forecast.
 */
function MatchTab() {
  const ws = useWs();
  if (ws.mode === "base" || !ws.fit)
    return (
      <EmptyState
        flat
        icon={Target}
        title="Pick a target job"
        body="Job match compares this resume with one posting, using confirmed facts only. Choose a match or paste a job link."
        action={
          <Button
            size="sm"
            variant="secondary"
            className={HIT}
            onClick={() => {
              ws.openLeft("editor");
              ws.setOpenItems([...new Set([...ws.openItems, "target"])]);
            }}
          >
            Pick a target job
          </Button>
        }
      />
    );
  const fit = ws.fit;
  const facts = ws.facts ?? NO_FACTS;
  const lines = visibleLines(ws.doc);
  const text = lines.map((l) => l.line.text.toLowerCase()).join("\n");
  const linesCiting = (ids: string[]) => lines.filter((l) => l.line.factIds.some((f) => ids.includes(f))).map((l) => l.line.id);
  const skills = ws.doc.sections.find((s) => s.kind === "skills");

  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby="fit-score" className="flex flex-col gap-2">
        <h3 id="fit-score" className="text-[15px] font-medium text-ink">
          Job match
        </h3>
        <p className="text-sm text-body">
          {fit.title} at {fit.company}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={numeral}>{fit.score}</span>
          <span className="text-sm text-faint">of 100</span>
          {fit.band ? <StatusWord tone={BAND[fit.band].tone}>{BAND[fit.band].label}</StatusWord> : null}
        </div>
        {fit.categories?.length ? (
          <>
            <dl className="mt-2 flex flex-col">
              {fit.categories.map((c) => {
                // The backend leaves a category it could not evaluate out of the total: points 0 with a reason.
                const excluded = c.points === 0 && c.reason !== null;
                return (
                  <div key={c.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-t border-line py-2.5">
                    <dt className="text-sm text-ink">{c.name}</dt>
                    <dd className={cn("text-sm tabular-nums", excluded ? "text-faint" : "text-ink")}>{excluded ? "Not scored" : `${c.points} of ${c.max}`}</dd>
                    {c.reason ? <dd className="col-span-2 text-sm text-faint">{c.reason}</dd> : null}
                  </div>
                );
              })}
            </dl>
            {fit.categories.some((c) => c.points === 0 && c.reason !== null) ? (
              <p className="text-sm text-faint">A category that is not scored leaves the total. It does not count against you.</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-body">{fit.basis}</p>
        )}
        <p className="text-sm text-faint">Counts your confirmed facts and this resume. An unconfirmed fact counts for nothing until you confirm it.</p>
      </section>

      <section aria-labelledby="fit-reqs" className="flex flex-col gap-4">
        <h3 id="fit-reqs" className="text-[15px] font-medium text-ink">
          Requirements
        </h3>
        {[true, false].map((required) => {
          const list = fit.requirements.filter((r) => r.required === required);
          if (!list.length) return null;
          return (
            <div key={String(required)} className="flex flex-col">
              <h4 className="pb-2 text-sm font-medium text-ink">
                {required ? "Required" : "Preferred"}{" "}
                <span className="font-normal text-faint">
                  {list.filter((r) => r.status === "covered").length} of {list.length} covered
                </span>
              </h4>
              <ul className="flex flex-col">
                {list.map((r) => {
                  const cited = linesCiting(r.factIds);
                  return (
                    <li key={r.id} className="flex flex-col gap-2 border-t border-line py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[15px] text-ink">{r.text}</p>
                        <StatusWord tone={REQ[r.status].tone} className="pt-0.5">
                          {REQ[r.status].label}
                        </StatusWord>
                      </div>
                      {r.factIds.length ? <FactChips ids={r.factIds} /> : null}
                      {r.status === "covered" ? (
                        cited.length ? (
                          <Button size="sm" variant="ghost" className={cn(HIT, "-ml-4 self-start")} onClick={() => ws.showLines(cited)}>
                            Show {cited.length === 1 ? "the line" : `${cited.length} lines`} in the preview
                          </Button>
                        ) : (
                          <p className="text-sm text-faint">No line cites it yet. Add one in Editor.</p>
                        )
                      ) : r.status === "unconfirmed" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <ConfirmFacts ids={unconfirmedIds(r.factIds, facts)} label="Confirm" />
                          <p className="text-sm text-faint">A fact exists; it counts once you confirm it.</p>
                        </div>
                      ) : (
                        <NoteFact cta="If this is true, add it as a fact" placeholder={r.text} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="fit-kw" className="flex flex-col gap-2">
        <h3 id="fit-kw" className="text-[15px] font-medium text-ink">
          Keywords from the posting
        </h3>
        <ul className="flex flex-col">
          {fit.keywords.map((k) => {
            const inResume = text.includes(k.term.toLowerCase());
            const confirmed = k.factIds.filter((id) => facts.get(id)?.confirmed);
            return (
              <li key={k.term} className="flex flex-col gap-2 border-t border-line py-3">
                <div className="flex items-center gap-3">
                  <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center border", inResume ? "border-ink bg-ink text-on-action" : "border-rule")}>
                    {inResume ? <Check size={12} weight="bold" /> : null}
                  </span>
                  <p className="min-w-0 flex-1 text-[15px] text-ink">{k.term}</p>
                  {inResume ? <StatusWord tone="positive">In resume</StatusWord> : null}
                </div>
                {inResume ? null : k.factIds.length ? (
                  confirmed.length ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className={cn(HIT, "self-start")}
                      disabled={!skills}
                      onClick={() => skills && ws.commit((d) => addLine(d, skills.id, null, k.term, confirmed))}
                    >
                      Add to skills<span className="sr-only">: {k.term}</span>
                    </Button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <ConfirmFacts ids={unconfirmedIds(k.factIds, facts)} label="Confirm the fact" />
                      <p className="text-sm text-faint">Then you can add it to skills.</p>
                    </div>
                  )
                ) : (
                  <NoteFact cta="Add as a fact if true" placeholder={`How you have used ${k.term}`} />
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Adds a fact in the user's words (POST /profile/facts), unconfirmed until they confirm it. */
function NoteFact({ cta, placeholder }: { cta: string; placeholder: string }) {
  const ws = useWs();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [made, setMade] = useState<Fact | null>(null);
  if (made) return <NewFactNote fact={made} />;
  if (!open)
    return (
      <Button size="sm" variant="ghost" className={cn(HIT, "-ml-4 self-start")} onClick={() => setOpen(true)}>
        {cta}
      </Button>
    );
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setMade(await ws.newFact("skill", text.trim()));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        In your words
      </label>
      <Textarea id={id} rows={2} maxLength={500} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} className="min-h-16 field-sizing-content" autoFocus />
      <p className="text-sm text-faint">Saved as a fact, unconfirmed until you confirm it.</p>
      {error ? <InlineError error={error} onRetry={submit} /> : null}
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className={HIT} disabled={busy || text.trim().length < 3} onClick={submit}>
          {busy ? "Adding…" : "Add fact"}
        </Button>
        <Button size="sm" variant="ghost" className={HIT} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
