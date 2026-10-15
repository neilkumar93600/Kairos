/** Section table for the landing page. Ids stay as copy keys and anchors; other modules select by these values. */
export type EntryId = "00" | "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10";
export type EntrySectionId =
  | "entry-00-hero" | "entry-01-reported" | "entry-02-fit-gate" | "entry-03-truth-lock"
  | "entry-04-approve" | "entry-05-send-receipt" | "entry-06-replies" | "entry-07-billing"
  | "entry-08-compare" | "entry-09-questions" | "entry-10-start";
export type SectionId = "navbar" | EntrySectionId | "footer";

export interface EntryDef {
  entry: EntryId;
  /** Also the top-level key in landingCopy. */
  section: EntrySectionId;
  anchor: `entry-${EntryId}`;
}

export const ENTRIES: readonly EntryDef[] = [
  { entry: "00", section: "entry-00-hero",         anchor: "entry-00" },
  { entry: "01", section: "entry-01-reported",     anchor: "entry-01" },
  { entry: "02", section: "entry-02-fit-gate",     anchor: "entry-02" },
  { entry: "03", section: "entry-03-truth-lock",   anchor: "entry-03" },
  { entry: "04", section: "entry-04-approve",      anchor: "entry-04" },
  { entry: "05", section: "entry-05-send-receipt", anchor: "entry-05" },
  { entry: "06", section: "entry-06-replies",      anchor: "entry-06" },
  { entry: "07", section: "entry-07-billing",      anchor: "entry-07" },
  { entry: "08", section: "entry-08-compare",      anchor: "entry-08" },
  { entry: "09", section: "entry-09-questions",    anchor: "entry-09" },
  { entry: "10", section: "entry-10-start",        anchor: "entry-10" },
] as const;
