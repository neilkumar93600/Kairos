import type { AtsProvider } from "@auto-career/shared";

/** What differs between boards. Everything else is the shared label-based filler. */
export interface AtsFormAdapter {
  provider: AtsProvider;
  matches(url: URL): boolean;
  /** Maps our canonical field keys to this board's input names. */
  fieldAliases: Record<string, string[]>;
  resumeInputSelector: string;
  submitSelector: string;
  /** True once the page shows the board's own "application received" state. */
  isConfirmation(doc: Document, url: URL): boolean;
}

export const CONFIRMATION_TEXT = /(thank you for (applying|your application)|application (has been )?(received|submitted)|we('| ha)ve received your application)/i;

/** Visible page text; falls back to textContent where innerText is unavailable or empty. */
export function pageText(doc: Document): string {
  return doc.body?.innerText || doc.body?.textContent || "";
}
