"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Resume, ResumeInput, ResumeSuggestion, SuggestionRequest } from "@auto-career/shared";
import { useApiQuery } from "@/lib/use-api-query";
import { api, post, put } from "@/lib/api";
import type { Fact } from "./use-profile";

/** The structured base resume (spec 2026-10-23-resume-workspace, section 6). */
export function useResume() {
  return useApiQuery({ queryKey: ["resume"], queryFn: () => api<{ resume: Resume }>("/resume").then((r) => r.resume) });
}

export function useResumeActions() {
  const qc = useQueryClient();
  return {
    /** 422 truth_lock lists the uncited lines in error.details.lineIds. */
    save: useMutation({
      mutationFn: (input: ResumeInput) => put<{ resume: Resume }>("/resume", input).then((r) => r.resume),
      onSuccess: (resume) => qc.setQueryData(["resume"], resume),
    }),
    /** Proposals only; nothing changes until the user accepts. A `note` comes back as a new unconfirmed fact. */
    suggest: useMutation({
      mutationFn: (input: SuggestionRequest) => post<{ suggestions: ResumeSuggestion[]; factCreated: Fact | null }>("/resume/suggestions", input),
      onSuccess: (r) => (r.factCreated ? qc.invalidateQueries({ queryKey: ["facts"] }) : undefined),
    }),
  };
}
