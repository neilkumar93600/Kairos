import Image from "next/image";
import type { ReactNode } from "react";
import { FloatingCard } from "@/components/landing/floating-card";
import { CitationChip } from "@/components/landing/marks/chip";
import "./how-it-works.css";

/*
 * The /how-it-works chapters: the primary journey of docs/03-app-flow.md told as five steps, one sample posting
 * (0915, Company 014, from content/fit-sample.json) followed through all of them. Every claim is sourced from
 * docs/01-prd.md, docs/03-app-flow.md or content/landing-copy.ts; G3 features keep "(in beta)" as on the landing.
 */

type Tone = "pass" | "open" | "muted" | "ink";

/** The word carries the state; the lime dot (pass) or hollow square (open) only supports it. "ink" has no mark. */
function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={tone === "muted" ? "hiw-status hiw-status--muted" : "hiw-status"}>
      {tone === "pass" ? <span className="lp-dot" aria-hidden="true" /> : null}
      {tone === "open" ? <span className="lp-square-open" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function Rows({ rows }: { rows: { top: ReactNode; sub?: ReactNode }[] }) {
  return (
    <ul className="hiw-rows" role="list">
      {rows.map((r, i) => (
        <li key={i}>
          <p className="hiw-row__top">{r.top}</p>
          {r.sub ? <p className="hiw-row__sub">{r.sub}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function Pairs({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="hiw-dl">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Hero card: the sample posting as it arrives, before step 1. */
export function PostingCard() {
  return (
    <FloatingCard float lift>
      <p className="hiw-card__title">New posting · 0915</p>
      <p className="hiw-card__meta">Software Engineer, Platform · Company 014</p>
      <p className="hiw-status-line">
        <Status tone="open">Next: the fit gate</Status>
      </p>
    </FloatingCard>
  );
}

interface Chapter {
  id: string;
  label: string;
  title: string;
  body: string;
  facts: [string, string][];
  art: { src: string; alt: string; position: string };
  card: ReactNode;
}

const CHAPTERS: Chapter[] = [
  {
    id: "fit-gate",
    label: "Fit gate",
    title: "Hard rules run before any model.",
    body: "A posting that breaks one of your rules is skipped, and the skip names the rule it broke.",
    facts: [
      ["Your rules", "Roles, seniority, locations, work authorization, salary floor, and the companies or words you exclude."],
      ["Company cap", "At most 2 applications to one company in 30 days, unless you change it."],
      ["Then a score", "A model scores what passes, with written reasons. Only scores above your fit bar reach Matches."],
    ],
    art: {
      src: "/landing/art/step-1-fit-gate.png",
      alt: "A garden gate on the path. Two letters pass through; the rest settle in the grass.",
      position: "50% 75%",
    },
    card: (
      <>
        <p className="hiw-card__title">Fit gate · 3 new postings</p>
        <Rows
          rows={[
            { top: <><Status tone="muted">Skipped</Status><span>· 0414</span></>, sub: "Title is more senior than you asked for" },
            { top: <><Status tone="muted">Skipped</Status><span>· 0352</span></>, sub: "Title does not match your roles" },
            { top: <><Status tone="pass">Passes</Status><span>· 0915</span></>, sub: "Fit 82 · Company 014" },
          ]}
        />
      </>
    ),
  },
  {
    id: "truth-lock",
    label: "Truth lock",
    title: "Every tailored line cites a confirmed fact.",
    body: "Kairos splits your resume into facts you confirm or remove. A line that cites none is not saved.",
    facts: [
      ["Citations", "Each line shows the fact numbers it rests on, so you can check it against your profile."],
      ["Refused lines", "If a line cites a fact you do not own, nothing is stored and the editor lists the line."],
    ],
    art: {
      src: "/landing/art/step-2-truth-lock.png",
      alt: "A resume page on a writing table, tied by threads to pinned notes, while one loose slip blows away.",
      position: "50% 70%",
    },
    card: (
      <>
        <p className="hiw-card__title">Resume · tailored for 0915</p>
        <Rows
          rows={[
            {
              top: (
                <>
                  Built the retry queue for failed invoice emails{" "}
                  <CitationChip label="Cites fact number 3">cites #03</CitationChip>
                </>
              ),
            },
            {
              top: (
                <>
                  Wrote the onboarding guide for new backend hires{" "}
                  <CitationChip label="Cites facts number 5 and 9">cites #05, #09</CitationChip>
                </>
              ),
            },
            { top: <span className="hiw-refused">Led the payments migration</span>, sub: "Not saved · no confirmed fact" },
          ]}
        />
      </>
    ),
  },
  {
    id: "approve",
    label: "Your approval",
    title: "You read every draft before it goes.",
    body: "Each draft shows its resume changes, every answer and why the job matched.",
    facts: [
      ["Edits", "Change any field, resume line or cover letter. Edited resume lines pass the truth lock again."],
      ["Batches", "Approve one draft or many at once. Each approval needs one available credit."],
      ["Withdraw", "A draft or an approved application can be withdrawn until it is sent."],
    ],
    art: {
      src: "/landing/art/scene-b-footbridge.png",
      alt: "A sealed envelope waiting on a wooden footbridge over the river.",
      position: "50% 62%",
    },
    card: (
      <>
        <p className="hiw-card__title">Draft · 0915</p>
        <p className="hiw-card__meta">Software Engineer, Platform · Company 014</p>
        <Pairs
          rows={[
            ["Matched", "3 written reasons"],
            ["Resume", "3 lines changed · each cited"],
            ["Answers", "9 · read by you"],
          ]}
        />
        <p className="hiw-status-line">
          <Status tone="open">Waiting for your approval</Status>
        </p>
      </>
    ),
  },
  {
    id: "send",
    label: "Send and receipt",
    title: "The employer's own form, filled in your browser.",
    body: "The extension (in beta) fills it and keeps a receipt. Pro and Max can send from the cloud (in beta).",
    facts: [
      ["Review mode", "Want to press submit yourself? Review opens the filled form and stops there."],
      ["The receipt", "Every field, answer and resume version that was sent, kept on the application."],
      ["Failed submits", "A failed submit costs no credit, and its reason is shown on the application."],
    ],
    art: {
      src: "/landing/art/scene-c-noon-meadow.png",
      alt: "A small stack of receipts held down by a pebble on a stone in the meadow.",
      position: "50% 70%",
    },
    card: (
      <>
        <p className="hiw-card__title">Receipt · 0915</p>
        <Pairs
          rows={[
            ["Sent to", "Company 014 · Greenhouse form"],
            ["Fields", "18 filled · 0 left empty"],
            ["Resume", "Version tailored for 0915"],
            ["Credit", "−1 · on submit"],
          ]}
        />
        <p className="hiw-status-line">
          <Status tone="pass">Submitted</Status>
        </p>
      </>
    ),
  },
  {
    id: "replies",
    label: "Replies",
    title: "Replies come back without Gmail access.",
    body: "One forwarding filter sends replies to a private address. Each one is matched to the application it answers (in beta).",
    facts: [
      ["Your inbox", "Kairos never signs in to Gmail. The filter you set decides what is forwarded."],
      ["Tags", "Replies are tagged by what they say, such as an interview request or an offer."],
      ["No promises", "Kairos does not promise interviews. It shows you what came back."],
    ],
    art: {
      src: "/landing/art/step-4-replies.png",
      alt: "A post box at the end of the path with envelopes sorted in two piles.",
      position: "50% 70%",
    },
    card: (
      <>
        <p className="hiw-card__title">Replies</p>
        <p className="hiw-card__meta">From your forwarding address</p>
        <Rows
          rows={[
            { top: <><Status tone="ink">Interview request</Status><span>· 0915</span></>, sub: "Company 014" },
            { top: <><Status tone="muted">Reply</Status><span>· 0541</span></>, sub: "Company 003" },
            { top: <><Status tone="muted">Reply</Status><span>· 0127</span></>, sub: "Company 004" },
          ]}
        />
      </>
    ),
  },
];

/**
 * The five steps: a contents rail (sticky from 1024, lit by a CSS-only scroll spy in how-it-works.css) beside the
 * chapters. Each chapter: badge and label, H3, one line, its painting with one sample card, up to three facts.
 */
export function HowItWorksChapters() {
  return (
    <section aria-labelledby="hiw-steps-title" className="hiw-steps">
      <div className="lp-wrap lp-wrap--main hiw-steps__grid">
        <div className="hiw-rail glass-panel">
          <h2 id="hiw-steps-title" className="lp-micro hiw-rail__title">
            The five steps
          </h2>
          <nav aria-label="Steps on this page">
            <ol className="hiw-index" role="list">
              {CHAPTERS.map((c, i) => (
                <li key={c.id} className="hiw-index__item">
                  <a href={`#${c.id}`} className="hiw-index__link">
                    <span className="hiw-badge" aria-hidden="true">
                      {i + 1}
                      <span className="hiw-badge__on">{i + 1}</span>
                    </span>
                    <span>
                      <span className="lp-sr-only">Step {i + 1}: </span>
                      {c.label}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        <ol className="hiw-chapters" role="list">
          {CHAPTERS.map((c, i) => (
            <li key={c.id} id={c.id} data-step={i + 1} className="hiw-chapter">
              <div className="hiw-chapter__head">
                <p className="hiw-chapter__label">
                  <span className="hiw-badge" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="lp-micro">
                    <span className="lp-sr-only">Step {i + 1}: </span>
                    {c.label}
                  </span>
                </p>
                <h3 id={`${c.id}-title`} className="lp-h3">
                  {c.title}
                </h3>
                <p className="lp-body">{c.body}</p>
              </div>

              <div className="lp-panel lp-reveal">
                <div className="lp-panel__art lp-grain">
                  <Image
                    src={c.art.src}
                    alt={c.art.alt}
                    fill
                    sizes="(min-width: 1280px) 560px, (min-width: 1024px) 680px, 100vw"
                    style={{ objectPosition: c.art.position }}
                  />
                </div>
                <FloatingCard lift className="lp-panel__card">
                  {c.card}
                </FloatingCard>
              </div>

              <dl className="hiw-facts">
                {c.facts.map(([term, detail]) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{detail}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
