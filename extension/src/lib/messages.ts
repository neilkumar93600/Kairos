import type { ApplicationAnswer, ResumeLine, SubmissionReport } from "@auto-career/shared";

/** What the filler needs to complete one application. */
export interface FillPayload {
  applicationId: string;
  answers: ApplicationAnswer[];
  resumeLines: ResumeLine[];
  coverLetter: string | null;
  /** Signed URL to the tailored resume PDF; attached to the form's resume input. */
  resumePdfUrl?: string;
  /** false = fill and stop for the user to review in the tab; true = submit after filling. */
  submit: boolean;
}

export interface QueueItem extends Omit<FillPayload, "submit"> {
  applyUrl: string;
  title: string;
}

/** Messages between the side panel, background worker and content script. */
export type ExtensionMessage =
  | { type: "queue:get" }
  | { type: "queue:send"; applicationId: string; review: boolean }
  | { type: "content:ready" }
  | { type: "content:report"; report: SubmissionReport };

/** Messages the Kairos web app may send (externally_connectable). */
export type ExternalMessage = { type: "connect"; oneTimeToken: string } | { type: "ping" };
