"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApplicationAnswer, ApplicationStatus, ResumeLine, SubmitChannel, UpdateApplicationInput } from "@auto-career/shared";
import { useApiQuery } from "@/lib/use-api-query";
import { api, patch, post } from "@/lib/api";

export interface ApplicationRow {
  id: string;
  status: ApplicationStatus;
  channel: SubmitChannel | null;
  approvedAt: string | null;
  submittedAt: string | null;
  failureReason: string | null;
  job: { id: string; title: string; location: string | null; applyUrl: string };
  company: { name: string; ats: string };
}

export interface ApplicationDetail {
  application: {
    id: string;
    status: ApplicationStatus;
    resumeLines: ResumeLine[];
    answers: ApplicationAnswer[];
    coverLetter: string | null;
    receipt: { filledFields: { fieldKey: string; label: string; value: string }[]; confirmationText?: string; channel: SubmitChannel } | null;
    failureReason: string | null;
    submittedAt: string | null;
  };
  job: { title: string; location: string | null; applyUrl: string; descriptionText: string };
  companyName: string;
}

export function useApplications(status?: ApplicationStatus) {
  return useApiQuery({
    queryKey: ["applications", status ?? "all"],
    queryFn: () => api<{ applications: ApplicationRow[] }>(`/applications${status ? `?status=${status}` : ""}`).then((r) => r.applications),
  });
}

/**
 * One application. A new draft gets its profile answers a few seconds after it is created (the server tailor job), and
 * approve refuses a draft until it has them, so this polls every 3s while a draft has no answers, for about 2 minutes.
 */
export function useApplication(id: string) {
  return useApiQuery({
    queryKey: ["application", id],
    queryFn: () => api<ApplicationDetail>(`/applications/${id}`),
    refetchInterval: (q) => {
      const a = q.state.data?.application;
      return a?.status === "draft" && a.answers.length === 0 && q.state.dataUpdateCount < 40 ? 3000 : false;
    },
  });
}

export function useApplicationActions() {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([qc.invalidateQueries({ queryKey: ["applications"] }), qc.invalidateQueries({ queryKey: ["application"] }), qc.invalidateQueries({ queryKey: ["me"] })]);
  return {
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateApplicationInput }) => patch(`/applications/${id}`, input),
      onSuccess: refresh,
    }),
    approve: useMutation({
      mutationFn: (input: { applicationIds: string[]; channel: SubmitChannel }) => post<{ approved: string[] }>("/applications/approve", input),
      onSuccess: refresh,
    }),
    withdraw: useMutation({ mutationFn: (id: string) => post(`/applications/${id}/withdraw`), onSuccess: refresh }),
  };
}
