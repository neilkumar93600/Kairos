import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { refundSection } from "@/content/legal-refund";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Kairos collects, why, who receives it, how long it is kept, and how to export or delete it.",
  alternates: { canonical: "/privacy" },
};

const { name, company, supportEmail } = siteConfig;
const support = `[${supportEmail}](mailto:${supportEmail})`;

export default function PrivacyPage() {
  return (
    <LegalDocument
      path="/privacy"
      title="Privacy policy"
      updated="2026-11-05"
      intro="What we collect, why, who receives it, how long we keep it and how to remove it."
      sections={[
        {
          heading: "Who we are",
          body: [`${name} is a job application agent operated by ${company}. For anything in this policy, write to ${support}.`],
        },
        {
          heading: "What we collect",
          body: [
            {
              table: {
                caption: "The data Kairos collects and where it comes from",
                head: ["Data", "What it includes"],
                rows: [
                  ["Account", "Your name and email address. A hashed password, or your Google account id if you sign in with Google. We never store Google's id token."],
                  ["Profile", "Phone, city, country, and LinkedIn, GitHub and portfolio links. Your search preferences, including work authorization and salary floor."],
                  ["Resume and facts", "Resume files you upload or text you paste, including a LinkedIn export, the facts you confirm, your resumes and their revisions."],
                  ["Sensitive answers", "Answers to application questions about work authorization, visa, salary, disability, veteran status, race, gender or similar details, if you give them. They are blanked after the application goes out (see [How long we keep it](#how-long-we-keep-it))."],
                  ["Applications", "Matches and fit scores, drafts, answers, what was sent and where, and a receipt with the employer's confirmation text, with addresses and phone numbers removed."],
                  ["Job tracker", "Roles you track, with your notes, stages and any salary text you add."],
                  ["Forwarded replies", "If you forward employer mail to your Kairos address: sender, subject, date and the text of the message, cut at 16 KB. Attachments are not kept."],
                  ["Billing", "Your plan, renewal dates, Stripe customer and subscription ids, and a ledger of every credit in or out."],
                  ["Contact form", "Your name, email address, topic and message."],
                  ["Newsletter", "See [Newsletter](#newsletter)."],
                  ["Device and connection", "The IP address and browser user agent stored with each signed-in session. Your IP address also drives short-lived rate limit counters and can appear in server logs."],
                ],
              },
            },
          ],
        },
        {
          heading: "What we do not collect",
          body: [
            {
              list: [
                "Card numbers. You pay on Stripe's own pages, and Stripe holds your card details.",
                "Analytics or advertising data. The site loads no analytics, advertising or tracking scripts ([cookie policy](/cookies)).",
                "Email opens or clicks. Our mail provider's open and link tracking is switched off.",
                "Attachments on forwarded mail.",
              ],
            },
          ],
        },
        {
          heading: "How we use it",
          body: [
            "We use your data to find and score jobs for you, prepare the applications you ask for, send the ones you approve, show you their outcomes, sign you in, take payment, answer you, and keep the service secure and within its limits.",
            "We do not sell your data, do not use it for advertising, and do not use it to train AI models.",
            "Fit scores decide which postings reach your matches, and a posting below the bar may not be shown to you. Only you decide what is sent.",
          ],
        },
        {
          heading: "AI processing",
          body: [
            "We use Anthropic's Claude models through their API to read resumes, score fit, and draft resume lines, cover letters and answers. The text they receive includes your resume content, confirmed facts, a summary of your search and the job posting.",
            "Before text goes to a model we remove contact details and lines with sensitive personal details. Answers to sensitive questions are never sent to a model, and forwarded replies are sorted by rules, not by a model. The removal works on patterns, so something unusual can get through.",
            "We keep a record of each model call under a keyed hash: the agent, tokens and cost, with no content.",
          ],
        },
        {
          heading: "Who receives it",
          body: [
            "**Employers.** When you approve an application, the employer and its application system (Greenhouse, Lever or Ashby) receive what the form asks for, including your resume. They handle it under their own policies.",
            "**Providers that run the service.** Each one receives only what its job needs:",
            {
              table: {
                caption: "Third-party providers that process data for Kairos",
                head: ["Provider", "Job", "What it handles"],
                rows: [
                  ["[Vercel](https://vercel.com/legal/privacy-policy)", "Website hosting", "Web requests, including your IP address"],
                  ["[Railway](https://railway.com/legal/privacy)", "Servers, database, cloud applier", "All account and application data"],
                  ["[Cloudflare R2](https://www.cloudflare.com/privacypolicy/)", "File storage", "Resume files, rendered PDFs, encrypted backups"],
                  ["[Anthropic](https://www.anthropic.com/legal/privacy)", "AI models", "The redacted text described above"],
                  ["[Postmark](https://postmarkapp.com/privacy-policy)", "Email in and out", "Your email address, codes, messages and forwarded replies"],
                  ["[Stripe](https://stripe.com/privacy)", "Payments", "Your email, billing details and invoices"],
                  ["[Sentry](https://sentry.io/privacy/)", "Error reports", "Error details under a hashed user id, with bodies, cookies and query strings removed"],
                  ["[Google](https://policies.google.com/privacy)", "Optional sign-in", "Sign-in details, only if you choose Google"],
                ],
              },
            },
            "We may also disclose data if the law requires it.",
          ],
        },
        {
          heading: "Newsletter",
          body: [
            "If you sign up for the newsletter we store your email address, which form you used, and when you asked, confirmed and unsubscribed. We use it only to send the newsletter. We do not store your IP address or user agent with the sign-up, though a rate limit counts requests per IP address for up to an hour.",
            "We email you a link to confirm, and you are not subscribed until you press the button on the confirm page. Every issue has a link to unsubscribe in one click.",
            "Sign-ups that were never confirmed are deleted 30 days after the last confirm email was requested, and unsubscribed sign-ups 30 days after you unsubscribe. Confirmed sign-ups stay until you unsubscribe or delete an account on that address.",
          ],
        },
        {
          heading: "How long we keep it",
          body: [
            "Most data stays until you delete your account. These periods are shorter:",
            {
              table: {
                caption: "Retention periods by type of data",
                head: ["Data", "Kept for"],
                rows: [
                  ["Sensitive answers in an application", "Blanked 7 days after it is submitted or withdrawn"],
                  ["Uploaded resume files", "Deleted with your account. Our target is 30 days after upload. The extracted text stays, encrypted, until you delete it"],
                  ["Rendered resume PDFs", "Deleted with your account. Our target is 30 days, then rendered again if needed"],
                  ["Text of forwarded replies", "180 days. Sender, subject and date stay with the account"],
                  ["Matches below the fit bar", "30 days"],
                  ["Contact form messages", "12 months, or until you delete an account on that address. A copy also reaches our support mailbox"],
                  ["Sign-in sessions", "30 days from last use, and at most your 20 latest"],
                  ["Sign-in codes", "10 minutes"],
                  ["Model call records", "90 days"],
                  ["Email send records", "120 days"],
                  ["In-app notifications", "90 days"],
                ],
              },
            },
          ],
        },
        {
          heading: "Deleting your account",
          body: [
            "Delete your account under Settings at any time. Your subscription is cancelled first. Your account, profile, resumes, facts, applications, tracker, replies and contact messages are then deleted from the live database at once, and your stored files and Stripe customer record follow, normally within minutes. If you cannot sign in, write to us from the account's address.",
            "We aim to clear deleted data from our live systems within 24 hours. It can stay longer in encrypted backups and at our providers, where our target is 45 days. A restored backup is cleaned again before use.",
            "A few records remain after deletion, none with your name or address in readable form:",
            {
              list: [
                "your credit ledger, kept for the books under a keyed hash;",
                "a keyed hash of your email address, so that address cannot take a second free grant;",
                "if you complained about or bounced our email, a one-way hash of your address, only so we never email it again;",
                "a record that the deletion happened, and operator audit rows with any id replaced by a pseudonym;",
                "invoices at Stripe, which Stripe keeps as its own records.",
              ],
            },
          ],
        },
        {
          heading: "Your rights",
          body: [
            "You can see and correct your data in the app. You can delete your account yourself. To get a copy of your data, write to " + support + " from your account's address; we prepare the export by hand and aim to answer within 30 days. Use the same address to object to something we do, or to ask us to limit it.",
            "Depending on where you live, the law may give you more rights, including complaining to your data protection authority. We will not treat you differently for using them.",
          ],
        },
        {
          heading: "Where data is processed",
          body: [
            "Our providers may process data outside your country, including in the United States. Applicants in India, the EU and elsewhere should expect their data to cross borders.",
          ],
        },
        {
          heading: "Security",
          body: [
            "In production, traffic uses HTTPS and sign-in cookies are marked secure. The text extracted from an imported resume is encrypted with AES-256-GCM before it is stored; other data relies on the access controls of our database and storage providers. Passwords and sign-in codes are stored hashed, and OAuth tokens encrypted. Files sit in private buckets, each with its own access key, and backups are encrypted. Logs and error reports are set up to leave out request bodies and free text.",
            "No system is perfectly secure. Keep your sign-in details safe, and tell us at once if you think your account has been used by someone else.",
          ],
        },
        {
          heading: "Children",
          body: [
            `${name} is a tool for people applying for jobs and is not aimed at children. We do not check age at sign-up. If you believe a child has created an account, write to us and we will delete it.`,
          ],
        },
        {
          heading: "Cookies",
          body: ["We use a sign-in cookie and a few browser storage items, and no analytics. The [cookie policy](/cookies) lists each one."],
        },
        refundSection,
        {
          heading: "Changes to this policy",
          body: ["When we change this policy we will post the new version here with a new date. We record which version you saw when you signed up."],
        },
        {
          heading: "Contact",
          body: [`Write to ${support} or use the [contact form](/contact). We have not yet named a data protection or grievance officer, so these reach the team directly.`],
        },
      ]}
    />
  );
}
