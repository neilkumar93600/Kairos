import type { Metadata } from "next";
import { Suspense } from "react";
import { marketingCopy } from "@/content/marketing-copy";
import { NewsletterPage, StatusView, type NewsletterStatus } from "./status-view";

const { meta } = marketingCopy.newsletterStatus;

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  robots: { index: false, follow: true },
};

const STATUSES: readonly NewsletterStatus[] = ["confirmed", "unsubscribed", "invalid"];

export default function NewsletterStatusPage(props: PageProps<"/newsletter">) {
  return (
    <NewsletterPage>
      {/* Only the sheet waits on URL data, so the App Shell stays static. */}
      <Suspense
        fallback={
          <div className="lp-wrap lp-wrap--copy">
            <div className="nls-sheet nls-sheet--pending glass-panel" />
          </div>
        }
      >
        <Status searchParams={props.searchParams} />
      </Suspense>
    </NewsletterPage>
  );
}

async function Status({ searchParams }: { searchParams: PageProps<"/newsletter">["searchParams"] }) {
  const { status } = await searchParams;
  const known = STATUSES.find((s) => s === status);
  return <StatusView status={known ?? "none"} />;
}
