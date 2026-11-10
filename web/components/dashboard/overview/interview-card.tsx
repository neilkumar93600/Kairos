import type { Me } from "@/hooks/use-me";
import { Panel } from "../../shared/panel";

/**
 * The Interview goal on the Overview (spec call 7). Practice is not built yet, so the card says so and names what is
 * saved, in the Done step's words; it promises no date and no notice, since nothing sends one.
 */
export function InterviewCard({ me }: { me: Me }) {
  if (!me.goals.includes("interview")) return null;
  const [role] = me.targetRoles;
  const companies = me.targetCompanies;
  const at = companies.slice(0, 2).join(" or ") + (companies.length > 2 ? " and others" : "");
  return (
    <Panel title="Interview practice is coming">
      <p className="max-w-[65ch] text-base leading-relaxed text-pretty text-body">
        {role ? `Your target is saved: ${role}${at ? ` at ${at}` : ""}.` : "Your goal is saved."}
      </p>
    </Panel>
  );
}
