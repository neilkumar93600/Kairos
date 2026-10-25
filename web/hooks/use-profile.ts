"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FactKind, Preferences } from "@auto-career/shared";
import { useApiQuery } from "@/lib/use-api-query";
import { api, patch, post, put } from "@/lib/api";

export interface Fact {
  id: string;
  kind: FactKind;
  text: string;
  sourceSpan: string | null;
  confirmed: boolean;
}

export interface Profile {
  phone: string | null;
  city: string | null;
  country: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  preferences: Preferences | null;
  onboardingStep: string;
  forwardingAddress: string;
}

export function useProfile() {
  return useApiQuery({ queryKey: ["profile"], queryFn: () => api<{ profile: Profile }>("/profile").then((r) => r.profile) });
}

export function useFacts() {
  return useApiQuery({ queryKey: ["facts"], queryFn: () => api<{ facts: Fact[] }>("/profile/facts").then((r) => r.facts) });
}

export function useProfileActions() {
  const qc = useQueryClient();
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["profile"] }), qc.invalidateQueries({ queryKey: ["facts"] }), qc.invalidateQueries({ queryKey: ["me"] })]);
  return {
    uploadResume: useMutation({ mutationFn: (input: { name: string; text: string }) => post("/profile/resumes", input), onSuccess: refresh }),
    updateFact: useMutation({
      mutationFn: ({ id, ...input }: { id: string; text?: string; confirmed?: boolean }) => patch(`/profile/facts/${id}`, input),
      onSuccess: refresh,
    }),
    deleteFact: useMutation({ mutationFn: (id: string) => api(`/profile/facts/${id}`, { method: "DELETE" }), onSuccess: refresh }),
    savePreferences: useMutation({ mutationFn: (prefs: Preferences) => put("/profile/preferences", prefs), onSuccess: refresh }),
    /** A fact the user typed. confirmed defaults to true on the server, so "Add this fact" sends false explicitly. */
    addFact: useMutation({
      mutationFn: (input: { kind: FactKind; text: string; confirmed: boolean }) => post<{ fact: Fact }>("/profile/facts", input).then((r) => r.fact),
      onSuccess: refresh,
    }),
  };
}
