import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { refundSection } from "@/content/legal-refund";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms for using Kairos: your approval, AI drafts, credits, billing, refunds and cancellation.",
  alternates: { canonical: "/terms" },
};

const { name, company, supportEmail } = siteConfig;
const support = `[${supportEmail}](mailto:${supportEmail})`;

export default function TermsPage() {
  return (
    <LegalDocument
      path="/terms"
      title="Terms of service"
      updated="2026-11-05"
      intro={`These terms cover your use of ${name}, operated by ${company}.`}
      sections={[
        {
          heading: "Agreeing to these terms",
          body: [
            `By creating an account or using ${name} you agree to these terms and to the [privacy policy](/privacy). If you do not agree, do not use ${name}. We record which version you agreed to and when.`,
          ],
        },
        {
          heading: "What Kairos does",
          body: [
            `${name} is a job application agent. It reads public postings on Greenhouse, Lever and Ashby, scores how well each one fits you, and prepares a draft application from your resume and the facts you confirmed. It sends only the applications you approve.`,
            `${name} does not apply through other job sites, and it does not guarantee that any employer will read, answer or accept an application.`,
          ],
        },
        {
          heading: "Your account",
          body: [
            "You can sign up with an email address and password, confirmed by a code we send you, or with Google where we offer it. Keep your sign-in details to yourself, and write to us if you think someone else has used your account.",
            "An account is for one person looking for their own job. You must be old enough to make this agreement and to apply for work where you live.",
          ],
        },
        {
          heading: "Your approval",
          body: [
            `Nothing is sent to an employer without your approval. ${name} prepares a draft, and the draft waits in your review queue until you approve it. You can edit a draft first, and you can withdraw an application while it is a draft or approved but not yet sent.`,
            "Once you approve, the application is sent in one of two ways, which you choose:",
            {
              list: [
                "**The Chrome extension** opens the employer's form in your browser and fills it. It either sends the form or leaves it for you to check and send yourself.",
                "**The cloud applier** fills and sends the form from our servers, so your browser can be closed. It is in beta, it is for Pro and Max plans, and it may not be open to your account yet.",
              ],
            },
            "An approved application goes out under your name, with the details you gave us. You are responsible for every application you approve.",
          ],
        },
        {
          heading: "AI drafts are yours to review",
          body: [
            `${name} uses AI models from Anthropic to read resumes, score fit and write draft text such as resume lines, cover letters and answers. AI output can be wrong, can miss the point of a question, and can read badly. Check every draft before you approve it.`,
            `${name} has safeguards, and they do not replace your review. Tailored resume lines must cite a fact you confirmed: lines without a valid citation are dropped from a draft, and an edit that adds one is refused until you cite or remove it. Questions about visa status, salary, disability, race, gender or similar personal details, and questions your profile answers, are not drafted by AI. These checks work on patterns and can miss something.`,
          ],
        },
        {
          heading: "Your facts and content",
          body: [
            `Your resume, facts, answers and drafts stay yours. You allow us to store and process them to run ${name}, to share them with the providers listed in the [privacy policy](/privacy), and to send them to the employers you approve. We do not use them to train AI models.`,
            "You must have the right to share what you upload, and the facts you confirm must be true. AI-written text may not be protected by copyright in every country.",
          ],
        },
        {
          heading: "Acceptable use",
          body: [
            `You may not use ${name} to:`,
            {
              list: [
                "apply on behalf of someone else, or under a name that is not yours;",
                "submit false information, or apply for roles you are not entitled to apply for;",
                "send applications to an employer who has asked not to receive automated submissions;",
                "get around credit limits, usage limits, rate limits or the free grant, for example with repeated accounts;",
                "attack, probe, scrape or overload the service, or reverse engineer it.",
              ],
            },
            "We may refuse, pause or close an account that breaks these rules.",
          ],
        },
        {
          heading: "Plans and credits",
          body: [
            "The [pricing page](/pricing) lists each plan's price, credits and features. The Free plan gives 25 credits once. A new account on an address that belonged to a deleted account gets no second free grant.",
            "One credit pays for one application that goes through (see [Refunds](#refunds)). A paid invoice adds its credits to your balance, and a credit is held while an application is approved or being sent. Finding matches and preparing drafts use no credits, though AI features have daily limits that depend on your plan.",
            "Unused credits stay on your balance when a new invoice is paid. If we ever limit this, we will tell you first, and each removal will appear in your credit ledger on the Billing page.",
          ],
        },
        {
          heading: "Billing",
          body: [
            "Paid plans renew each week, month or quarter, whichever you chose, until you cancel. Stripe takes the payment, in US dollars, and holds your card details. Any tax we collect is added at checkout and shown before you pay. There is no trial period on paid plans.",
            "You can change plan or cancel from the Billing page, which opens Stripe's customer portal. If a renewal fails, Stripe retries the card and you keep your plan for 7 days. After that you have the Free plan's features until the payment goes through, when your plan comes back.",
            "Refunds and what cancelling does are covered in [Refunds](#refunds), below. There is no separate refund policy.",
          ],
        },
        refundSection,
        {
          heading: "Ending your use",
          body: [
            "You can stop at any time. Cancelling your plan keeps your account on the Free plan. Deleting your account, under Settings, removes your data as the [privacy policy](/privacy) describes, and that cannot be undone.",
            "If we close your account for breaking these terms, we will cancel any subscription with it. The parts of these terms that by their nature should last, such as the limits on liability, still apply.",
          ],
        },
        {
          heading: "Employers and other services",
          body: [
            `Employers decide how they review applications, and what they do with one is up to them and their own policies. Job boards and application systems have their own terms, and ${name} does not control them. Stripe and Google have their own terms for the parts of the service they run.`,
          ],
        },
        {
          heading: "Availability",
          body: [
            `We try to keep ${name} running but do not promise that it will always be available or free of errors. Parts of it may be paused, including approvals and the cloud applier, for example when an employer's form changes or we are checking a problem. Features and plans may change.`,
          ],
        },
        {
          heading: "No guarantees and liability",
          body: [
            `We do not guarantee interviews, offers, or that an application will reach an employer. ${name} is provided as it is, without promises beyond those in these terms, and we are not responsible for what an employer decides or for what you approve.`,
            "As far as the law allows, we are not liable for indirect or consequential loss. Some places do not allow these limits, so they may not apply to you, and nothing here removes rights the law does not let us remove.",
          ],
        },
        {
          heading: "Changes to these terms",
          body: [
            `When we change these terms we will post the new version here with a new date. If you keep using ${name} after that, the new version applies to you.`,
          ],
        },
        {
          heading: "Governing law",
          body: [
            "This draft does not yet name a governing law or the courts for a dispute. Counsel will set them before these terms are final. The laws that protect you where you live apply in any case.",
          ],
        },
        {
          heading: "Contact",
          body: [`Questions about these terms, including copyright complaints, go to ${support} or the [contact form](/contact).`],
        },
      ]}
    />
  );
}
