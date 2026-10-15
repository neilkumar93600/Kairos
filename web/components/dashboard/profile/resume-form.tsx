"use client";

import { useState, type FormEvent } from "react";
import { useProfileActions } from "@/hooks/use-profile";
import { ApiError } from "@/lib/api";
import { Button } from "../../shared/button";
import { Field, Input, Textarea } from "../../shared/field";

/** v1 takes pasted resume text; PDF and DOCX extraction is milestone 2 in the implementation plan. */
export function ResumeForm({ onDone }: { onDone?: () => void }) {
  const { uploadResume } = useProfileActions();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = String(form.get("text"));
    if (text.trim().length < 200) return setError("Paste the full resume text (at least 200 characters).");
    setError(null);
    uploadResume.mutate(
      { name: String(form.get("name")) || "Main resume", text },
      { onSuccess: () => onDone?.(), onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save the resume.") },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4">
      <Field label="Name this resume" htmlFor="resume-name" hint="Useful when you keep one per role type.">
        <Input id="resume-name" name="name" defaultValue="Main resume" />
      </Field>
      <Field label="Resume text" htmlFor="resume-text" hint="Paste everything from your current resume. We split it into facts you confirm next." error={error ?? undefined}>
        <Textarea id="resume-text" name="text" className="min-h-72 tabular-nums text-[13px]" />
      </Field>
      <div>
        <Button type="submit" disabled={uploadResume.isPending}>
          {uploadResume.isPending ? "Saving…" : "Read my resume"}
        </Button>
      </div>
    </form>
  );
}
