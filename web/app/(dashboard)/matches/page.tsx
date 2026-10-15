import type { Metadata } from "next";
import { MatchList } from "@/components/dashboard/matches/match-list";
import { PageTitle } from "@/components/shared/page-title";

export const metadata: Metadata = { title: "Matches" };

export default function MatchesPage() {
  return (
    <>
      <PageTitle title="Matches" body="Jobs that passed every hard rule and scored above your fit bar, best first." />
      <MatchList />
    </>
  );
}
