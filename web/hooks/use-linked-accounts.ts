"use client";

import { useApiQuery } from "@/lib/use-api-query";
import { authClient } from "@/lib/auth-client";
import { ApiError } from "@/lib/api";

/**
 * The sign-in methods linked to this account: Better Auth 1.7.x `listAccounts` (GET /api/auth/list-accounts), one row
 * per method. `providerId` is "credential" for email and password, else the social provider; `id` is what
 * `unlinkAccount({ accountId })` takes.
 */
export function useLinkedAccounts() {
  return useApiQuery({
    queryKey: ["linked-accounts"],
    queryFn: async () => {
      const { data, error } = await authClient.listAccounts();
      if (error) throw new ApiError(error.status, error.code ?? "unknown", error.message ?? "Could not load your sign-in methods.");
      return data;
    },
  });
}
