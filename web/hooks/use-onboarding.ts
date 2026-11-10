"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApplicationDetails, EmploymentInput, ImportDetail, OnboardingUpdate } from "@auto-career/shared";
import { useApiQuery } from "@/lib/use-api-query";
import { api, ApiError, patch, post, put } from "@/lib/api";
import type { Profile } from "./use-profile";

export type Contact = Pick<Profile, "phone" | "city" | "country" | "linkedinUrl" | "githubUrl" | "portfolioUrl">;

export interface Employment {
  id: string;
  title: string;
  company: string;
  location: string | null;
  startMonth: string | null;
  endMonth: string | null;
  isCurrent: boolean;
  roleFactId: string | null;
  results: Array<{ factId: string; text: string }>;
}

/** GET /profile/imports/:id as the server sends it: parseStatus, progressText, failureCode, fileName, the facts found. */
export type ImportState = ImportDetail;

/** Everything the onboarding wizard reads and writes. Each mutation refreshes me, profile and facts. */
export function useOnboarding() {
  const qc = useQueryClient();
  const refresh = (extra: string[] = []) => () =>
    Promise.all(["me", "profile", "facts", ...extra].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  const employmentsDone = refresh(["employments"]);
  return {
    save: useMutation({ mutationFn: (input: OnboardingUpdate) => put("/profile/onboarding", input), onSuccess: refresh() }),
    employments: useApiQuery({ queryKey: ["employments"], queryFn: () => api<{ employments: Employment[] }>("/profile/employments").then((r) => r.employments) }),
    addEmployment: useMutation({
      mutationFn: (input: EmploymentInput) => post<{ employment: Employment }>("/profile/employments", input).then((r) => r.employment),
      onSuccess: employmentsDone,
    }),
    updateEmployment: useMutation({
      mutationFn: ({ id, ...input }: { id: string } & Partial<EmploymentInput>) =>
        patch<{ employment: Employment }>(`/profile/employments/${id}`, input).then((r) => r.employment),
      onSuccess: employmentsDone,
    }),
    removeEmployment: useMutation({ mutationFn: (id: string) => api(`/profile/employments/${id}`, { method: "DELETE" }), onSuccess: employmentsDone }),
    /** PUT /profile/application-details. A 409 `details_unreadable` refuses to overwrite what cannot be read; its message shows. */
    saveDetails: useMutation({ mutationFn: (input: ApplicationDetails) => put("/profile/application-details", input), onSuccess: refresh(["application-details"]) }),
    /** PUT /profile/contact replaces all six fields, so callers send the ones they did not change too. */
    saveContact: useMutation({ mutationFn: (input: Contact) => put("/profile/contact", input), onSuccess: refresh() }),
    startImport: useMutation({
      mutationFn: ({ file, text, name }: { file?: File; text?: string; name: string }) => {
        if (file) {
          const form = new FormData();
          form.append("file", file);
          return post<{ importId: string }>("/profile/imports", form);
        }
        return post<{ importId: string }>("/profile/imports", { text, name });
      },
      onSuccess: refresh(),
    }),
    /**
     * POST /resumes, then makes it the default. `onCreated` hears the new id before the second call, and passing it
     * back as `resumeId` skips the POST, so a retry after a failed /default repeats only /default.
     */
    createBase: useMutation({
      mutationFn: async ({
        resumeId,
        onCreated,
        ...input
      }: {
        name: string;
        targetRoles: string[];
        importId?: string;
        resumeId?: string;
        onCreated?: (id: string) => void;
      }) => {
        let id = resumeId;
        if (!id) {
          id = (await post<{ resume: { id: string } }>("/resumes", { from: "facts", ...input })).resume.id;
          onCreated?.(id);
        }
        await post(`/resumes/${id}/default`);
        return { id };
      },
      onSuccess: refresh(),
    }),
  };
}

/** GET /profile/application-details: notice period, relocation, expected salary, read back only to their owner. */
export function useApplicationDetails() {
  return useApiQuery({
    queryKey: ["application-details"],
    queryFn: () => api<{ details: ApplicationDetails }>("/profile/application-details").then((r) => r.details),
  });
}

/** pollImport: reads an import every 1.5 s until it is parsed or failed, or the server no longer knows it (404). */
export function usePollImport(importId: string | null) {
  return useApiQuery({
    queryKey: ["import", importId],
    queryFn: () => api<ImportState>(`/profile/imports/${importId}`),
    enabled: !!importId,
    refetchInterval: (q) => {
      const status = q.state.data?.parseStatus;
      const gone = q.state.error instanceof ApiError && q.state.error.status === 404;
      return status === "parsed" || status === "failed" || gone ? false : 1500;
    },
  });
}
