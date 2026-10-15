const steps = [
  { n: "01", title: "Confirm your facts", body: "Upload your resume. We split it into facts, and you confirm each one. Nothing you did not confirm is ever used." },
  { n: "02", title: "Set the fit bar", body: "Roles, seniority, locations, visa needs and a fit threshold. Jobs that miss a hard rule never cost a model call." },
  { n: "03", title: "Review every draft", body: "Each application shows its resume diff, every answer and why it matched. Edit anything, then approve one or a batch." },
  { n: "04", title: "Send from your browser", body: "The extension fills the employer's own form and saves a receipt. Pro and Max can also send with the laptop closed." },
];

/** Used on the landing page and the How it works page. */
export function HowItWorksSteps() {
  return (
    <ol className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
      {steps.map((s) => (
        <li key={s.n} className="flex gap-5 border-t border-rule/50 pt-6">
          <span className="tabular-nums text-sm text-body">{s.n}</span>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg tracking-[-0.02em]">{s.title}</h3>
            <p className="leading-relaxed text-body">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
