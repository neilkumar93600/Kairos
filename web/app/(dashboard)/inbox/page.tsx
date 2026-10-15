import type { Metadata } from "next";
import { ReplyList } from "@/components/dashboard/inbox/reply-list";
import { PageTitle } from "@/components/shared/page-title";

export const metadata: Metadata = { title: "Replies" };

export default function InboxPage() {
  return (
    <>
      <PageTitle title="Replies" body="Employer emails you forwarded, sorted by what they mean." />
      <ReplyList />
    </>
  );
}
