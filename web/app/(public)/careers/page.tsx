import type { Metadata } from "next";
import { OpenRoles } from "@/components/careers/open-roles";
import { Entry10Start } from "@/components/landing/entries/entry-10-start";
import { PageHero } from "@/components/marketing/page-hero";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Careers",
  description: `No open roles at ${siteConfig.company} right now. If you have built careful AI products or hiring tools, write in.`,
  alternates: { canonical: "/careers" },
};

export default function CareersPage() {
  return (
    <>
      <PageHero
        titleId="careers-title"
        pill="No open roles right now"
        title="Help people apply well, not just often."
        lead={`Kairos is built by a small team at ${siteConfig.company}. The work is careful AI, browser automation and hiring tools.`}
        art={{
          src: "/landing/art/footer-dusk-hills-2880x840.png",
          alt: "Dusk over the hills beyond the valley, the sky still light above the far ridge.",
          position: "50% 50%",
        }}
      />
      <OpenRoles />
      <Entry10Start />
    </>
  );
}
