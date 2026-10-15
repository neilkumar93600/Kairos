import type { Metadata } from "next";
import { PreferencesPanel } from "@/components/dashboard/preferences/preferences-panel";
import { PageTitle } from "@/components/shared/page-title";

export const metadata: Metadata = { title: "Preferences" };

export default function PreferencesPage() {
  return (
    <>
      <PageTitle title="Preferences" body="Hard rules for the fit gate. A job that breaks one is dropped before any model reads it." />
      <PreferencesPanel />
    </>
  );
}
