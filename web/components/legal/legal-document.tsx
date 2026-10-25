import { formatDate } from "@/lib/utils";
import "./legal.css";

export interface LegalSection {
  heading: string;
  body: string[];
}

const slug = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function Toc({ sections }: { sections: LegalSection[] }) {
  return (
    <ol>
      {sections.map((s) => (
        <li key={s.heading}>
          <a href={`#${slug(s.heading)}`}>{s.heading}</a>
        </li>
      ))}
    </ol>
  );
}

/** Shared reading layout for legal pages: the title on the site haze, the sections on one glass reading sheet.
 *  Content is a working draft until reviewed by counsel. */
export function LegalDocument({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <article className="legal">
      <div className="legal__grid">
        <header className="legal__head">
          <h1 className="legal__title">{title}</h1>
          <p className="legal__meta">Last updated {formatDate(updated)}</p>
          <p className="legal__intro">{intro}</p>
        </header>
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
        <div className="legal__doc glass-panel">
          {sections.map((s) => (
            <section key={s.heading} id={slug(s.heading)}>
              <h2>{s.heading}</h2>
              {s.body.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
