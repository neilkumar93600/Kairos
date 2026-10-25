"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SUPPORTED_BOARD, useImportJob } from "@/hooks/use-jobs";
import { ApiError } from "@/lib/api";
import { Button, ButtonLink } from "../../shared/button";
import { Field, Input } from "../../shared/field";
import { Panel } from "../../shared/panel";

const UNSUPPORTED = "That is not a Greenhouse, Lever or Ashby posting link. Paste the https address of the job page.";

/** Paste a posting URL: checked here first, then imported; opens the resume workspace tailored to that job. */
export function JobUrlImport() {
  const router = useRouter();
  const importJob = useImportJob();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [below, setBelow] = useState<{ jobId: string; reasons: string[] } | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = url.trim();
    setBelow(null);
    if (!value) return setError("Paste a job link first.");
    if (!SUPPORTED_BOARD.test(value)) return setError(UNSUPPORTED);
    setError(null);
    importJob.mutate(
      { url: value },
      {
        onSuccess: (r) => {
          if (r.fit.passed) router.push(`/resume?job=${encodeURIComponent(r.jobId)}`);
          else setBelow({ jobId: r.jobId, reasons: r.fit.reasons });
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === "unsupported_board") setError(UNSUPPORTED);
          else if (err instanceof ApiError && err.code === "posting_not_found") setError("That posting is closed or no longer exists. Check the link, or pick another job.");
          else setError(err instanceof ApiError ? err.message : "Could not read that posting. Try again.");
        },
      },
    );
  };

  return (
    <Panel title="Paste a job link" description="Found a job yourself? Kairos checks it against your fit bar, then tailors your resume to it.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Field label="Job posting link" htmlFor="job-url" hint="Greenhouse, Lever or Ashby." error={error ?? undefined}>
            <Input
              id="job-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://jobs.lever.co/company/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" disabled={importJob.isPending} className="sm:mb-[1.625rem]">
          {importJob.isPending ? "Checking…" : "Check and tailor"}
        </Button>
      </form>

      {below ? (
        <div role="status" className="mt-4 flex flex-col gap-3 rounded-input border border-line bg-sunk/40 p-4">
          <p className="text-sm font-medium text-ink">This job is below your fit bar.</p>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-body marker:text-faint">
            {below.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="text-sm text-body">You picked it by hand, so you can still tailor a resume for it.</p>
          <div>
            <ButtonLink href={`/resume?job=${encodeURIComponent(below.jobId)}`} variant="secondary">
              Tailor anyway
            </ButtonLink>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
