import { PLANS, type Plan } from "@auto-career/shared";
import { formatCredits } from "@/lib/landing/format";
import { gateFeature, pricingCopy } from "./pricing-copy";

const c = pricingCopy.compare;
type Cell = { text: string; off?: boolean };
const yesNo = (on: boolean): Cell => (on ? { text: c.yes } : { text: c.no, off: true });

// Every value is read from plans.ts. Reply tracking and the extension come with Free and every plan includes Free.
const rows: { label: string; value: (p: Plan) => Cell }[] = [
  {
    label: "Submitted applications",
    // The subline states the 30-day cycle, so cells stay short enough for four columns on a phone.
    value: (p) => {
      const n = formatCredits(p.applicationsPerCycle);
      return { text: p.id === "free" ? c.once.replace("{n}", n) : n };
    },
  },
  { label: "Resume profiles", value: (p) => ({ text: String(p.resumeProfiles) }) },
  { label: gateFeature("Chrome extension apply"), value: () => yesNo(true) },
  { label: gateFeature("Reply tracking"), value: () => yesNo(true) },
  { label: "Tailored cover letters", value: (p) => yesNo(p.coverLetters) },
  { label: "Answer memory", value: (p) => yesNo(p.answerMemory) },
  { label: gateFeature("Cloud applier"), value: (p) => yesNo(p.cloudApplier) },
  { label: "Weekly outcome report", value: (p) => yesNo(p.outcomeReport) },
  {
    label: c.polling.label,
    value: (p) => ({ text: p.priorityPolling ? c.polling.priority : c.polling.standard }),
  },
];

/**
 * Calm comparison table on one glass sheet: hairline rows, plan names across the top from 768. Below 768 each row stacks into its label
 * and a 2 by 2 grid of plan cells, each cell naming its plan (data-label). Explicit roles keep the table semantics
 * when the rows switch to display: grid. "No" is a word in Deep Ash, never colour alone.
 */
export function PlanComparison() {
  return (
    <div className="pr-sheet glass-panel">
    <table className="pr-table" role="table">
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader" scope="col">
            <span className="lp-sr-only">{c.feature}</span>
          </th>
          {PLANS.map((p) => (
            <th key={p.id} role="columnheader" scope="col">
              {p.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((row) => (
          <tr key={row.label} role="row">
            <th role="rowheader" scope="row">
              {row.label}
            </th>
            {PLANS.map((p) => {
              const cell = row.value(p);
              return (
                <td key={p.id} role="cell" data-label={p.name} data-off={cell.off || undefined}>
                  {cell.text}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
