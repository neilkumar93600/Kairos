import { landingCopy } from "@/content/landing-copy";
import { SectionIntro } from "../section-intro";

const c = landingCopy.compare;

// Section styles stay here (cmp- prefix) so no global CSS file is touched.
const CSS = `
.lp .cmp { display: grid; gap: var(--gap-intro); }
.lp .cmp-table { width: 100%; border-collapse: collapse; margin-top: 0; }
.lp .cmp-table th, .lp .cmp-table td { text-align: start; font-weight: 400; }
.lp .cmp-head { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
.lp .cmp-row { display: grid; grid-template-columns: 1fr; gap: 8px; padding-block: 20px; border-top: 1px solid var(--hairline); }
.lp .cmp-sheet { border-radius: var(--r-media); padding: 4px 20px; }
.lp .cmp-row:first-child { border-top: 0; }
.lp .cmp-topic { font: 500 15px / 1.4 var(--font-ui); color: var(--ink); }
.lp .cmp-cell { font: 400 17px / 1.45 var(--font-ui); color: var(--faint); }
.lp .cmp-cell--k { color: var(--ink); }
.lp .cmp-cell::before { content: attr(data-label); display: block; font: 500 12px / 1.4 var(--font-ui); letter-spacing: 0.04em; text-transform: uppercase; color: var(--faint); margin-bottom: 2px; }
@media (min-width: 768px) {
  .lp .cmp-sheet { padding: 24px 32px 4px; }
  .lp .cmp-row:first-child { border-top: 1px solid var(--hairline); }
  .lp .cmp-head { position: static; width: auto; height: auto; overflow: visible; clip: auto; }
  .lp .cmp-head tr, .lp .cmp-row { display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; }
  .lp .cmp-head tr { padding-bottom: 12px; font: 500 14px / 1.4 var(--font-ui); color: var(--faint); }
  .lp .cmp-head th:last-child { color: var(--ink); }
  .lp .cmp-topic { grid-column: 1 / -1; }
  .lp .cmp-cell::before { display: none; }
}
@media (min-width: 1024px) {
  .lp .cmp { grid-template-columns: 320px 1fr; column-gap: 40px; align-items: start; }
}
`;

/** Entry 08 (A9, compare variant): H2 left, three rows right. No chips, no product names (08 1.8). */
export function Entry08Compare() {
  return (
    <section id="compare" aria-labelledby="compare-title" className="lp-section">
      <style>{CSS}</style>
      <div className="lp-wrap lp-wrap--narrow cmp">
        <SectionIntro titleId="compare-title" pill={c.pill} title={c.h2} align="start" />
        <div className="cmp-sheet glass-panel">
        <table className="cmp-table" role="table">
          <thead className="cmp-head" role="rowgroup">
            <tr role="row">
              {c.columns.map((h) => (
                <th key={h} role="columnheader" scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {c.rows.map((row) => (
              <tr key={row.topic} role="row" className="cmp-row">
                <th role="rowheader" scope="row" className="cmp-topic">{row.topic}</th>
                <td role="cell" className="cmp-cell" data-label={c.columns[0]}>{row.reported}</td>
                <td role="cell" className="cmp-cell cmp-cell--k" data-label={c.columns[1]}>{row.kairos}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  );
}
