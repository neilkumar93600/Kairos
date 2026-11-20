"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/lib/use-api-query";
import { api, post } from "@/lib/api";
import type { QueueResult } from "@/lib/queue-outcome";

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
  return useApiQuery({ queryKey: ["matches"], queryFn: () => api<{ matches: Match[] }>("/matches").then((r) => r.matches) });
}

export function useMatchActions() {
  const qc = useQueryClient();
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["matches"] }), qc.invalidateQueries({ queryKey: ["applications"] })]);
  return {
    queue: useMutation({ mutationFn: (id: string) => post<QueueResult>(`/matches/${id}/queue`), onSuccess: refresh }),
    skip: useMutation({ mutationFn: (id: string) => post(`/matches/${id}/skip`), onSuccess: refresh }),
  };
}
