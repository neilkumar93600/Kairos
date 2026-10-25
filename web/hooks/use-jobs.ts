"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ImportJobInput, JobFit, Resume, ResumeSuggestion } from "@auto-career/shared";
import { useApiQuery } from "@/lib/use-api-query";
import { api, post } from "@/lib/api";

export interface ImportedJob {
  jobId: string;
  matchId: string | null;
  fit: { passed: boolean; reasons: string[] };
}

/**
 * Coverage of one posting by confirmed facts, plus the user's match for that job when there is one (matchId is what
 * Create draft queues). Pass null to skip (base mode).
 */
export function useJobFit(jobId: string | null) {
  return useApiQuery({
    queryKey: ["job-fit", jobId],
    queryFn: () =>
      api<{ fit: JobFit; matchId?: string | null }>(`/jobs/${jobId}/fit`).then((r) => ({ fit: r.fit, matchId: r.matchId ?? null })),
    enabled: jobId !== null,
  });
}

/** A tailored copy of the base resume for one job, with suggestions. Nothing is saved server-side. */
export function useTailor(jobId: string | null) {
  return useApiQuery({
    queryKey: ["tailor", jobId],
    queryFn: () => post<{ resume: Resume; suggestions: ResumeSuggestion[]; fit: JobFit }>(`/jobs/${jobId}/tailor`),
    enabled: jobId !== null,
    staleTime: Infinity, // one tailoring run per visit; the user's accepted edits live in component state
  });
}

export function useImportJob() {
  const qc = useQueryClient();
  return useMutation({
    /** 422 unsupported_board, 404 posting_not_found. */
    mutationFn: (input: ImportJobInput) => post<ImportedJob>("/jobs/import", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });
}

/** Greenhouse, Lever and Ashby posting URLs, checked before anything is sent. */
export const SUPPORTED_BOARD = /^https:\/\/(boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com)\/[^\s]+$/;
