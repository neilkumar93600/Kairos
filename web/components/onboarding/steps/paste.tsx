"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/shared/button";
import { Field, Textarea } from "@/components/shared/field";
import { useOnboarding } from "@/hooks/use-onboarding";
import { forgetPendingBase } from "@/lib/onboarding/session";
import type { StepProps } from "../wizard";
import { failureOf, Reading, storedImport, storeImport, useImportCheck } from "./upload";

const MIN = 200; // the server's minimum for pasted text

/** Spec 5.3c: pasted text goes through the same import as a file (POST /profile/imports as JSON), then the same fact check. */
export function PasteStep({ onReady }: StepProps) {
  const { startImport } = useOnboarding();
  const [importId, setImportId] = useState(storedImport);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const check = useImportCheck(importId, onReady);
  const n = text.trim().length;

  const read = (e: FormEvent) => {
    e.preventDefault();
    if (n < MIN) return setError(`Paste the whole resume: at least ${MIN} characters, and this has ${n}.`);
    setError(null);
    forgetPendingBase();
    startImport.mutate(
      { text, name: "Main resume" },
      {
        onSuccess: ({ importId: id }) => {
          storeImport(id);
          setImportId(id);
        },
        onError: (x) => setError(failureOf(x, "Could not send the text. Check your connection and try again.")),
      },
    );
  };

  return (
    <>
      <h1 tabIndex={-1} className="ob-h1">
        Paste your resume
      </h1>
      <p className="ob-sub">Copy all the text from your resume and paste it here. Kairos reads it into facts you check.</p>
      {startImport.isPending || check.showing ? (
        <Reading phase={startImport.isPending ? "Sending your text" : check.phase} done={check.done} />
      ) : (
        <form onSubmit={read} className="ob-paste">
          <Field
            label="Resume text"
            htmlFor="ob-paste"
            hint={n < MIN ? `${n} of ${MIN} characters. Paste the whole resume, not a summary.` : `${n.toLocaleString("en")} characters. Ready to read.`}
            error={error ?? check.failed ?? undefined}
          >
            <Textarea
              id="ob-paste"
              value={text}
              maxLength={60_000}
              onChange={(e) => setText(e.target.value)}
              className="min-h-72 leading-relaxed"
              placeholder="Paste everything: roles, projects, skills, education and certifications."
            />
          </Field>
          <Button type="submit" variant="secondary" className="h-12 self-start px-6 text-base">
            Read my resume
          </Button>
        </form>
      )}
    </>
  );
}
