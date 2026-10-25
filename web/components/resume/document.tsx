"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { MagnifyingGlassMinus, MagnifyingGlassPlus } from "@phosphor-icons/react";
import type { Resume, ResumeEntry, ResumeLine, ResumeSection, ResumeSuggestion } from "@auto-career/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EmptyState } from "../shared/empty-state";
import { IconButton, tabList, tabTrigger } from "./bits";
import { PAGE_CONTENT_PX } from "./model";
import { SuggestionActions } from "./review";
import { useWs } from "./workspace";

/** Suggested edits shown in place: rewrites and removals by line, additions at the end of their entry or section. */
interface Redlines {
  byLine: Map<string, ResumeSuggestion>;
  adds: ResumeSuggestion[];
  actions: (s: ResumeSuggestion) => ReactNode;
}

/**
 * The one template (spec section 8). `print` uses real document headings (h1 to h3) for the PDF; the preview sits
 * inside the app page, so it starts at h3 under the centre pane's h2 and the page keeps one h1.
 */
export function ResumeDocument({ doc, print, highlight, redlines }: { doc: Resume; print?: boolean; highlight?: Set<string>; redlines?: Redlines }) {
  const H1 = print ? "h1" : "p";
  const H2 = print ? "h2" : "h3";
  const H3 = print ? "h3" : "h4";
  const contact = [doc.contact.email, doc.contact.phone, doc.contact.location, ...doc.contact.links].map((s) => s.trim()).filter(Boolean);
  const mark = (id: string) => (highlight?.has(id) ? { "data-highlight": "" } : {});

  function lineText(line: ResumeLine) {
    const s = redlines?.byLine.get(line.id);
    if (!s) return line.text;
    if (s.action === "remove")
      return (
        <>
          <del><span className="sr-only">Suggested removal: </span>{line.text}</del> {redlines!.actions(s)}
        </>
      );
    if (s.needsFact || !s.after)
      return (
        <>
          {line.text}
          <span className="rdoc-note">Needs a detail: {s.needsFact?.question ?? "a fact to cite"}</span> {redlines!.actions(s)}
        </>
      );
    return (
      <>
        <del><span className="sr-only">Current: </span>{line.text}</del> <ins><span className="sr-only">Suggested: </span>{s.after}</ins> {redlines!.actions(s)}
      </>
    );
  }

  // An addition lands where addLine puts it: its entry, else the section's first entry, else a new block at the end.
  const addsFor = (section: ResumeSection, entry: ResumeEntry | null) =>
    (redlines?.adds ?? []).filter(
      (s) => s.sectionId === section.id && ((section.entries.find((e) => e.id === s.entryId) ?? section.entries[0])?.id ?? null) === (entry?.id ?? null),
    );
  const addText = (s: ResumeSuggestion) =>
    s.needsFact || !s.after ? (
      <span className="rdoc-note">Needs a detail: {s.needsFact?.question ?? "a fact to cite"} {redlines!.actions(s)}</span>
    ) : (
      <>
        <ins><span className="sr-only">Suggested addition: </span>{s.after}</ins> {redlines!.actions(s)}
      </>
    );

  function body(section: ResumeSection) {
    const entries = section.entries.filter((e) => !e.hidden);
    if (section.kind === "skills") {
      const lines = entries.flatMap((e) => e.lines);
      const adds = section.entries.flatMap((e) => addsFor(section, e)).concat(addsFor(section, null));
      return (
        <p className="rdoc-para">
          {lines.map((l, i) => (
            <Fragment key={l.id}>
              {i ? ", " : null}
              <span data-line-id={l.id} {...mark(l.id)}>{lineText(l)}</span>
            </Fragment>
          ))}
          {adds.map((s) => (
            <Fragment key={s.id}>
              {lines.length ? ", " : null}
              {addText(s)}
            </Fragment>
          ))}
        </p>
      );
    }
    if (section.kind === "summary") {
      const adds = section.entries.flatMap((e) => addsFor(section, e)).concat(addsFor(section, null));
      return (
        <>
          {entries.flatMap((e) => e.lines).map((l) => (
            <p key={l.id} className="rdoc-para" data-line-id={l.id} {...mark(l.id)}>
              {lineText(l)}
            </p>
          ))}
          {adds.map((s) => (
            <p key={s.id} className="rdoc-para">{addText(s)}</p>
          ))}
        </>
      );
    }
    const loose = addsFor(section, null);
    return (
      <>
        {entries.map((e) => {
          const adds = addsFor(section, e);
          return (
            <div key={e.id} className="rdoc-entry">
              {e.heading || e.subheading || e.meta ? (
                <div className="rdoc-head">
                  <H3 className="rdoc-head-title">
                    {e.heading}
                    {e.subheading ? <span>{e.heading ? ", " : ""}{e.subheading}</span> : null}
                  </H3>
                  {e.meta ? <span className="rdoc-dates">{e.meta}</span> : null}
                </div>
              ) : null}
              {e.lines.length || adds.length ? (
                <ul>
                  {e.lines.map((l) => (
                    <li key={l.id} data-line-id={l.id} {...mark(l.id)}>
                      {lineText(l)}
                    </li>
                  ))}
                  {adds.map((s) => (
                    <li key={s.id}>{addText(s)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
        {loose.length ? (
          <ul>
            {loose.map((s) => (
              <li key={s.id}>{addText(s)}</li>
            ))}
          </ul>
        ) : null}
      </>
    );
  }

  return (
    <article className="rdoc" data-density={doc.density} aria-label={print ? undefined : `${doc.contact.name || "Your"} resume`}>
      <H1 className="rdoc-name">{doc.contact.name || "Your name"}</H1>
      {contact.length ? <p className="rdoc-contact">{contact.join("  ·  ")}</p> : null}
      {doc.sections
        .filter((s) => !s.hidden)
        .map((s) => (
          <section key={s.id} className="rdoc-section">
            <H2 className="rdoc-section-title">{s.title}</H2>
            {body(s)}
          </section>
        ))}
    </article>
  );
}

const PAGE_W = 816; // 8.5in at 96 px per inch
const ZOOMS = [75, 85, 100, 110, 125];

/**
 * Centre pane: Preview and Suggested edits on a Paper White US Letter page. 100 percent is the page at its printed
 * size, or the width of the pane when that is narrower; zoom runs 75 to 125 percent of that.
 */
export function DocumentPane({ pages }: { pages: number }) {
  const ws = useWs();
  const [zoom, setZoom] = useState(100);
  const [fit, setFit] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setFit(Math.min(1, Math.max(0.3, (e.contentRect.width - 2) / PAGE_W))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lines picked in Check or Job match scroll into view in the page.
  useEffect(() => {
    if (!ws.highlight.size) return;
    scroller.current?.querySelector("[data-highlight]")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [ws.highlight, ws.centreTab]);

  const pending = ws.pending;
  const redlines: Redlines = {
    byLine: new Map(pending.filter((s) => s.lineId && s.action !== "add").map((s) => [s.lineId!, s])),
    adds: pending.filter((s) => s.action === "add"),
    actions: (s) => <SuggestionActions s={s} inline />,
  };
  const i = ZOOMS.indexOf(zoom);

  const page = (redline: boolean) => (
    <div className="flex justify-center pb-6">
      <div
        className="relative bg-surface shadow-edge"
        style={{ zoom: fit * (zoom / 100), width: PAGE_W, minHeight: 11 * 96, padding: "0.6in" }}
      >
        <ResumeDocument doc={ws.doc} highlight={ws.highlight} redlines={redline ? redlines : undefined} />
        {Array.from({ length: Math.max(1, pages) }, (_, k) => (
          <div
            key={k}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 flex items-center gap-2 px-2 text-[11px] text-faint"
            style={{ top: `calc(0.6in + ${(k + 1) * PAGE_CONTENT_PX}px)` }}
          >
            <span className="h-px flex-1 border-t border-dashed border-rule" />
            {k + 1 < pages ? `Page ${k + 2} starts here` : "End of page 1"}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section aria-labelledby="doc-pane-title" className="flex min-h-0 min-w-0 flex-col">
      <h2 id="doc-pane-title" className="sr-only">
        Document
      </h2>
      <Tabs value={ws.centreTab} onValueChange={(v) => ws.setCentreTab(v as "preview" | "edits")} className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className={cn(tabList, "w-auto")}>
            <TabsTrigger value="preview" className={cn(tabTrigger, "px-4")}>
              Preview
            </TabsTrigger>
            <TabsTrigger value="edits" className={cn(tabTrigger, "px-4")}>
              Suggested edits
              {pending.length ? <span className="tabular-nums text-faint">{pending.length}</span> : null}
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1" role="group" aria-label="Zoom">
            <IconButton label="Zoom out" disabled={i <= 0} onClick={() => setZoom(ZOOMS[i - 1])}>
              <MagnifyingGlassMinus size={20} weight="light" />
            </IconButton>
            <output aria-live="polite" className="w-12 text-center text-sm text-ink tabular-nums">
              {zoom}%
            </output>
            <IconButton label="Zoom in" disabled={i >= ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[i + 1])}>
              <MagnifyingGlassPlus size={20} weight="light" />
            </IconButton>
            <span className="ml-2 text-sm text-faint tabular-nums">{pages > 1 ? `${pages} pages` : "1 page"}</span>
          </div>
        </div>
        <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto rounded-card">
          <TabsContent value="preview">{page(false)}</TabsContent>
          <TabsContent value="edits">
            {pending.length ? (
              <>
                <p className="pb-4 text-sm text-body">Removals are struck through, insertions underlined. Nothing changes until you accept.</p>
                {page(true)}
              </>
            ) : (
              <EmptyState
                title="No suggested edits"
                body="Run a review from the AI review tab, or ask for suggestions on a section. Each edit cites the facts it uses."
              />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}
