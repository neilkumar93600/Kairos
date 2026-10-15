"use client";

import { useQuery } from "@tanstack/react-query";
import type { Plan } from "@auto-career/shared";
import { api } from "@/lib/api";

export interface Me {
  user: { id: string; email: string; name: string };
  plan: Plan;
  credits: { balance: number; inFlight: number; available: number };
  onboardingStep: string;
  forwardingAddress: string | null;
  subscription: { status: string; interval: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
}
