"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post } from "@/lib/api";

export interface Match {
  id: string;
  score: number | null;
  reasons: string[];
  status: string;
  createdAt: string;
  job: { id: string; title: string; location: string | null; remote: boolean; applyUrl: string; firstSeenAt: string };
  company: { name: string; ats: string };
}

export function useMatches() {
  return useQuery({ queryKey: ["matches"], queryFn: () => api<{ matches: Match[] }>("/matches").then((r) => r.matches) });
}

export function useMatchActions() {
  const qc = useQueryClient();
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["matches"] }), qc.invalidateQueries({ queryKey: ["applications"] })]);
  return {
    queue: useMutation({ mutationFn: (id: string) => post<{ applicationId: string | null }>(`/matches/${id}/queue`), onSuccess: refresh }),
    skip: useMutation({ mutationFn: (id: string) => post(`/matches/${id}/skip`), onSuccess: refresh }),
  };
}
