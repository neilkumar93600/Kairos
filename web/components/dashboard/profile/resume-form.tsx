"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useFacts, useProfileActions } from "@/hooks/use-profile";
import { ApiError } from "@/lib/api";
import { Button } from "../../shared/button";
import { Field, Input, Textarea } from "../../shared/field";
import { Skeleton } from "../../shared/skeleton";
import { StatusWord } from "../../shared/status";

const MIN = 200;
const POLL_MS = 3000;
const SLOW_AFTER = 20; // polls, about a minute

const idsOf = (facts: { id: string }[] | undefined) => (facts ?? []).map((f) => f.id).join();

/**
 * v1 takes pasted resume text; PDF and DOCX extraction is milestone 2 in the implementation plan.
 * The API answers 202 and parses in the background, so after sending the form waits, re-reading facts and /me,
 * until the fact list changes. The onboarding flow advances on its own when /me reports the new step.
 */
export function ResumeForm() {
  const qc = useQueryClient();
  const facts = useFacts();
  const { uploadResume } = useProfileActions();
  const [error, setError] = useState<string | null>(null);
  const [planLimit, setPlanLimit] = useState<string | null>(null);
  const [length, setLength] = useState(0);
  // ponytail: the wait lives in component state, so a reload mid-parse shows the form again; add a resume
  // status endpoint if that matters.
  const [sentWith, setSentWith] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);
  const current = idsOf(facts.data);
  const waiting = sentWith !== null && current === sentWith;
  const parsed = sentWith !== null && current !== sentWith;

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      setPolls((n) => n + 1);
      void qc.invalidateQueries({ queryKey: ["facts"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, qc]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = String(form.get("text"));
    const n = text.trim().length;
    if (n < MIN) return setError(`Paste the full resume text: at least ${MIN} characters, and this has ${n}.`);
    setError(null);
    setPlanLimit(null);
    const before = current;
    uploadResume.mutate(
      { name: String(form.get("name")) || "Main resume", text },
      {
        onSuccess: () => {
          setPolls(0);
          setSentWith(before);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 403) return setPlanLimit(err.message);
          setError(err instanceof ApiError ? err.message : "Could not save the resume. Try again.");
        },
      },
    );
  }

  if (waiting) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <StatusWord tone="open" className="text-base font-medium">
            Reading your resume
          </StatusWord>
          <p className="max-w-[60ch] text-sm text-body">
            {polls >= SLOW_AFTER
              ? "This is taking longer than usual. You can leave this page and come back; nothing is lost."
              : "Usually about a minute. You can leave this page; the facts wait for you, unconfirmed."}
          </p>
        </div>
        <ul aria-hidden className="flex flex-col">
          {["w-3/4", "w-1/2", "w-2/3"].map((w) => (
            <li key={w} className="flex items-center gap-4 border-t border-line py-4">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className={`h-4 ${w}`} />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-9 w-24 rounded-pill" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const hint =
    length < MIN
      ? `${length} of ${MIN} characters. Paste the whole resume, not a summary.`
      : `${length.toLocaleString("en")} characters. Ready to read.`;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {parsed ? (
        <p role="status" className="flex flex-wrap items-center gap-x-2 text-sm text-body">
          <StatusWord tone="positive">Resume read</StatusWord>
          Its facts are in your list, unconfirmed.
        </p>
      ) : null}
      <Field label="Name this resume" htmlFor="resume-name" hint="Useful when you keep one per role type.">
        <Input id="resume-name" name="name" defaultValue="Main resume" maxLength={80} />
      </Field>
      <Field label="Resume text" htmlFor="resume-text" hint={hint} error={error ?? undefined}>
        <Textarea
          id="resume-text"
          name="text"
          maxLength={60_000}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            const n = e.currentTarget.value.trim().length;
            setLength(n);
            if (error && n >= MIN) setError(null);
          }}
          className="min-h-72 leading-relaxed"
          placeholder="Paste everything: roles, projects, skills, education and certifications."
        />
      </Field>
      {planLimit ? (
        <p role="alert" className="rounded-input bg-sunk px-4 py-3 text-sm text-ink">
          {planLimit.replace(/\.?$/, ".")}{" "}
          <Link href="/billing" className="underline underline-offset-3 hover:text-body focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink">
            Compare plans
          </Link>{" "}
          to keep more than one.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" disabled={uploadResume.isPending}>
          {uploadResume.isPending ? "Saving…" : "Read my resume"}
        </Button>
        <span className="text-sm text-faint">Nothing goes to an employer from here.</span>
      </div>
    </form>
  );
}
