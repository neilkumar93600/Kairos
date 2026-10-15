"use client";

import { useQuery } from "@tanstack/react-query";
import type { CreditReason } from "@auto-career/shared";
import { api } from "@/lib/api";

export interface LedgerEntry {
  id: string;
  delta: number;
  reason: CreditReason;
  applicationId: string | null;
  note: string | null;
  createdAt: string;
}

export function useCredits() {
  return useQuery({
    queryKey: ["credits"],
    queryFn: () => api<{ balance: number; inFlight: number; available: number; entries: LedgerEntry[] }>("/credits"),
  });
}
