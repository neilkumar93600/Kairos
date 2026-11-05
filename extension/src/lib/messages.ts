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

/** How one application ended. `unrecorded`: the employer confirmed it, our API did not take the report. `closed`: the tab closed first. */
export type QueueOutcome = { outcome: "submitted" } | { outcome: "failed"; reason?: string } | { outcome: "unrecorded" } | { outcome: "closed" };

/** From the background worker to the side panel. */
export type PanelMessage = { type: "queue:update"; applicationId: string } & QueueOutcome;

/** Session-storage flag: the employer confirmed this application but the API never heard. Outlives the panel, so Send stays hidden. */
export const unrecordedKey = (applicationId: string) => `unrecorded:${applicationId}`;

/** Messages the Kairos web app may send (externally_connectable). */
export type ExternalMessage = { type: "connect"; oneTimeToken: string } | { type: "ping" };
