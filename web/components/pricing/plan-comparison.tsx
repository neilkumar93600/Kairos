import { PLANS } from "@auto-career/shared";

const rows: { label: string; value: (p: (typeof PLANS)[number]) => string }[] = [
  { label: "Submitted applications", value: (p) => (p.id === "free" ? "25 once" : `${p.applicationsPerCycle.toLocaleString("en-US")} per 30 days`) },
  { label: "Resume profiles", value: (p) => String(p.resumeProfiles) },
  { label: "Chrome extension apply", value: () => "Yes" },
  { label: "Cloud applier (browser closed)", value: (p) => (p.cloudApplier ? "Yes" : "No") },
  { label: "Priority polling", value: (p) => (p.priorityPolling ? "Every 5 minutes" : "Every 30 minutes") },
  { label: "Cover letters", value: (p) => (p.coverLetters ? "Yes" : "No") },
  { label: "Answer memory", value: (p) => (p.answerMemory ? "Yes" : "No") },
  { label: "Weekly outcome report", value: (p) => (p.outcomeReport ? "Yes" : "No") },
];

export function PlanComparison() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="py-3 pr-6 text-body">Compare plans</th>
            {PLANS.map((p) => (
              <th key={p.id} className="py-3 pr-6">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line">
              <td className="py-3 pr-6 text-body">{row.label}</td>
              {PLANS.map((p) => (
                <td key={p.id} className="py-3 pr-6">
                  {row.value(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
