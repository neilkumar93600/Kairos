const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** "Mon YYYY to Mon YYYY", "Mon YYYY to now", "Mon YYYY" with only a start, null with none. At most 16 + 4 characters. */
export function datesText(startMonth: string | null, endMonth: string | null, isCurrent: boolean): string | null {
  if (!startMonth) return null;
  if (isCurrent) return `${label(startMonth)} to now`;
  return endMonth ? `${label(startMonth)} to ${label(endMonth)}` : label(startMonth);
}

/** The role fact's text, which is also how the default resume tells a typed job's heading fact from a duty bullet; capped at the 400 characters a fact allows. */
export function roleFactText(e: { title: string; company: string; datesText: string | null }): string {
  return `${e.title} at ${e.company}${e.datesText ? `, ${e.datesText}` : ""}`.slice(0, 400);
}
