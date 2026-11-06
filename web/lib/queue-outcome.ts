/** What POST /api/matches/:id/queue answers (05-api 10.1). An older api sends no `reason`, only a null id. */
export interface QueueResult {
  applicationId: string | null;
  reason?: "already_queued" | "company_cap" | "too_many_pending";
  existingApplicationId?: string;
}

/**
 * The sentence for a queue the server refused, or null when no draft was refused: a new draft, or a null id from an api that
 * gives no reason, which keeps what the caller did before reasons existed.
 */
export function queueRefusal(result: QueueResult, company = "this company"): string | null {
  switch (result.reason) {
    case "already_queued":
      return "You already have an application for this job, so no new draft was made.";
    case "company_cap":
      return `You have reached your limit of applications to ${company} for the last 30 days, so no draft was made. You can change the limit in your preferences.`;
    case "too_many_pending":
      return "Too many of your drafts are still being prepared, so no draft was made. Try again when they finish.";
    default:
      return null;
  }
}
