import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { refundSection } from "@/content/legal-refund";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookie policy",
  description: "The cookies and browser storage Kairos uses, what each is for, and how to control them. No analytics or advertising.",
  alternates: { canonical: "/cookies" },
};

const { name, supportEmail } = siteConfig;
const support = `[${supportEmail}](mailto:${supportEmail})`;

export default function CookiesPage() {
  return (
    <LegalDocument
      path="/cookies"
      title="Cookie policy"
      updated="2026-11-05"
      intro={`${name} sets one cookie to keep you signed in, and one more for a few minutes if you sign in with Google, Apple, GitHub or LinkedIn. It uses no analytics and no advertising cookies.`}
      sections={[
        {
          heading: "What cookies and browser storage are",
          body: [
            "A cookie is a small piece of text a website stores in your browser and gets back with each request. Local storage and session storage work in a similar way, but stay in your browser and are not sent to our servers with each request.",
          ],
        },
        {
          heading: "The cookies we set",
          body: [
            {
              table: {
                caption: "Cookies set by Kairos",
                head: ["Cookie", "What it does", "How long it lasts"],
                rows: [
                  ["better-auth.session_token", "Keeps you signed in. It is essential, set only when you sign in, and not readable by page scripts.", "30 days, renewed as you use the app. Signing out removes it."],
                  ["better-auth.state", "Protects the sign-in round trip with Google, Apple, GitHub or LinkedIn. Set only if you sign in with one of them.", "5 minutes"],
                ],
              },
            },
            "On the live site browsers see these names with a __Secure- prefix, which means they travel only over HTTPS. If you only read the public pages and never sign in, we set no cookies.",
          ],
        },
        {
          heading: "What we keep in your browser",
          body: [
            "These items remember choices on this device. They are not sent to us, and they stay until you clear them or, for session storage, close the tab.",
            {
              table: {
                caption: "Browser storage used by Kairos",
                head: ["Key", "What it remembers", "Where"],
                rows: [
                  ["kairos:motion", "Whether you chose full or reduced motion", "Local storage"],
                  ["kairos.banner.<id>", "That you dismissed a top banner, so it stays hidden", "Local storage"],
                  ["kairos.popup.newsletter", "When the newsletter popup last opened, so it shows at most once in 30 days", "Local storage"],
                  ["kairos.newsletter.subscribed", "That you signed up for the newsletter here, so the popup stops", "Local storage"],
                  ["kairos.sidebar", "That you collapsed the dashboard sidebar", "Local storage"],
                  ["kairos:landing:ledger:v1", "Your place in the sample application on the home page", "Session storage"],
                  ["kairos:overview:sent-tile-hidden", "That you hid a tile on the dashboard", "Session storage"],
                ],
              },
            },
            "If you install the Kairos Chrome extension, it keeps a sign-in token in the extension's own storage. Removing the extension removes it.",
          ],
        },
        {
          heading: "No analytics or advertising",
          body: [
            "The site has no analytics, advertising pixels, chat widgets, video embeds or other third-party scripts, and its fonts are served from our own domain. So no third party sets a cookie through our pages, and we do not track you across other sites.",
            "If we add analytics, we will list it here first and ask for your consent where the law requires it.",
          ],
        },
        {
          heading: "Other sites you visit from Kairos",
          body: [
            "Paying and managing your plan happen on Stripe's pages, and signing in with Google, Apple, GitHub or LinkedIn on that company's own pages. Each of those sites sets its own cookies under its own policy. Employers' application pages do the same when the extension opens them in your browser.",
          ],
        },
        {
          heading: "How to control them",
          body: [
            "Your browser's settings let you see and delete cookies and site data, and block them for any site. If you block the sign-in cookie you can still read the public pages, but you cannot sign in. If you clear browser storage, the choices above reset, and a dismissed banner may come back.",
            "We do not show a consent banner, because we set no cookies for analytics or advertising. We do not act on Do Not Track signals, because there is no tracking for them to turn off.",
          ],
        },
        refundSection,
        {
          heading: "Changes and contact",
          body: [`When this list changes we will update this page and its date. Questions go to ${support}. The [privacy policy](/privacy) covers the rest of your data.`],
        },
      ]}
    />
  );
}
