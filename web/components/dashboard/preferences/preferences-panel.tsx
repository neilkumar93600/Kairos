"use client";

import { useProfile } from "@/hooks/use-profile";
import { ErrorNote } from "../../shared/error-note";
import { ListSkeleton } from "../../shared/skeleton";
import { PreferencesForm } from "./preferences-form";

export function PreferencesPanel() {
  const { data, isLoading, error } = useProfile();
  if (isLoading) return <ListSkeleton rows={5} />;
  if (error) return <ErrorNote error={error} />;
  return <PreferencesForm initial={data?.preferences ?? null} />;
}
