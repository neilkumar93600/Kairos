/** The import's progress in words: the server's label ("Reading your resume", "Finding your roles"), or a slow note after 40 polls (about a minute). */
export function phaseLabel(progress: string | null, polls: number): string {
  if (polls > 40) return "This is taking longer than usual. You can leave and come back.";
  return progress ?? "Reading your resume";
}
