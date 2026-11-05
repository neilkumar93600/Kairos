import Link from "next/link";
import type { CSSProperties } from "react";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs/breadcrumbs";
import { InlineCta } from "@/components/marketing/cta/cta";
import { PageHero } from "@/components/marketing/page-hero";
import { marketingCopy } from "@/content/marketing-copy";
import { siteConfig } from "@/lib/site";
import { formatDate } from "@/lib/utils";
import "./legal.css";

/** A paragraph, a bullet list or a table. Text may hold `[label](href)` links and `**bold**`. */
export type LegalBlock = string | { list: string[] } | { table: { caption: string; head: string[]; rows: string[][] } };

export interface LegalSection {
  heading: string;
  body: LegalBlock[];
}

const slug = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The section's timeline name, read by legal.css for the current-section marker. */
const timeline = (i: number) => ({ "--lg-tl": `--lg-${i + 1}` }) as CSSProperties;

// ponytail: [label](href) and **bold** are all the markup legal text needs; the content is ours, never user input.
function Text({ children }: { children: string }) {
  return children.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/).map((part, i) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <Link key={i} href={link[2]!}>
          {link[1]}
        </Link>
      );
    }
    return part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part;
  });
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return (
      <p>
        <Text>{block}</Text>
      </p>
    );
  }
  if ("list" in block) {
    return (
      <ul>
        {block.list.map((item) => (
          <li key={item}>
            <Text>{item}</Text>
          </li>
        ))}
      </ul>
    );
  }
  const { caption, head, rows } = block.table;
  return (
    <table>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([first, ...rest]) => (
          <tr key={first}>
            <th scope="row">
              <Text>{first!}</Text>
            </th>
            {rest.map((cell, i) => (
              <td key={head[i + 1]} data-label={head[i + 1]}>
                <Text>{cell}</Text>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Toc({ sections }: { sections: LegalSection[] }) {
  return (
    <ol>
      {sections.map((s, i) => (
        <li key={s.heading} style={timeline(i)}>
          <a href={`#${slug(s.heading)}`}>{s.heading}</a>
        </li>
      ))}
    </ol>
  );
}

/** The footer's Legal column is the one list of legal pages, so the switch cannot drift from it. */
const legalPages = siteConfig.footer.find((group) => group.title === "Legal")?.links ?? [];

/** Shared reading layout for legal pages (owner reference, 2026-11-05): a centred hero, then a sticky contents list beside
 *  the long text. `path` marks this page in the Terms, Privacy, Cookies switch. The draft note stays until counsel signs
 *  off (README D11). */
export function LegalDocument({ path, title, updated, intro, sections }: { path: string; title: string; updated: string; intro: string; sections: LegalSection[] }) {
  const scope = { "--lg-scope": sections.map((_, i) => `--lg-${i + 1}`).join(", ") } as CSSProperties;
  return (
    <article className="legal">
      <PageHero
        className="legal-hero"
        titleId="legal-title"
        crumbs={<Breadcrumbs items={[{ label: marketingCopy.breadcrumbs.home, href: "/" }, { label: title }]} />}
        title={title}
        lead={intro}
        art={{ src: "/landing/art/footer-dusk-hills-2880x840.png", alt: "", position: "50% 62%" }}
      />
      <div className="legal__grid" style={scope}>
        <div className="legal__side">
          <nav className="legal__switch" aria-label="Legal pages">
            {legalPages.map((page) => (
              <Link key={page.href} href={page.href} aria-current={page.href === path ? "page" : undefined}>
                {page.label}
              </Link>
            ))}
          </nav>
          <details className="legal__toc legal__toc-m glass-panel">
            <summary>On this page</summary>
            <nav aria-label={`${title} sections`}>
              <Toc sections={sections} />
            </nav>
          </details>
          <nav className="legal__toc legal__toc-d" aria-label={`${title} contents`}>
            <p className="legal__toc-label">On this page</p>
            <Toc sections={sections} />
          </nav>
        </div>
        <div className="legal__doc">
          <div className="legal__note">
            <p className="legal__meta">Last updated {formatDate(updated)}</p>
            <p className="legal__draft">
              <span className="lp-square-open" aria-hidden="true" />
              Draft for legal review. It describes what Kairos does today; counsel has not signed it off.
            </p>
          </div>
          {sections.map((s, i) => (
            <section key={s.heading} id={slug(s.heading)} style={timeline(i)}>
              <h2>{s.heading}</h2>
              {s.body.map((block, b) => (
                <Block key={b} block={block} />
              ))}
            </section>
          ))}
          <p className="legal__ask">
            <InlineCta {...marketingCopy.cta.legalContact} />
          </p>
        </div>
      </div>
    </article>
  );
}
