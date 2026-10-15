import type { Metadata } from "next";
import { QueueList } from "@/components/dashboard/queue/queue-list";
import { PageTitle } from "@/components/shared/page-title";

export const metadata: Metadata = { title: "Review queue" };

export default function QueuePage() {
  return (
    <>
      <PageTitle title="Review queue" body="Nothing is sent until you approve it. Open a draft to edit any answer or resume line." />
      <QueueList />
    </>
  );
}
