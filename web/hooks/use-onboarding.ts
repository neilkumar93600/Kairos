"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApplicationDetails, EmploymentInput, ImportDetail, OnboardingUpdate } from "@auto-career/shared";
import { useApiQuery } from "@/lib/use-api-query";
import { api, patch, post, put } from "@/lib/api";

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
    saveDetails: useMutation({ mutationFn: (input: ApplicationDetails) => put("/profile/application-details", input), onSuccess: refresh() }),
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
    createBase: useMutation({
      mutationFn: async ({ name, targetRoles, importId }: { name: string; targetRoles: string[]; importId?: string }) => {
        const { resume } = await post<{ resume: { id: string } }>("/resumes", { from: "facts", name, targetRoles, importId });
        await post(`/resumes/${resume.id}/default`);
        return { id: resume.id };
      },
      onSuccess: refresh(),
    }),
  };
}

/** pollImport: reads an import every 1.5 s until it is parsed or failed. */
export function usePollImport(importId: string | null) {
  return useApiQuery({
    queryKey: ["import", importId],
    queryFn: () => api<ImportState>(`/profile/imports/${importId}`),
    enabled: !!importId,
    refetchInterval: (q) => (q.state.data && (q.state.data.parseStatus === "parsed" || q.state.data.parseStatus === "failed") ? false : 1500),
  });
}
