"use client";

import type { Goal, PublicPlan } from "@auto-career/shared";
import { useApiQuery } from "@/lib/use-api-query";
import { api } from "@/lib/api";

export interface Me {
  user: { id: string; email: string; name: string };
  plan: PublicPlan;
  credits: { balance: number; inFlight: number; available: number };
  goals: Goal[];
  targetRoles: string[];
  targetCompanies: string[];
  onboardingStep: string;
  forwardingAddress: string | null;
  subscription: { status: string; interval: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
}

export function useMe() {
  return useApiQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
}
