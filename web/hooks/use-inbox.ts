"use client";

import type { EmailKind } from "@auto-career/shared";
import { useApiQuery } from "@/lib/use-api-query";
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
  return useApiQuery({ queryKey: ["inbox"], queryFn: () => api<{ emails: InboxEmail[] }>("/inbox").then((r) => r.emails) });
}
