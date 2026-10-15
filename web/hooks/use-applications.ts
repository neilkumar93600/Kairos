"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApplicationAnswer, ApplicationStatus, ResumeLine, SubmitChannel, UpdateApplicationInput } from "@auto-career/shared";
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
  return useQuery({
    queryKey: ["applications", status ?? "all"],
    queryFn: () => api<{ applications: ApplicationRow[] }>(`/applications${status ? `?status=${status}` : ""}`).then((r) => r.applications),
  });
}

export function useApplication(id: string) {
  return useQuery({ queryKey: ["application", id], queryFn: () => api<ApplicationDetail>(`/applications/${id}`) });
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
