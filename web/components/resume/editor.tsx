"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CaretLineLeft,
  CaretLineRight,
  DotsThree,
  Eye,
  EyeSlash,
  ListChecks,
  MagicWand,
  Minus,
  PencilSimpleLine,
  Plus,
  Rows,
  SortDescending,
  Trash,
} from "@phosphor-icons/react";
import type { ResumeEntry, ResumeLine, ResumeSection, SuggestionRequest } from "@auto-career/shared";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SUPPORTED_BOARD, useImportJob, type ImportedJob } from "@/hooks/use-jobs";
import { useProfile } from "@/hooks/use-profile";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RetryNote } from "../dashboard/profile/fact-list";
import { Button, ButtonLink } from "../shared/button";
import { EmptyState } from "../shared/empty-state";
import { Field, Input, Select, Textarea } from "../shared/field";
import { Skeleton } from "../shared/skeleton";
import { CommitInput, ConfirmFacts, FactChips, HIT, IconButton, InlineError, Rail, SuggestionSkeletons, Tag, iconButton, menuItem, tabList, tabTrigger } from "./bits";
import { addLine, blankEntry, editEntry, editSection, moveEntry, moveLine, moveSection, newId, removeLine, setLine, sortNewestFirst } from "./model";
import { ReviewTab, SuggestionCard } from "./review";
import { useWs } from "./workspace";

const AI_KINDS = new Set<ResumeSection["kind"]>(["summary", "skills", "experience", "projects"]);
const ENTRY_KINDS = new Set<ResumeSection["kind"]>(["experience", "projects", "education", "certifications"]);
const MAX_SECTIONS = 12; // resumeInputSchema

/** Left panel: Editor, AI review and Layout. From 1280 it folds to a 56px rail. */
export function LeftPanel() {
  const ws = useWs();
  const open = (t: typeof ws.leftTab) => {
    ws.setLeftTab(t);
    ws.setSide("left", true);
  };
  if (ws.folded.left)
    return (
      <Rail
        label="Editor panel"
        items={[
          { label: "Open the editor panel", icon: <CaretLineRight size={20} weight="light" />, onClick: () => ws.setSide("left", true) },
          { label: "Editor", icon: <PencilSimpleLine size={20} weight="light" />, onClick: () => open("editor") },
          { label: `AI review, ${ws.pending.length} suggestions`, icon: <MagicWand size={20} weight="light" />, note: ws.pending.length || undefined, onClick: () => open("review") },
          { label: "Layout", icon: <Rows size={20} weight="light" />, onClick: () => open("layout") },
        ]}
      />
    );

  return (
    <section aria-labelledby="left-title" className="flex min-h-0 flex-1 flex-col glass-panel rounded-card">
      <h2 id="left-title" className="sr-only">
        Edit your resume
      </h2>
      <Tabs value={ws.leftTab} onValueChange={(v) => ws.setLeftTab(v as typeof ws.leftTab)} className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="flex items-center gap-1 border-b border-line p-3">
          <TabsList className={tabList}>
            <TabsTrigger value="editor" className={tabTrigger}>
              Editor
            </TabsTrigger>
            <TabsTrigger value="review" className={tabTrigger}>
              AI review
              {ws.pending.length ? <span className="text-faint tabular-nums">{ws.pending.length}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="layout" className={tabTrigger}>
              Layout
            </TabsTrigger>
          </TabsList>
          <IconButton label="Fold the editor panel" className="max-xl:hidden" onClick={() => ws.setSide("left", false)}>
            <CaretLineLeft size={20} weight="light" />
          </IconButton>
        </div>
        <TabsContent value="editor" className="relative min-h-0 flex-1 overflow-y-auto">
          <EditorTab />
        </TabsContent>
        <TabsContent value="review" className="relative min-h-0 flex-1 overflow-y-auto p-4">
          <ReviewTab />
        </TabsContent>
        <TabsContent value="layout" className="relative min-h-0 flex-1 overflow-y-auto p-4">
          <LayoutTab />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function EditorTab() {
  const ws = useWs();
  const { doc } = ws;
  const contactGaps = (["name", "email", "phone", "location"] as const).filter((k) => !doc.contact[k].trim()).length;
  return (
    <div className="flex flex-col pb-4">
      {ws.factsError ? (
        <div className="border-b border-line p-4">
          <RetryNote error={ws.factsError} onRetry={ws.refetchFacts} />
        </div>
      ) : ws.facts && !ws.factList.length ? (
        <div className="border-b border-line p-4">
          <EmptyState
            flat
            icon={ListChecks}
            title="Add facts first"
            body="Every line cites a fact you confirmed. Paste your resume on Profile and Kairos reads it into facts for you to check."
            action={
              <ButtonLink href="/profile" size="sm" variant="secondary" className={HIT}>
                Add facts on Profile
              </ButtonLink>
            }
          />
        </div>
      ) : null}
      <Accordion multiple value={ws.openItems} onValueChange={(v) => ws.setOpenItems(v as string[])}>
        <Row value="target" title="Target job" badges={ws.mode === "tailor" ? <Tag tone="ink">Tailoring</Tag> : null}>
          <TargetJob />
        </Row>
        <Row value="contact" title="Contact" badges={contactGaps ? <Tag tone="warn">{contactGaps} missing</Tag> : null}>
          <ContactForm />
        </Row>
        {doc.sections.map((s) => {
          const lines = s.entries.reduce((n, e) => n + e.lines.length + (e.heading.trim() ? 1 : 0), 0);
          const ai = ws.pending.filter((p) => p.sectionId === s.id).length;
          return (
            <Row
              key={s.id}
              value={s.id}
              title={s.title}
              badges={
                <>
                  {ai ? <Tag tone="ink">AI {ai}</Tag> : AI_KINDS.has(s.kind) && lines ? <Tag>AI</Tag> : null}
                  {lines ? null : <Tag tone="warn">Empty</Tag>}
                  {s.hidden ? <Tag>Hidden</Tag> : null}
                </>
              }
            >
              <SectionBody section={s} />
            </Row>
          );
        })}
      </Accordion>
      <AddSection />
    </div>
  );
}

/** One accordion row: plus or minus, the name, its badges. */
function Row({ value, title, badges, children }: { value: string; title: string; badges?: ReactNode; children: ReactNode }) {
  const { openItems } = useWs();
  const open = openItems.includes(value);
  return (
    <AccordionItem value={value} className="border-b border-line">
      <AccordionTrigger className="min-h-14 items-center gap-3 rounded-none border-0 px-4 py-2 font-sans text-[15px] font-medium text-ink transition-colors duration-300 ease-out hover:bg-sunk/50 hover:no-underline focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink **:data-[slot=accordion-trigger-icon]:hidden!">
        <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-sunk text-icon">
          {open ? <Minus size={14} weight="light" /> : <Plus size={14} weight="light" />}
        </span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <span className="flex shrink-0 items-center gap-1.5">{badges}</span>
      </AccordionTrigger>
      <AccordionContent keepMounted className="h-auto px-4 pt-1 pb-5 text-base">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

/* ---- Target job: a match or a pasted posting switches the workspace into tailoring ---- */

function TargetJob() {
  const ws = useWs();
  const top = ws.matches?.slice(0, 5);
  return (
    <div className="flex flex-col gap-5">
      {ws.mode === "tailor" ? (
        <p className="text-sm text-body">
          Tailoring for <span className="font-medium text-ink">{ws.fit ? `${ws.fit.title} at ${ws.fit.company}` : "this job"}</span>.{" "}
          <Link href="/resume" className="font-medium text-ink underline underline-offset-3 hover:no-underline">
            Back to base resume
          </Link>
        </p>
      ) : (
        <p className="text-sm text-body">Pick a match or paste a posting link. You tailor a copy; your base resume stays as it is.</p>
      )}
      {top === undefined ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : top.length ? (
        <ul aria-label="Your best matches" className="-mx-2 flex flex-col">
          {top.map((m) => (
            <li key={m.id}>
              <Link
                href={`/resume?job=${encodeURIComponent(m.job.id)}`}
                aria-current={m.job.id === ws.jobId ? "page" : undefined}
                className="flex min-h-14 items-center justify-between gap-3 rounded-input px-2 py-2 transition-colors duration-300 ease-out hover:bg-sunk active:bg-sunk aria-[current=page]:bg-sunk"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium text-ink">{m.job.title}</span>
                  <span className="block truncate text-sm text-faint">
                    {m.company.name}
                    {m.job.location ? `, ${m.job.location}` : ""}
                  </span>
                </span>
                {m.score !== null ? <span className="shrink-0 text-sm text-ink tabular-nums">Fit {m.score}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-body">No matches yet. Paste a posting link, or come back when Matches has jobs.</p>
      )}
      <PasteJob />
    </div>
  );
}

function importError(error: unknown) {
  if (error instanceof ApiError && error.code === "unsupported_board") return "Kairos reads Greenhouse, Lever and Ashby postings. This link is from another site.";
  if (error instanceof ApiError && error.status === 404) return "That posting is closed or no longer exists.";
  if (error instanceof ApiError) return error.message;
  return "Could not read that posting. Check your connection and try again.";
}

/** Paste a job URL (spec section 4): checked in the browser, then imported. Below the fit bar shows why, and lets you go on. */
export function PasteJob() {
  const router = useRouter();
  const imp = useImportJob();
  const [url, setUrl] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const [below, setBelow] = useState<ImportedJob | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBelow(null);
    const u = url.trim();
    if (!SUPPORTED_BOARD.test(u)) return setLocal("Paste a Greenhouse, Lever or Ashby posting link that starts with https://");
    setLocal(null);
    imp.mutate({ url: u }, { onSuccess: (r) => (r.fit.passed ? router.push(`/resume?job=${encodeURIComponent(r.jobId)}`) : setBelow(r)) });
  };
  const error = local ?? (imp.error ? importError(imp.error) : null);
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor="paste-job" className="text-sm font-medium text-ink">
        Paste a job link
      </label>
      <div className="flex gap-2">
        <Input
          id="paste-job"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://jobs.lever.co/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "paste-job-error" : "paste-job-hint"}
        />
        <Button type="submit" variant="secondary" disabled={imp.isPending} className="shrink-0">
          {imp.isPending ? "Reading…" : "Tailor"}
        </Button>
      </div>
      {error ? (
        <p id="paste-job-error" role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : (
        <p id="paste-job-hint" className="text-sm text-faint">
          Greenhouse, Lever and Ashby postings.
        </p>
      )}
      {below ? (
        <div role="status" className="flex flex-col items-start gap-2 rounded-input bg-sunk p-3">
          <p className="text-sm font-medium text-ink">This job is below your fit bar</p>
          <ul className="list-disc pl-5 text-sm text-body">
            {below.fit.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <ButtonLink href={`/resume?job=${encodeURIComponent(below.jobId)}`} size="sm" variant="secondary" className={HIT}>
            Tailor anyway
          </ButtonLink>
        </div>
      ) : null}
    </form>
  );
}

/* ---- Contact ---- */

function ContactForm() {
  const { doc, commit } = useWs();
  const profile = useProfile();
  const c = doc.contact;
  const set = (k: "name" | "email" | "phone" | "location") => (v: string) => commit((d) => ({ ...d, contact: { ...d.contact, [k]: v.trim() } }));
  const p = profile.data;
  const fromProfile = p
    ? {
        phone: c.phone || p.phone || "",
        location: c.location || [p.city, p.country].filter(Boolean).join(", "),
        links: c.links.length ? c.links : [p.linkedinUrl, p.githubUrl, p.portfolioUrl].filter((x): x is string => Boolean(x)).slice(0, 6),
      }
    : null;
  const canFill = fromProfile && (fromProfile.phone !== c.phone || fromProfile.location !== c.location || fromProfile.links !== c.links);
  return (
    <div id="rcontact" tabIndex={-1} className="flex flex-col gap-4 outline-none">
      <p className="text-sm text-body">Prints under your name. Changes here stay with this resume; your Profile is not changed.</p>
      {canFill ? (
        <Button size="sm" variant="secondary" className={cn(HIT, "self-start")} onClick={() => commit((d) => ({ ...d, contact: { ...d.contact, ...fromProfile } }))}>
          Fill the gaps from Profile
        </Button>
      ) : null}
      <Field label="Name" htmlFor="c-name">
        <CommitInput id="c-name" autoComplete="name" maxLength={120} value={c.name} onCommit={set("name")} />
      </Field>
      <Field label="Email" htmlFor="c-email">
        <CommitInput id="c-email" type="email" autoComplete="email" maxLength={200} value={c.email} onCommit={set("email")} />
      </Field>
      <Field label="Phone" htmlFor="c-phone">
        <CommitInput id="c-phone" type="tel" autoComplete="tel" maxLength={40} value={c.phone} onCommit={set("phone")} />
      </Field>
      <Field label="Location" htmlFor="c-location" hint="City and state, or city and country.">
        <CommitInput id="c-location" autoComplete="address-level2" maxLength={120} value={c.location} onCommit={set("location")} />
      </Field>
      <Field label="Links" htmlFor="c-links" hint="LinkedIn, GitHub, portfolio. One per line, up to six.">
        <CommitInput
          id="c-links"
          multiline
          value={c.links.join("\n")}
          onCommit={(v) => commit((d) => ({ ...d, contact: { ...d.contact, links: v.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 6).map((s) => s.slice(0, 300)) } }))}
        />
      </Field>
    </div>
  );
}

/* ---- Sections, entries and lines ---- */

function SectionBody({ section }: { section: ResumeSection }) {
  const entries = ENTRY_KINDS.has(section.kind);
  return (
    <div id={`rsec-${section.id}`} tabIndex={-1} className="flex flex-col gap-4 outline-none">
      {section.hidden ? <p className="text-sm text-faint">Hidden from the printed page. Show it again in Layout.</p> : null}
      {entries ? (
        <EntryList section={section} />
      ) : (
        <>
          {(section.entries.length ? section.entries : [null]).map((e, i) => (
            <Lines key={e?.id ?? i} section={section} entry={e} />
          ))}
          {section.kind === "summary" ? (
            <AskBlock label="Write from my facts" req={{ scope: "summary", sectionId: section.id }} show={(s) => s.sectionId === section.id} />
          ) : section.kind === "skills" ? (
            <AskBlock label="Suggest skills from my facts" req={{ scope: "skills", sectionId: section.id }} show={(s) => s.sectionId === section.id} />
          ) : null}
        </>
      )}
    </div>
  );
}

function EntryList({ section }: { section: ResumeSection }) {
  const { commit } = useWs();
  const [adding, setAdding] = useState(false);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" className={HIT} onClick={() => setAdding(true)} disabled={adding}>
          <Plus size={16} weight="light" aria-hidden />
          Add entry
        </Button>
        {section.entries.length > 1 ? (
          <Button size="sm" variant="ghost" className={HIT} onClick={() => commit((d) => editSection(d, section.id, (s) => ({ ...s, entries: sortNewestFirst(s.entries) })))}>
            <SortDescending size={16} weight="light" aria-hidden />
            Sort newest first
          </Button>
        ) : null}
      </div>
      {adding ? (
        <EntryForm
          kind={section.kind}
          onCancel={() => setAdding(false)}
          onSave={(patch) => {
            commit((d) => editSection(d, section.id, (s) => ({ ...s, entries: [...s.entries, blankEntry(patch)] })));
            setAdding(false);
          }}
        />
      ) : null}
      {section.entries.length ? (
        <ol className="flex flex-col gap-3">
          {section.entries.map((e, i) => (
            <EntryCard key={e.id} section={section} entry={e} index={i} />
          ))}
        </ol>
      ) : adding ? null : (
        <p className="text-sm text-body">Nothing here yet. Add an entry, then lines that cite your facts.</p>
      )}
    </>
  );
}

const ENTRY_LABELS: Record<string, [string, string, string]> = {
  experience: ["Title", "Company", "2023 to 2026"],
  projects: ["Project", "Organization or link", "2024"],
  education: ["Degree", "School", "2019 to 2023"],
  certifications: ["Certificate", "Issuer", "2025"],
};

function EntryForm({ kind, initial, onSave, onCancel }: { kind: ResumeSection["kind"]; initial?: ResumeEntry; onSave: (p: Partial<ResumeEntry>) => void; onCancel: () => void }) {
  const { factList } = useWs();
  const id = useId();
  const [title, sub, datesHint] = ENTRY_LABELS[kind] ?? ["Heading", "Subheading", "2025"];
  const [heading, setHeading] = useState(initial?.heading ?? "");
  const [subheading, setSub] = useState(initial?.subheading ?? "");
  const [meta, setMeta] = useState(initial?.meta ?? "");
  const [factId, setFactId] = useState(initial?.headingFactId ?? "");
  const options = factList.filter((f) => f.confirmed && f.kind !== "skill" && f.kind !== "metric");
  return (
    <form
      className="flex flex-col gap-3 rounded-card border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!heading.trim()) return;
        onSave({ heading: heading.trim(), subheading: subheading.trim() || null, meta: meta.trim() || null, headingFactId: factId || null });
      }}
    >
      <Field label={title} htmlFor={`${id}-h`}>
        <Input id={`${id}-h`} required maxLength={200} value={heading} onChange={(e) => setHeading(e.target.value)} autoFocus />
      </Field>
      <Field label={sub} htmlFor={`${id}-s`}>
        <Input id={`${id}-s`} maxLength={200} value={subheading} onChange={(e) => setSub(e.target.value)} />
      </Field>
      <Field label="Dates" htmlFor={`${id}-m`} hint={`As it should print, for example “${datesHint}”.`}>
        <Input id={`${id}-m`} maxLength={120} value={meta} onChange={(e) => setMeta(e.target.value)} />
      </Field>
      <Field label="Fact it rests on" htmlFor={`${id}-f`} hint="The confirmed fact that names this role, project or degree.">
        <Select id={`${id}-f`} value={factId} onChange={(e) => setFactId(e.target.value)}>
          <option value="">None yet</option>
          {options.map((f) => (
            <option key={f.id} value={f.id}>
              {f.text}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex gap-2">
        <Button size="sm" type="submit" className={HIT} disabled={!heading.trim()}>
          {initial ? "Save entry" : "Add entry"}
        </Button>
        <Button size="sm" variant="ghost" type="button" className={HIT} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function EntryCard({ section, entry, index }: { section: ResumeSection; entry: ResumeEntry; index: number }) {
  const ws = useWs();
  const [editing, setEditing] = useState(false);
  const count = section.entries.length;
  const name = entry.heading || "Untitled entry";
  const locked = ws.locked.has(entry.id); // PUT 422 names an entry when its heading cites an unconfirmed fact
  // Tailoring: how many of the posting's requirements this entry's facts cover.
  const entryFacts = new Set([...entry.lines.flatMap((l) => l.factIds), ...(entry.headingFactId ? [entry.headingFactId] : [])]);
  const reqs = ws.fit?.requirements ?? [];
  const covers = reqs.filter((r) => r.status === "covered" && r.factIds.some((f) => entryFacts.has(f))).length;
  return (
    <li
      id={`rentry-${entry.id}`}
      tabIndex={-1}
      aria-describedby={locked ? `rentry-${entry.id}-problem` : undefined}
      className={cn("flex flex-col gap-3 rounded-card border border-line p-3 outline-none focus-visible:outline-2 focus-visible:outline-ink", entry.hidden && "bg-sunk", locked && "border-bad/50")}
    >
      {editing ? (
        <EntryForm
          kind={section.kind}
          initial={entry}
          onCancel={() => setEditing(false)}
          onSave={(patch) => {
            ws.commit((d) => editEntry(d, section.id, entry.id, (e) => ({ ...e, ...patch })));
            setEditing(false);
          }}
        />
      ) : (
        <div className="flex items-start gap-2 pl-1">
          <div className="min-w-0 flex-1 pt-1">
            <h4 className="text-[15px] font-medium text-ink">{name}</h4>
            <p className="text-sm text-body">{[entry.subheading, entry.meta].filter(Boolean).join(" · ") || "No company or dates yet"}</p>
            {entry.hidden || entry.headingFactId || (ws.mode === "tailor" && reqs.length) ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {entry.hidden ? <Tag>Hidden</Tag> : null}
                {ws.mode === "tailor" && reqs.length ? <Tag tone="ink">Covers {covers} of {reqs.length} requirements</Tag> : null}
                {entry.headingFactId ? <FactChips ids={[entry.headingFactId]} /> : null}
              </div>
            ) : null}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={`Actions for ${name}`} className={iconButton}>
              <DotsThree size={22} weight="light" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-card p-2">
              <DropdownMenuItem className={menuItem} onClick={() => setEditing(true)}>
                <PencilSimpleLine size={18} weight="light" aria-hidden />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className={menuItem} onClick={() => ws.commit((d) => editEntry(d, section.id, entry.id, (e) => ({ ...e, hidden: !e.hidden })))}>
                {entry.hidden ? <Eye size={18} weight="light" aria-hidden /> : <EyeSlash size={18} weight="light" aria-hidden />}
                {entry.hidden ? "Show" : "Hide"}
              </DropdownMenuItem>
              <DropdownMenuItem className={menuItem} disabled={index === 0} onClick={() => ws.commit((d) => moveEntry(d, section.id, entry.id, -1))}>
                <ArrowUp size={18} weight="light" aria-hidden />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem className={menuItem} disabled={index === count - 1} onClick={() => ws.commit((d) => moveEntry(d, section.id, entry.id, 1))}>
                <ArrowDown size={18} weight="light" aria-hidden />
                Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={cn(menuItem, "text-bad")} onClick={() => ws.commit((d) => editSection(d, section.id, (s) => ({ ...s, entries: s.entries.filter((e) => e.id !== entry.id) })))}>
                <Trash size={18} weight="light" aria-hidden />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {locked ? (
        <p id={`rentry-${entry.id}-problem`} className="pl-1 text-sm text-bad">
          The truth lock stopped this heading: the fact it rests on is not confirmed. Confirm it on Profile, or edit the entry and pick a confirmed fact.
        </p>
      ) : null}
      <Lines section={section} entry={entry} />
      <AskBlock label="AI suggestions" req={{ scope: "entry", sectionId: section.id, entryId: entry.id }} show={(s) => s.entryId === entry.id} />
    </li>
  );
}

/** The lines of one entry (or of summary, skills and custom sections) with "+ Line". */
function Lines({ section, entry }: { section: ResumeSection; entry: ResumeEntry | null }) {
  const { commit } = useWs();
  const [adding, setAdding] = useState(false);
  const lines = entry?.lines ?? [];
  const noun = section.kind === "skills" ? "Skill" : "Line";
  const prefer = [...new Set([...lines.flatMap((l) => l.factIds), ...(entry?.headingFactId ? [entry.headingFactId] : [])])];
  return (
    <div className="flex flex-col gap-2">
      {lines.length ? (
        <ul aria-label={`${entry?.heading || section.title} lines`} className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <LineCard key={l.id} section={section} entry={entry!} line={l} index={i} count={lines.length} />
          ))}
        </ul>
      ) : null}
      {adding ? (
        <LineForm
          noun={noun}
          prefer={prefer}
          onCancel={() => setAdding(false)}
          onSubmit={(text, factIds) => {
            commit((d) => addLine(d, section.id, entry?.id ?? null, text, factIds));
            setAdding(false);
          }}
        />
      ) : (
        <Button size="sm" variant="ghost" className={cn(HIT, "-ml-2 self-start")} onClick={() => setAdding(true)}>
          <Plus size={16} weight="light" aria-hidden />
          {noun}
        </Button>
      )}
    </div>
  );
}

function LineCard({ section, entry, line, index, count }: { section: ResumeSection; entry: ResumeEntry; line: ResumeLine; index: number; count: number }) {
  const ws = useWs();
  const [editing, setEditing] = useState(false);
  const locked = ws.locked.has(line.id);
  const lit = ws.highlight.has(line.id);
  const short = line.text.length > 40 ? `${line.text.slice(0, 40)}…` : line.text;
  const problem = `rline-${line.id}-problem`;
  return (
    <li
      id={`rline-${line.id}`}
      tabIndex={-1}
      aria-describedby={locked ? problem : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-input bg-sunk/70 py-2 pr-1 pl-3 outline-none transition-colors duration-300 ease-out focus-visible:outline-2 focus-visible:outline-ink",
        lit && "bg-sunk shadow-[inset_0_0_0_1.5px_var(--ink)]",
        locked && "bg-sunk shadow-[inset_0_0_0_1.5px_var(--bad)]",
      )}
    >
      {editing ? (
        <div className="pr-2 pb-1">
          <LineForm
            noun={section.kind === "skills" ? "Skill" : "Line"}
            initial={line}
            prefer={line.factIds}
            onCancel={() => setEditing(false)}
            onSubmit={(text, factIds) => {
              ws.commit((d) => setLine(d, section.id, entry.id, line.id, { text, factIds }));
              setEditing(false);
            }}
          />
        </div>
      ) : (
        <>
          <div className="flex items-start gap-1">
            <p className="min-w-0 flex-1 pt-1.5 text-[15px] leading-relaxed text-ink">{line.text}</p>
            <DropdownMenu>
              <DropdownMenuTrigger aria-label={`Actions for line: ${short}`} className={iconButton}>
                <DotsThree size={22} weight="light" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-card p-2">
                {section.kind === "skills" ? null : (
                  <DropdownMenuItem className={menuItem} onClick={() => ws.rewrite(line.id)}>
                    <MagicWand size={18} weight="light" aria-hidden />
                    Rewrite with AI
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className={menuItem} onClick={() => setEditing(true)}>
                  <PencilSimpleLine size={18} weight="light" aria-hidden />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItem} disabled={index === 0} onClick={() => ws.commit((d) => moveLine(d, section.id, entry.id, line.id, -1))}>
                  <ArrowUp size={18} weight="light" aria-hidden />
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItem} disabled={index === count - 1} onClick={() => ws.commit((d) => moveLine(d, section.id, entry.id, line.id, 1))}>
                  <ArrowDown size={18} weight="light" aria-hidden />
                  Move down
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className={cn(menuItem, "text-bad")} onClick={() => ws.commit((d) => removeLine(d, section.id, entry.id, line.id))}>
                  <Trash size={18} weight="light" aria-hidden />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <FactChips ids={line.factIds} className="pr-2 pb-1" />
          {locked ? (
            <p id={problem} className="pr-2 pb-1 text-sm text-bad">
              The truth lock stopped this line: it needs a confirmed fact. Edit it and pick one.
            </p>
          ) : null}
        </>
      )}
    </li>
  );
}

/** You write the line and pick the facts it cites. No fact, no save. */
function LineForm({ noun, initial, prefer, onSubmit, onCancel }: { noun: string; initial?: ResumeLine; prefer: string[]; onSubmit: (text: string, factIds: string[]) => void; onCancel: () => void }) {
  const id = useId();
  const [text, setText] = useState(initial?.text ?? "");
  const [ids, setIds] = useState<string[]>(initial?.factIds ?? []);
  const ready = text.trim() && ids.length;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit(text.trim(), ids);
      }}
    >
      <Field label={noun} htmlFor={`${id}-t`}>
        <Textarea id={`${id}-t`} rows={2} maxLength={400} value={text} onChange={(e) => setText(e.target.value)} className="min-h-16 field-sizing-content" autoFocus />
      </Field>
      <FactPicker selected={ids} onChange={setIds} prefer={prefer} />
      {!ids.length ? <p className="text-sm text-body">Pick at least one confirmed fact. A line without one cannot be saved.</p> : null}
      <div className="flex gap-2">
        <Button size="sm" type="submit" className={HIT} disabled={!ready}>
          {initial ? `Save ${noun.toLowerCase()}` : `Add ${noun.toLowerCase()}`}
        </Button>
        <Button size="sm" type="button" variant="ghost" className={HIT} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function FactPicker({ selected, onChange, prefer }: { selected: string[]; onChange: (ids: string[]) => void; prefer: string[] }) {
  const { factList, facts } = useWs();
  const id = useId();
  const [q, setQ] = useState("");
  if (!facts)
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  if (!factList.length)
    return (
      <p className="text-sm text-body">
        No facts to cite yet.{" "}
        <Link href="/profile" className="font-medium text-ink underline underline-offset-3 hover:no-underline">
          Add facts on Profile
        </Link>
      </p>
    );
  const sorted = [...factList].sort((a, b) => Number(prefer.includes(b.id)) - Number(prefer.includes(a.id)));
  const shown = q ? sorted.filter((f) => f.text.toLowerCase().includes(q.toLowerCase())) : sorted;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 text-sm font-medium text-ink">Facts it cites</legend>
      {factList.length > 6 ? <Input aria-label="Filter facts" placeholder="Filter facts" value={q} onChange={(e) => setQ(e.target.value)} /> : null}
      <ul className="relative flex max-h-60 flex-col overflow-y-auto rounded-input border border-line">
        {shown.map((f) => (
          <li key={f.id} className="flex items-center gap-2 border-b border-line px-3 last:border-b-0">
            <input
              type="checkbox"
              id={`${id}-${f.id}`}
              checked={selected.includes(f.id)}
              disabled={!f.confirmed}
              onChange={(e) => onChange(e.target.checked ? [...selected, f.id] : selected.filter((x) => x !== f.id))}
              className="size-4 shrink-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <label htmlFor={`${id}-${f.id}`} className={cn("min-h-11 flex-1 cursor-pointer py-2.5 text-sm", f.confirmed ? "text-ink" : "text-body")}>
              {f.text}
              {f.confirmed ? null : <span className="text-faint"> · unconfirmed</span>}
            </label>
            {f.confirmed ? null : <ConfirmFacts ids={[f.id]} label="Confirm" />}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** "Write from my facts", "Suggest skills" and an entry's "AI suggestions": the answers show here and in AI review. */
function AskBlock({ label, req, show }: { label: string; req: Omit<SuggestionRequest, "jobId">; show: (s: { sectionId: string; entryId: string | null }) => boolean }) {
  const ws = useWs();
  const [state, setState] = useState<{ pending: boolean; error: unknown; mine: string[] | null }>({ pending: false, error: null, mine: null });
  const run = async () => {
    setState((s) => ({ ...s, pending: true, error: null }));
    try {
      const r = await ws.ask(req);
      setState({ pending: false, error: null, mine: r.suggestions.filter(show).map((s) => s.id) });
    } catch (error) {
      setState((s) => ({ ...s, pending: false, error }));
    }
  };
  const list = state.mine ? ws.pending.filter((s) => state.mine!.includes(s.id)) : [];
  return (
    <div className="flex flex-col gap-3">
      <Button size="sm" variant="secondary" className={cn(HIT, "self-start")} onClick={run} disabled={state.pending || !ws.factList.length}>
        <MagicWand size={16} weight="light" aria-hidden />
        {state.pending ? "Writing from your facts…" : label}
      </Button>
      {state.pending ? <SuggestionSkeletons n={2} /> : null}
      {state.error ? <InlineError error={state.error} onRetry={run} /> : null}
      {state.mine && !state.pending && !list.length && !state.error ? (
        <p role="status" className="text-sm text-body">
          No changes to suggest from your facts. More confirmed facts give Kairos more to work with.
        </p>
      ) : null}
      {list.map((s) => (
        <SuggestionCard key={s.id} s={s} />
      ))}
    </div>
  );
}

function AddSection() {
  const { doc, commit, setOpenItems, openItems } = useWs();
  const [title, setTitle] = useState<string | null>(null);
  const full = doc.sections.length >= MAX_SECTIONS;
  if (title === null)
    return (
      <div className="px-4 pt-4">
        <Button size="sm" variant="ghost" className={cn(HIT, "-ml-2")} disabled={full} onClick={() => setTitle("")}>
          <Plus size={16} weight="light" aria-hidden />
          {full ? "Twelve sections is the most a resume holds" : "Add section"}
        </Button>
      </div>
    );
  return (
    <form
      className="flex flex-col gap-3 px-4 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        const t = title.trim();
        if (!t) return;
        const id = newId();
        commit((d) => ({ ...d, sections: [...d.sections, { id, kind: "custom", title: t.slice(0, 60), hidden: false, entries: [] }] }));
        setOpenItems([...openItems, id]);
        setTitle(null);
      }}
    >
      <Field label="Section name" htmlFor="new-section" hint="Lines only, for example Volunteering or Languages.">
        <Input id="new-section" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Field>
      <div className="flex gap-2">
        <Button size="sm" type="submit" className={HIT} disabled={!title.trim()}>
          Add section
        </Button>
        <Button size="sm" type="button" variant="ghost" className={HIT} onClick={() => setTitle(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ---- Layout: order, names, visibility and density. One template (D4), so no template choice. ---- */

function LayoutTab() {
  const { doc, commit } = useWs();
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="layout-order" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 id="layout-order" className="text-[15px] font-medium text-ink">
            Sections
          </h3>
          <p className="text-sm text-body">Your name and contact always print first. Rename, reorder or hide the rest.</p>
        </div>
        <ol className="flex flex-col">
          {doc.sections.map((s, i) => (
            <li key={s.id} className="flex items-center gap-1 border-t border-line py-2">
              <CommitInput
                aria-label={`Name of section ${i + 1}`}
                maxLength={60}
                value={s.title}
                onCommit={(v) => (v.trim() ? commit((d) => editSection(d, s.id, (x) => ({ ...x, title: v.trim() }))) : undefined)}
                className={cn("min-w-0 flex-1", s.hidden && "text-faint")}
              />
              <IconButton label={`Move ${s.title} up`} disabled={i === 0} onClick={() => commit((d) => moveSection(d, s.id, -1))}>
                <ArrowUp size={18} weight="light" />
              </IconButton>
              <IconButton label={`Move ${s.title} down`} disabled={i === doc.sections.length - 1} onClick={() => commit((d) => moveSection(d, s.id, 1))}>
                <ArrowDown size={18} weight="light" />
              </IconButton>
              <IconButton
                label={s.hidden ? `Show ${s.title}` : `Hide ${s.title}`}
                aria-pressed={s.hidden}
                onClick={() => commit((d) => editSection(d, s.id, (x) => ({ ...x, hidden: !x.hidden })))}
              >
                {s.hidden ? <EyeSlash size={18} weight="light" /> : <Eye size={18} weight="light" />}
              </IconButton>
              {s.kind === "custom" ? (
                <IconButton label={`Remove ${s.title}`} onClick={() => commit((d) => ({ ...d, sections: d.sections.filter((x) => x.id !== s.id) }))}>
                  <Trash size={18} weight="light" />
                </IconButton>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-[15px] font-medium text-ink">Density</legend>
        {(
          [
            ["comfortable", "Comfortable", "10.5 pt type on 1.3 leading"],
            ["compact", "Compact", "10 pt type on 1.25 leading, for a full page"],
          ] as const
        ).map(([v, label, hint]) => (
          <label key={v} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-input px-2 transition-colors duration-300 ease-out hover:bg-sunk/60">
            <input type="radio" name="density" value={v} checked={doc.density === v} onChange={() => commit((d) => ({ ...d, density: v }))} className="size-4" />
            <span className="flex flex-col">
              <span className="text-[15px] text-ink">{label}</span>
              <span className="text-sm text-faint">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
