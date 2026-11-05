import type { Metadata } from "next";
import { marketingCopy } from "@/content/marketing-copy";
import { NewsletterPage } from "../status-view";
import { TokenAction } from "../token-action";

const { meta } = marketingCopy.newsletterStatus;

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function NewsletterUnsubscribePage() {
  return (
    <NewsletterPage>
      <TokenAction kind="unsubscribe" />
    </NewsletterPage>
  );
}
