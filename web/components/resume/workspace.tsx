"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowCounterClockwise, DownloadSimple, PencilSimple } from "@phosphor-icons/react";
import type { FactKind, JobFit, Resume, ResumeSuggestion, SuggestionRequest } from "@auto-career/shared";
import { useApplicationActions, type ApplicationRow } from "@/hooks/use-applications";
import { useJobFit, useTailor } from "@/hooks/use-jobs";
import { useMatchActions, useMatches, type Match } from "@/hooks/use-matches";
import { useFacts, useProfileActions, type Fact } from "@/hooks/use-profile";
import { useResume, useResumeActions } from "@/hooks/use-resume";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RetryNote } from "../dashboard/profile/fact-list";
import { Button, ButtonLink } from "../shared/button";
import { PageTitle } from "../shared/page-title";
import { Panel } from "../shared/panel";
import { Skeleton } from "../shared/skeleton";
import { StatusWord } from "../shared/status";
import { CommitInput, ConfirmFacts, FactChips, HIT, IconButton, InlineError } from "./bits";
import { DocumentPane, ResumeDocument } from "./document";
import { LeftPanel, PasteJob } from "./editor";
import { RightPanel } from "./insights";
import { PAGE_CONTENT_PX, applySuggestion, mergeSuggestions, resumeCheck, toDraftLines, toInput, type CheckTarget, type FactMap, type Measure } from "./model";
import { Rewriter } from "./rewriter";
import "./resume.css";

const UNDO_LIMIT = 20;
const SAVE_DELAY_MS = 800;
/** Both side panels open together only when the preview still gets a readable page between them. */
const BOTH_PANELS = "(min-width: 1760px)";

type Snap = { doc: Resume; handled: string[] };
type AskResult = { suggestions: ResumeSuggestion[]; factCreated: Fact | null };
export type LeftTab = "editor" | "review" | "layout";
export type RightTab = "check" | "match";
type View = "edit" | "preview" | "match";
type SaveStateName = "saved" | "saving" | "error" | "tailor" | "unsaved";

interface WsValue {
  mode: "base" | "tailor";
  jobId: string | null;
  doc: Resume;
  /** One user edit: one undo step, one autosave in base mode. */
  commit: (fn: (doc: Resume) => Resume) => void;
  /** Suggestions not yet accepted or ignored. */
  pending: ResumeSuggestion[];
  accept: (s: ResumeSuggestion, text?: string) => void;
  acceptMany: (list: ResumeSuggestion[]) => void;
  ignore: (ids: string[]) => void;
  /** Asks the Resume Writer. Results join the pool unless merge is false; a note comes back as an unconfirmed fact. */
  ask: (req: Omit<SuggestionRequest, "jobId">, opts?: { merge?: boolean }) => Promise<AskResult>;
  /** Saves the user's own words as a new fact, unconfirmed until they confirm it (POST /profile/facts). */
  newFact: (kind: FactKind, text: string) => Promise<Fact>;
  facts: FactMap | null;
  factList: Fact[];
  factsError: unknown;
  refetchFacts: () => void;
  confirm: (ids: string[]) => Promise<void>;
  confirming: Set<string>;
  /** Lines the truth lock rejected on the last save or draft. */
  locked: Set<string>;
  fit: JobFit | null;
  matches: Match[] | undefined;
  check: ReturnType<typeof resumeCheck>;
  highlight: Set<string>;
  setHighlight: (ids: string[]) => void;
  /** Highlights lines in the preview and brings the preview into view. */
  showLines: (ids: string[]) => void;
  jump: (t: CheckTarget) => void;
  rewrite: (lineId: string) => void;
  leftTab: LeftTab;
  setLeftTab: (t: LeftTab) => void;
  /** Shows a left-panel tab wherever the user is: unfolds the panel, and on phones switches to the Edit view. */
  openLeft: (t: LeftTab) => void;
  rightTab: RightTab;
  setRightTab: (t: RightTab) => void;
  centreTab: "preview" | "edits";
  setCentreTab: (t: "preview" | "edits") => void;
  openItems: string[];
  setOpenItems: (v: string[]) => void;
  /** At 1280 and up the side panels fold to 56px rails. Below that they are full views. */
  folded: { left: boolean; right: boolean };
  setSide: (side: "left" | "right", open: boolean) => void;
}

const Ctx = createContext<WsValue | null>(null);

export function useWs() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWs is only available inside the resume workspace");
  return v;
}

const subscribeMedia = (q: string) => (cb: () => void) => {
  const m = window.matchMedia(q);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
function useMedia(q: string) {
  return useSyncExternalStore(subscribeMedia(q), () => window.matchMedia(q).matches, () => false);
}

/** Line ids a 422 truth_lock names: PUT /resume sends details.lineIds, PATCH /applications/:id sends [{ line }]. */
function lockedIds(error: unknown) {
  if (!(error instanceof ApiError) || error.code !== "truth_lock") return new Set<string>();
  const d = error.details as { lineIds?: string[] } | { line?: { id?: string } }[] | null;
  if (Array.isArray(d)) return new Set(d.map((x) => x?.line?.id).filter((x): x is string => Boolean(x)));
  return new Set(d?.lineIds ?? []);
}

/** `/resume` edits the base resume; `/resume?job=<jobId>` tailors a copy for one job that only Create draft keeps. */
export function ResumeWorkspace() {
  const jobId = useSearchParams().get("job");
  return jobId ? <TailorLoader jobId={jobId} /> : <BaseLoader />;
}

function BaseLoader() {
  const q = useResume();
  if (q.isPending) return <WorkspaceSkeleton />;
  if (q.error) return <LoadFailed error={q.error} onRetry={() => q.refetch()} />;
  return <Workspace key="base" initial={q.data} />;
}

function TailorLoader({ jobId }: { jobId: string }) {
  const q = useTailor(jobId);
  if (q.isPending) return <WorkspaceSkeleton />;
  // 404: no match or application for this job. Tailoring starts from Matches or from a pasted posting.
  if (q.error instanceof ApiError && q.error.status === 404)
    return (
      <>
        <PageTitle title="This job is not in your matches" body="Kairos tailors for jobs in your matches. Pick one there, or paste the posting link here and Kairos checks it against your fit bar." />
        <div className="grid max-w-4xl gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
          <Panel title="From your matches" description="Every match passed your hard rules. Tailor first opens it here.">
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/matches" variant="secondary">
                Go to Matches
              </ButtonLink>
              <ButtonLink href="/resume" variant="ghost">
                Back to base resume
              </ButtonLink>
            </div>
          </Panel>
          <Panel title="From a posting link">
            <PasteJob />
          </Panel>
        </div>
      </>
    );
  if (q.error) return <LoadFailed error={q.error} onRetry={() => q.refetch()} />;
  return <Workspace key={jobId} initial={q.data.resume} jobId={jobId} initialSuggestions={q.data.suggestions} initialFit={q.data.fit} />;
}

function LoadFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <>
      <h1 className="mb-8 font-display text-[28px] leading-[1.2] tracking-tight text-ink lg:text-[32px]">Resume</h1>
      <RetryNote error={error} onRetry={onRetry} />
    </>
  );
}

function Workspace({ initial, jobId = null, initialSuggestions = [], initialFit = null }: { initial: Resume; jobId?: string | null; initialSuggestions?: ResumeSuggestion[]; initialFit?: JobFit | null }) {
  const mode = jobId ? "tailor" : "base";
  const router = useRouter();
  const xl = useMedia("(min-width: 1280px)");

  /* ---- document, undo, suggestions ---- */
  const [hist, setHist] = useState<{ now: Snap; past: Snap[] }>({ now: { doc: initial, handled: [] }, past: [] });
  const [pool, setPool] = useState(initialSuggestions);
  const { doc, handled } = hist.now;
  const pending = pool.filter((s) => !handled.includes(s.id));
  const push = (fn: (s: Snap) => Snap) =>
    setHist((h) => {
      const next = fn(h.now);
      return next === h.now ? h : { now: next, past: [...h.past, h.now].slice(-UNDO_LIMIT) };
    });
  const commit = (fn: (d: Resume) => Resume) =>
    push((s) => {
      const d = fn(s.doc);
      return d === s.doc ? s : { ...s, doc: d };
    });
  const undo = () => setHist((h) => (h.past.length ? { now: h.past[h.past.length - 1], past: h.past.slice(0, -1) } : h));
  // Accepting one rewrite of a line retires the other rewrites of that line.
  const retired = (s: ResumeSuggestion) => (s.action === "rewrite" && s.lineId ? pool.filter((o) => o.action === "rewrite" && o.lineId === s.lineId).map((o) => o.id) : []);
  const acceptMany = (list: ResumeSuggestion[]) =>
    push((n) => ({ doc: list.reduce((d, s) => applySuggestion(d, s), n.doc), handled: [...n.handled, ...list.flatMap((s) => [s.id, ...retired(s)])] }));
  const accept = (s: ResumeSuggestion, text?: string) => push((n) => ({ doc: applySuggestion(n.doc, s, text), handled: [...n.handled, s.id, ...retired(s)] }));
  const ignore = (ids: string[]) => push((n) => ({ ...n, handled: [...n.handled, ...ids] }));

  /* ---- facts: server list, plus facts made from the user's words this visit, plus confirmations made here ---- */
  const factsQ = useFacts();
  const { updateFact, addFact } = useProfileActions();
  const [sessionFacts, setSessionFacts] = useState<Fact[]>([]);
  const [confirmedHere, setConfirmedHere] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<unknown>(null);
  const merged = new Map<string, Fact>();
  for (const f of [...(factsQ.data ?? []), ...sessionFacts]) merged.set(f.id, confirmedHere.has(f.id) ? { ...f, confirmed: true } : f);
  const factList = [...merged.values()];
  const facts = factsQ.data ? merged : null;

  const fitQ = useJobFit(jobId);
  const fit = fitQ.data?.fit ?? initialFit;

  async function confirm(ids: string[]) {
    const todo = ids.filter((id) => !confirmedHere.has(id) && !confirming.has(id));
    if (!todo.length) return;
    setConfirming((c) => new Set([...c, ...todo]));
    const results = await Promise.allSettled(todo.map((id) => updateFact.mutateAsync({ id, confirmed: true })));
    const ok = todo.filter((_, i) => results[i].status === "fulfilled");
    setConfirmedHere((c) => new Set([...c, ...ok]));
    setConfirming((c) => new Set([...c].filter((id) => !todo.includes(id))));
    const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    setNotice(failed ? failed.reason : null);
    if (ok.length && jobId) fitQ.refetch();
  }

  async function newFact(kind: FactKind, text: string) {
    // confirmed false explicitly: the server defaults a created fact to confirmed.
    const made = await addFact.mutateAsync({ kind, text, confirmed: false });
    setSessionFacts((f) => [...f.filter((x) => x.id !== made.id), made]);
    return made;
  }

  const { save, suggest } = useResumeActions();
  async function ask(req: Omit<SuggestionRequest, "jobId">, { merge = true } = {}) {
    const r = await suggest.mutateAsync({ ...req, ...(jobId ? { jobId } : {}) });
    if (merge) setPool((p) => mergeSuggestions(p, r.suggestions));
    const made = r.factCreated;
    if (made) setSessionFacts((f) => [...f.filter((x) => x.id !== made.id), made]);
    return r;
  }

  /* ---- autosave (base mode only; a tailored copy is never saved on its own) ---- */
  const [savedDoc, setSavedDoc] = useState(initial);
  const runSave = (d: Resume) =>
    save.mutate(toInput(d), {
      onSuccess: () => {
        setSavedDoc(d);
      },
    });
  useEffect(() => {
    if (mode !== "base" || doc === savedDoc) return;
    const t = setTimeout(() => runSave(doc), SAVE_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runSave is recreated each render; doc and savedDoc drive it
  }, [doc, savedDoc, mode]);
  const saveState: SaveStateName =
    mode === "tailor" ? "tailor" : save.isPending ? "saving" : save.isError ? "error" : doc !== savedDoc ? "saving" : "saved";

  /* ---- Create draft (tailoring): the existing queue endpoint, then PATCH with the accepted lines (spec 6) ---- */
  const matchesQ = useMatches();
  const { queue } = useMatchActions();
  const { update } = useApplicationActions();
  const [draft, setDraft] = useState<{ pending: boolean; error: unknown }>({ pending: false, error: null });
  const match = matchesQ.data?.find((m) => m.job.id === jobId);
  // An imported job may not be in the list yet; the fit response carries its match too.
  const matchId = match?.id ?? fitQ.data?.matchId ?? null;
  const lines = toDraftLines(doc);
  // Facts this document cites that the user has not confirmed: the truth lock rejects them on save and on draft.
  const cited = new Set(doc.sections.flatMap((s) => s.entries.flatMap((e) => [...e.lines.flatMap((l) => l.factIds), ...(e.headingFactId ? [e.headingFactId] : [])])));
  const unconfirmed = facts ? [...cited].filter((id) => facts.get(id) && !facts.get(id)!.confirmed) : [];
  const draftBlock = !lines.length
    ? "Add at least one line before you create a draft."
    : unconfirmed.length
      ? "A draft cannot cite unconfirmed facts. Confirm them above first."
    : matchesQ.isPending && !matchId
      ? "Loading your matches."
      : !matchId
        ? "This job is not in your matches, so Kairos cannot queue it from here. Import it on Matches first."
        : null;
  async function createDraft() {
    if (!matchId) return;
    setDraft({ pending: true, error: null });
    try {
      let { applicationId } = await queue.mutateAsync(matchId);
      // null: an application for this job already exists. Find it and update that draft.
      if (!applicationId) applicationId = (await api<{ applications: ApplicationRow[] }>("/applications")).applications.find((a) => a.job.id === jobId)?.id ?? null;
      if (!applicationId) throw new Error("Kairos could not find the application for this job. Try again from Matches.");
      await update.mutateAsync({ id: applicationId, input: { resumeLines: lines } });
      router.push(`/applications/${applicationId}`);
    } catch (e) {
      setDraft({ pending: false, error: e });
    }
  }
  const locked = lockedIds(mode === "base" ? save.error : draft.error);

  // Leaving a tailored copy with edits loses them: say so before the tab closes.
  const edited = hist.past.length > 0;
  useEffect(() => {
    if (mode !== "tailor" || !edited) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [mode, edited]);

  // Ctrl or Cmd+Z undoes a document edit when focus is not in a text field (fields keep their own undo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== "z") return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      setHist((h) => (h.past.length ? { now: h.past[h.past.length - 1], past: h.past.slice(0, -1) } : h));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---- panels and views ---- */
  const [leftTab, setLeftTab] = useState<LeftTab>("editor");
  const [rightTab, setRightTab] = useState<RightTab>(mode === "tailor" ? "match" : "check");
  const [centreTab, setCentreTab] = useState<"preview" | "edits">("preview");
  const [openItems, setOpenItems] = useState<string[]>(() => [initial.sections.find((s) => s.kind === "experience")?.id ?? "contact"]);
  const [view, setView] = useState<View>("edit");
  const [open, setOpen] = useState(() => ({ left: true, right: window.matchMedia(BOTH_PANELS).matches }));
  const setSide = (side: "left" | "right", value: boolean) =>
    setOpen((o) => {
      const next = { ...o, [side]: value };
      if (value && !window.matchMedia(BOTH_PANELS).matches) next[side === "left" ? "right" : "left"] = false;
      return next;
    });
  const [highlight, setHighlightSet] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [rewriting, setRewriting] = useState<string | null>(null);
  const [measure, setMeasure] = useState<Measure | null>(null);
  const panes = useRef<HTMLDivElement>(null);

  function jump(t: CheckTarget) {
    setView("edit");
    setLeftTab("editor");
    if (xl) setSide("left", true);
    const item = t.contact ? "contact" : t.sectionId;
    if (item) setOpenItems([...new Set([...openItems, item])]);
    setHighlightSet(new Set(t.lineId ? [t.lineId] : []));
    setFocusId(t.lineId ? `rline-${t.lineId}` : t.entryId ? `rentry-${t.entryId}` : t.contact ? "rcontact" : t.sectionId ? `rsec-${t.sectionId}` : null);
  }
  useEffect(() => {
    if (!focusId) return;
    // Wait one tick for the accordion and tab to render the target.
    const t = setTimeout(() => {
      const el = document.getElementById(focusId);
      el?.scrollIntoView({ block: "center" });
      el?.focus({ preventScroll: true });
      setFocusId(null);
    }, 60);
    return () => clearTimeout(t);
  }, [focusId]);

  function download() {
    const title = document.title;
    document.title = `${doc.contact.name || "Resume"} resume`; // the browser's default PDF file name
    window.print();
    document.title = title;
  }

  const value: WsValue = {
    mode,
    jobId,
    doc,
    commit,
    pending,
    accept,
    acceptMany,
    ignore,
    ask,
    newFact,
    facts,
    factList,
    factsError: factsQ.error,
    refetchFacts: () => factsQ.refetch(),
    confirm,
    confirming,
    locked,
    fit,
    matches: matchesQ.data,
    check: resumeCheck(doc, facts, measure),
    highlight,
    setHighlight: (ids) => setHighlightSet(new Set(ids)),
    showLines: (ids) => {
      setHighlightSet(new Set(ids));
      setCentreTab("preview");
      setView("preview");
    },
    jump,
    rewrite: setRewriting,
    leftTab,
    setLeftTab,
    openLeft: (t) => {
      setView("edit");
      setLeftTab(t);
      if (xl) setSide("left", true);
    },
    rightTab,
    setRightTab,
    centreTab,
    setCentreTab,
    openItems,
    setOpenItems,
    folded: { left: xl && !open.left, right: xl && !open.right },
    setSide,
  };

  const action =
    mode === "base" ? (
      <Button onClick={download} className="max-sm:w-full">
        <DownloadSimple size={18} weight="light" aria-hidden />
        Download PDF
      </Button>
    ) : (
      <Button onClick={createDraft} disabled={draft.pending || Boolean(draftBlock)} aria-describedby={draftBlock ? (unconfirmed.length ? "unconfirmed-note" : "draft-block") : undefined} className="max-sm:w-full">
        {draft.pending ? "Creating draft…" : "Create draft"}
      </Button>
    );

  return (
    <Ctx.Provider value={value}>
      <div className="flex flex-col gap-4 pb-24 sm:pb-0 xl:-mx-6 xl:h-[calc(100dvh-8rem)] xl:min-h-[40rem]">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 flex-wrap items-center gap-x-2 font-display text-[26px] leading-[1.2] tracking-[-0.025em]">
              <li className="text-faint">
                {mode === "tailor" ? (
                  <Link href="/resume" className="underline decoration-1 underline-offset-4 transition-colors duration-300 ease-out hover:text-ink">
                    Resume
                  </Link>
                ) : (
                  "Resume"
                )}
              </li>
              <li aria-hidden className="text-faint">
                /
              </li>
              <li aria-current="page" className="min-w-0">
                {mode === "tailor" ? (
                  <h1 className="text-balance text-ink">Tailoring for {fit ? `${fit.title} at ${fit.company}` : "this job"}</h1>
                ) : (
                  <ResumeName />
                )}
              </li>
            </ol>
          </nav>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:justify-end">
            <Button variant="ghost" size="sm" className={HIT} onClick={undo} disabled={!hist.past.length} title="Undo, Ctrl+Z">
              <ArrowCounterClockwise size={18} weight="light" aria-hidden />
              Undo
            </Button>
            <SaveState state={saveState} locked={locked.size} onRetry={() => runSave(doc)} />
            <div className="max-sm:hidden">{action}</div>
          </div>
        </header>

        {mode === "tailor" ? (
          <p className="rounded-card bg-sunk px-4 py-3 text-sm text-ink">
            Changes here go into this job&apos;s draft, not your base resume.{" "}
            <Link href="/resume" className="font-medium whitespace-nowrap underline underline-offset-3 hover:no-underline">
              Back to base resume
            </Link>
          </p>
        ) : null}
        {draftBlock && mode === "tailor" && !matchesQ.isPending && !unconfirmed.length ? (
          <p id="draft-block" className="text-sm text-body">
            {draftBlock}
          </p>
        ) : null}
        {draft.error ? (
          <InlineError error={locked.size ? new ApiError(422, "truth_lock", `${locked.size} line${locked.size === 1 ? "" : "s"} failed the truth lock. Each line needs a confirmed fact. Fix the marked lines and try again.`) : draft.error} onRetry={createDraft} />
        ) : null}
        {notice ? <InlineError error={notice} /> : null}
        {unconfirmed.length ? (
          <div className="flex flex-col gap-3 glass-panel rounded-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <p id="unconfirmed-note" className="text-sm text-ink">
                {unconfirmed.length === 1 ? "1 fact this resume cites is" : `${unconfirmed.length} facts this resume cites are`} not confirmed. Lines that cite{" "}
                {unconfirmed.length === 1 ? "it" : "them"} cannot be saved{mode === "tailor" ? " or sent" : ""} until you confirm.
              </p>
              <FactChips ids={unconfirmed.slice(0, 3)} />
            </div>
            <ConfirmFacts ids={unconfirmed} label={unconfirmed.length === 1 ? "Confirm it" : `Confirm all ${unconfirmed.length}`} describedBy="unconfirmed-note" />
          </div>
        ) : null}

        <div role="group" aria-label="Workspace view" className="glass-panel sticky top-0 z-20 rounded-card px-2 py-2 xl:hidden">
          <div className="grid grid-cols-3 rounded-pill bg-sunk p-1">
            {(["edit", "preview", "match"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => {
                  setView(v);
                  // Land at the top of the new view, not mid-page where the old one was scrolled to.
                  if ((panes.current?.getBoundingClientRect().top ?? 0) < 0) panes.current?.scrollIntoView({ block: "start" });
                }}
                className="h-11 cursor-pointer rounded-pill text-sm font-medium text-faint transition-colors duration-300 ease-out hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-edge"
              >
                {v === "edit" ? "Edit" : v === "preview" ? "Preview" : "Match"}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={panes}
          className="flex min-h-0 flex-1 scroll-mt-20 flex-col gap-4 xl:grid xl:grid-cols-[var(--lw)_minmax(0,1fr)_var(--rw)]"
          style={{ "--lw": open.left ? "400px" : "56px", "--rw": open.right ? "360px" : "56px" } as CSSProperties}
        >
          <Pane show={view === "edit"}>
            <LeftPanel />
          </Pane>
          <Pane show={view === "preview"}>
            <DocumentPane pages={measure?.pages ?? 1} />
          </Pane>
          <Pane show={view === "match"}>
            <RightPanel />
          </Pane>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-[var(--app-tabbar-h)] z-30 glass-panel px-4 py-3 sm:hidden">{action}</div>
      <PrintCopy doc={doc} onMeasure={setMeasure} />
      <Rewriter lineId={rewriting} onClose={() => setRewriting(null)} />
    </Ctx.Provider>
  );
}

function Pane({ show, children }: { show: boolean; children: ReactNode }) {
  return <div className={cn("flex min-h-0 min-w-0 flex-col", !show && "max-xl:hidden")}>{children}</div>;
}

/** The last breadcrumb is the page's h1 and the resume's name, renamed in place. */
function ResumeName() {
  const { doc, commit } = useWs();
  const [editing, setEditing] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const done = () => {
    setEditing(false);
    setTimeout(() => button.current?.focus(), 0);
  };
  return (
    <h1 className="flex min-w-0 items-center gap-1 text-ink">
      {editing ? (
        <CommitInput
          autoFocus
          aria-label="Resume name"
          maxLength={120}
          value={doc.name}
          onCommit={(v) => (v.trim() ? commit((d) => ({ ...d, name: v.trim() })) : undefined)}
          onBlur={done}
          className="h-11 w-72 max-w-full font-display text-[22px] tracking-[-0.02em]"
        />
      ) : (
        <>
          <span className="truncate">{doc.name}</span>
          <IconButton ref={button} label="Rename resume" onClick={() => setEditing(true)}>
            <PencilSimple size={18} weight="light" />
          </IconButton>
        </>
      )}
    </h1>
  );
}

function SaveState({ state, locked, onRetry }: { state: SaveStateName; locked: number; onRetry: () => void }) {
  return (
    <div className="flex min-h-11 items-center gap-2 px-1">
      <span role="status" className="inline-flex">
        {state === "saved" ? (
          <StatusWord tone="positive">Saved</StatusWord>
        ) : state === "saving" ? (
          <StatusWord tone="open">Saving…</StatusWord>
        ) : state === "tailor" ? (
          <StatusWord tone="neutral">Not saved until Create draft</StatusWord>
        ) : state === "unsaved" ? (
          <StatusWord tone="open">Not saved yet</StatusWord>
        ) : (
          <StatusWord tone="bad">{locked ? `Not saved: the truth lock flagged ${locked}` : "Not saved"}</StatusWord>
        )}
      </span>
      {state === "error" ? (
        <button type="button" onClick={onRetry} className="min-h-11 cursor-pointer px-1 text-sm font-medium text-ink underline underline-offset-3 hover:no-underline">
          Retry
        </button>
      ) : null}
    </div>
  );
}

/**
 * The print copy: the same document, portalled under body. On screen it sits off canvas and invisible, and it is the
 * measuring copy for page count and long lines; the print stylesheet shows only it, at US Letter.
 */
function PrintCopy({ doc, onMeasure }: { doc: Resume; onMeasure: (m: Measure) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef("");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const longLineIds = [...el.querySelectorAll<HTMLElement>("[data-line-id]")]
        .filter((n) => {
          const lh = parseFloat(getComputedStyle(n).lineHeight);
          return lh > 0 && n.offsetHeight > lh * 2.5;
        })
        .map((n) => n.dataset.lineId!);
      const m = { pages: Math.max(1, Math.ceil((el.scrollHeight - 1) / PAGE_CONTENT_PX)), longLineIds };
      const key = JSON.stringify(m);
      if (key !== last.current) {
        last.current = key;
        onMeasure(m);
      }
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc, onMeasure]);
  return createPortal(
    <div ref={ref} className="rprint">
      <ResumeDocument doc={doc} print />
    </div>,
    document.body,
  );
}

/** Same frame as the loaded workspace: header, the editor panel, the page and the right rail. */
export function WorkspaceSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4 xl:-mx-6 xl:h-[calc(100dvh-8rem)] xl:min-h-[40rem]">
      <h1 className="sr-only">Resume</h1>
      <span role="status" className="sr-only">
        Loading your resume
      </span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-60" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-pill" />
          <Skeleton className="h-9 w-20 rounded-pill" />
          <Skeleton className="h-11 w-40 rounded-pill max-sm:hidden" />
        </div>
      </div>
      <Skeleton className="h-13 w-full rounded-pill xl:hidden" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 xl:grid xl:grid-cols-[400px_minmax(0,1fr)_56px]">
        <div className="flex flex-col gap-3 glass-panel rounded-card p-4">
          <Skeleton className="h-11 w-full rounded-pill" />
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-t border-line pt-3">
              <Skeleton className="size-6 rounded-pill" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-auto h-6 w-14 rounded-pill" />
            </div>
          ))}
        </div>
        <div className="hidden min-h-0 flex-col gap-4 xl:flex">
          <Skeleton className="h-11 w-64 rounded-pill" />
          <div className="flex justify-center">
            <Skeleton className="aspect-[8.5/11] w-full max-w-[612px] rounded-none" />
          </div>
        </div>
        <Skeleton className="hidden h-48 w-14 rounded-card xl:block" />
      </div>
    </div>
  );
}
