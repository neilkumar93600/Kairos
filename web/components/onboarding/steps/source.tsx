"use client";

import { useEffect } from "react";
import { ListChecks, PencilSimple, UploadSimple, type Icon } from "@phosphor-icons/react";
import { useFacts } from "@/hooks/use-profile";
import type { Source } from "@/lib/onboarding/flow";
import { cn } from "@/lib/utils";
import { useWizard, type StepProps } from "../wizard";
import { storeImport } from "./upload";

const CHOICES: Array<{ source: NonNullable<Source>; Icon: Icon; title: string; line: string; tag?: string }> = [
  { source: "upload", Icon: UploadSimple, title: "Upload a file", line: "PDF or DOCX up to 5 MB. Kairos reads it into facts you check.", tag: "About 1 minute" },
  { source: "form", Icon: PencilSimple, title: "Fill it in with us", line: "One form with everything job applications ask for. No file needed.", tag: "About 10 minutes" },
  { source: "existing", Icon: ListChecks, title: "Use what you already added", line: "Start from the facts you confirmed before. Add more any time in Profile." },
];

/** Upload or fill in; paste is the plain link. "Use what you already added" shows once the user has a confirmed fact. */
export function SourceStep({ onReady }: StepProps) {
  const { state, setSource, switchTo } = useWizard();
  const facts = useFacts();
  const hasConfirmed = facts.data?.some((f) => f.confirmed) ?? false;
  useEffect(() => {
    onReady(state.source !== null);
  }, [state.source, onReady]);

  // A different source starts over: the paste or upload step must not reopen an earlier import.
  const choose = (source: NonNullable<Source>) => {
    if (source !== state.source) storeImport(null);
    setSource(source);
  };

  return (
    <>
      <h1 tabIndex={-1} className="ob-h1">
        How do you want to add your resume?
      </h1>
      <p className="ob-sub">Every line Kairos writes later cites something from it, so it starts here.</p>
      <div className="ob-sources" role="group" aria-label="Resume source">
        {CHOICES.filter((c) => c.source !== "existing" || hasConfirmed).map(({ source, Icon, title, line, tag }) => (
          <button
            key={source}
            type="button"
            className={cn("ob-src", !tag && "ob-src--wide")}
            aria-pressed={state.source === source}
            onClick={() => choose(source)}
          >
            <span className="ob-src__icon">
              <Icon size={22} aria-hidden />
            </span>
            <span className="ob-src__title">{title}</span>
            <span className="ob-src__line">{line}</span>
            {tag ? <span className="ob-src__tag">{tag}</span> : null}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="ob-link"
        onClick={() => {
          if (state.source !== "paste") storeImport(null);
          switchTo("paste");
        }}
      >
        Paste the text instead
      </button>
    </>
  );
}
