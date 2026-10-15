"use client";

import { useQuery } from "@tanstack/react-query";
import type { EmailKind } from "@auto-career/shared";
import { api } from "@/lib/api";

export interface InboxEmail {
  id: string;
  sender: string;
  subject: string;
  kind: EmailKind | null;
  applicationId: string | null;
  receivedAt: string;
  preview: string;
}

export function useInbox() {
  return useQuery({ queryKey: ["inbox"], queryFn: () => api<{ emails: InboxEmail[] }>("/inbox").then((r) => r.emails) });
}
