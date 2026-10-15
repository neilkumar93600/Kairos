import { Container } from "../shared/container";
import { formatDate } from "@/lib/utils";

export interface LegalSection {
  heading: string;
  body: string[];
}

/** Shared reading layout for legal pages. Content is a working draft until reviewed by counsel. */
export function LegalDocument({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <Container className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl tracking-tight">{title}</h1>
        <p className="text-sm text-body">Last updated {formatDate(updated)}</p>
        <p className="leading-relaxed text-body">{intro}</p>
      </header>
      {sections.map((s) => (
        <section key={s.heading} className="flex flex-col gap-3 border-t border-line pt-6">
          <h2 className="text-xl tracking-tight">{s.heading}</h2>
          {s.body.map((p) => (
            <p key={p.slice(0, 40)} className="leading-relaxed text-body">
              {p}
            </p>
          ))}
        </section>
      ))}
    </Container>
  );
}
