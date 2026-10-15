"use client";

import { useState } from "react";
import type { ApplicationAnswer, ResumeLine } from "@auto-career/shared";
import { useApplicationActions, type ApplicationDetail } from "@/hooks/use-applications";
import { ApiError } from "@/lib/api";
import { Button } from "../../shared/button";
import { Field, Input, Textarea } from "../../shared/field";

/** Edits a draft. Resume lines show the facts they cite; the API rejects lines that cite unknown facts. */
export function ApplicationEditor({ detail }: { detail: ApplicationDetail }) {
  const { update } = useApplicationActions();
  const [answers, setAnswers] = useState<ApplicationAnswer[]>(detail.application.answers);
  const [lines, setLines] = useState<ResumeLine[]>(detail.application.resumeLines);
  const [coverLetter, setCoverLetter] = useState(detail.application.coverLetter ?? "");
  const [saved, setSaved] = useState(false);

  const save = () =>
    update.mutate(
      { id: detail.application.id, input: { answers, resumeLines: lines, coverLetter: coverLetter || null } },
      { onSuccess: () => setSaved(true) },
    );

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="">Answers</h2>
        {answers.map((a, i) => (
          <Field key={a.fieldKey} label={a.label} htmlFor={`answer-${a.fieldKey}`} hint={a.source === "generated" ? "Drafted for this job. Check it." : undefined}>
            <Input
              id={`answer-${a.fieldKey}`}
              value={a.value}
              onChange={(e) => {
                setSaved(false);
                setAnswers((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)));
              }}
            />
          </Field>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="">Resume lines</h2>
        {lines.length === 0 ? <p className="text-sm text-body">Tailoring is still running. Refresh in a minute.</p> : null}
        {lines.map((line, i) => (
          <div key={line.id} className="flex flex-col gap-1">
            <Textarea
              aria-label={`Resume line in ${line.section}`}
              className="min-h-16"
              value={line.text}
              onChange={(e) => {
                setSaved(false);
                setLines((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)));
              }}
            />
            <p className="tabular-nums text-xs text-subtle">
              {line.section} · cites {line.factIds.length} fact{line.factIds.length === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <Field label="Cover letter" htmlFor="cover-letter" hint="Optional. Leave empty if the form does not ask for one.">
          <Textarea id="cover-letter" value={coverLetter} onChange={(e) => (setSaved(false), setCoverLetter(e.target.value))} className="min-h-48" />
        </Field>
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
        {saved ? <span className="text-sm text-good">Saved</span> : null}
        {update.error ? <span role="alert" className="text-sm text-bad">{update.error instanceof ApiError ? update.error.message : "Could not save."}</span> : null}
      </div>
    </div>
  );
}
