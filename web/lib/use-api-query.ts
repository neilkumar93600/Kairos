"use client";

import { useQuery, type DefaultError, type QueryKey, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { useHydrated } from "@/lib/landing/use-hydrated";

/**
 * useQuery for the API hooks. Dashboard data loads in the browser, so the server HTML is always the loading state.
 * The query cache is shared, though: a component that hydrates after another one filled the cache (the header's
 * useMe) would render data on its first client pass and mismatch the server HTML. Until hydration ends this reports
 * pending, so every first client render matches; after that it is the plain query result.
 */
export function useApiQuery<TData, TKey extends QueryKey = QueryKey>(
  options: UseQueryOptions<TData, DefaultError, TData, TKey>,
): UseQueryResult<TData, DefaultError> {
  const query = useQuery(options);
  const hydrated = useHydrated();
  if (hydrated) return query;
  return {
    ...query,
    data: undefined,
    error: null,
    isError: false,
    isSuccess: false,
    isPending: true,
    isLoading: true,
    status: "pending",
  } as UseQueryResult<TData, DefaultError>;
}
