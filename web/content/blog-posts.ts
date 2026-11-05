// Blog posts for /blog. MKT-content owns this file; web/lib/blog.ts reads it and adds readingMinutes.
// Every product claim here was checked against server/src and shared/src on 2026-11-05. Reasoning that is
// judgment rather than product fact is written as reasoning. No statistics, quotes or customer stories.
// Banned characters (house style): em dash, en dash.
// Titles, summaries, dates, categories and paintings live in blog-meta.ts, so a client list can link to a post without
// shipping the articles. This file is server only in practice: import it through lib/blog.ts.

import { postMeta, type PostMeta } from "./blog-meta";

export interface PostSection {
  heading?: string;
  body: string[];
  list?: string[];
}

/** The sentence set large in the article. Words copied exactly from the post (test/blog.test.ts); shown after section `after`. */
export interface PullQuote {
  after: number;
  text: string;
}

interface PostBody {
  pull: PullQuote;
  sections: PostSection[];
}

export interface PostDraft extends PostMeta, PostBody {}

const bodies: Record<string, PostBody> = {
  "what-a-credit-pays-for": {
    pull: {
      after: 1,
      text: "A failed send is never charged.",
    },
    sections: [
      {
        heading: "One credit, one submitted application",
        body: [
          "Kairos charges one credit when the extension or the cloud applier reports that an application was submitted. The charge is a single ledger row tied to that application, and a database rule stops a second row for the same application. If the same report arrives twice, you are charged once.",
          "A submitted application also keeps a receipt: the fields that were filled and the confirmation text the employer's page showed, with contact details, such as email addresses, phone numbers and links, removed from that text.",
        ],
      },
      {
        heading: "What does not spend a credit",
        body: [
          "Finding matches, scoring them, preparing a draft, editing it and withdrawing it write no charge. The only code that writes to the credit ledger is the grant, charge and refund logic in the credits service, and a charge happens only on a submitted report.",
          "A failed send is never charged. When the applier cannot finish, the application is marked failed with a reason, and the reason says so in plain words. These are messages the cloud applier stores, shown as written:",
        ],
        list: [
          "The posting has closed: \"Nothing was sent and no credit was used.\"",
          "A required question had no answer: \"nothing was sent and no credit was used. Fill it in, then resend.\"",
          "The employer's site asked for a human check: the cloud applier stops, nothing is sent, and you can send it from the extension.",
        ],
      },
      {
        heading: "The case where Kairos is not sure",
        body: [
          "Sometimes a click goes out and the confirmation never loads. Kairos cannot tell whether the employer received it, so it does not resend on its own and does not charge. The message reads: \"We could not confirm whether the employer received this application. No credit was used. Check your email for the employer's confirmation before you resend.\"",
          "So no credit is used, even if the employer did get the application. Check your inbox before you send again, so the same job does not get two copies.",
        ],
      },
      {
        heading: "Approval reserves credits",
        body: [
          "Your available credits are your balance minus the applications you have approved that have not finished sending. When you approve, Kairos checks that number inside one locked transaction. If you approve more drafts than you have credits for, the whole approval is refused with a message such as \"You have 3 credits left for 5 applications\", and nothing moves.",
          "Because the reservation counts approved and sending applications, two browser tabs cannot approve against the same balance. If a send fails, the reservation lifts and the credit is free again.",
          "Say you are on the Free plan with 25 credits and you approve four drafts. Your balance is still 25, but four are in flight, so you have 21 available. Three applications report submitted: the balance drops to 22, one is still in flight, and 21 are available. The fourth fails because the posting closed. It leaves the in-flight count, the balance stays at 22, and you have 22 available.",
          "At no point was a credit charged for the failed send, and at no point could you have approved more drafts than the balance allowed.",
        ],
      },
      {
        heading: "Why nothing sends before you approve",
        body: [
          "A draft only becomes sendable when it has resume lines and answers, and only you move it from draft to approved. The cloud applier claims applications that are already approved, and a submission report for an application that is neither approved nor sending is rejected. There is no route from a draft to an employer's form that skips your approval.",
          "The Free plan gives 25 submitted applications, once. Paid plans are sized per 30 days: a monthly invoice grants 1,000 credits on Starter, 1,200 on Pro and 3,000 on Max. A weekly invoice grants a week's share of that amount and a quarterly invoice grants three months. The pricing page lists current prices.",
        ],
      },
    ],
  },
  "us-roles-from-india-location-and-sponsorship-rules": {
    pull: {
      after: 1,
      text: "Kairos does not give immigration advice, and the filter is not a legal check.",
    },
    sections: [
      {
        heading: "Location is a text match",
        body: [
          "Kairos has no field for where you live and does not filter on time zone. It has a list of places you would work, plus a switch for remote jobs. A posting passes the location rule when any of these is true: you allow remote and the posting is remote, your list is empty, or one of your entries appears inside the posting's location text.",
          "That last rule is plain text matching, ignoring case. An entry of \"United States\" passes a posting whose location says \"New York, United States\" and fails one that says \"New York, NY\". Entries such as \"New York\" or \"Austin\" are safer. A posting with no location text cannot match a list at all, and only gets through if it is remote and you allow remote.",
          "The reason you will see on a posting that fails is \"Location is outside your list\".",
        ],
      },
      {
        heading: "Sponsorship is a phrase filter",
        body: [
          "If you pick \"Need visa sponsorship now\" or \"Will need sponsorship later\" as your work authorization, Kairos skips postings whose description says things like \"unable to sponsor\", \"cannot sponsor\", \"no visa sponsorship\" or \"must be a U.S. citizen\". It reads wording and nothing else. A posting that says nothing about sponsorship passes, and so does wording the list does not cover, such as \"we do not offer visa support\".",
          "Whether an employer can hire someone who lives abroad, or sponsor a visa, is a question for that employer and for an immigration attorney. Kairos does not give immigration advice, and the filter is not a legal check.",
        ],
      },
      {
        heading: "A setup to start from",
        body: [
          "Say you are in India, looking for backend roles at US companies, and you need sponsorship. One reasonable first setup: list your roles as separate lines, leave the location list empty or fill it with the US cities you would accept, turn remote on, and set work authorization to \"Need visa sponsorship now\".",
          "With an empty list, location never rejects a posting. With remote on, a remote posting passes even when it is outside a list you did fill in. The role, seniority, salary, company and keyword rules still apply, and so does the cap of two applications per company in 30 days.",
          "Run it for a few days, then read your matches. If too many postings are wrong for you, tighten a rule. If the list is empty, loosen one.",
        ],
      },
      {
        heading: "Reading a fit score",
        body: [
          "Postings that pass every rule go to a model, which reads the posting against your confirmed facts and returns a score from 0 to 100 with one to four short reasons. It sees only facts you confirmed.",
          "Your fit bar decides what reaches you. It starts at 75 and you can set it anywhere from 50 to 95. A posting scored below the bar is not shown to you, so a higher bar means fewer matches, each a closer fit.",
          "Treat the score as one model's judgment of how your facts line up with the posting. It is not a chance of getting hired. The reasons are the useful part: they name what lined up and what did not, so you can decide whether a 78 is worth a draft or a 91 hides a gap you care about.",
        ],
      },
      {
        heading: "What happens after a match",
        body: [
          "A match becomes a draft only when you ask for one. The draft's resume lines come from your confirmed facts, and nothing is sent until you approve it. The extension fills the employer's own form in your browser, on Greenhouse, Lever or Ashby, and we do not automate LinkedIn.",
          "The Free plan includes 25 submitted applications, so you can test your location and sponsorship settings on real postings before paying for anything.",
        ],
      },
    ],
  },
  "setting-search-rules-after-a-layoff": {
    pull: {
      after: 3,
      text: "A role list that is too literal is a common cause after a layoff, when the titles you would accept are wider than the ones you first typed.",
    },
    sections: [
      {
        heading: "Roles match on title words",
        body: [
          "Each role you list can be up to 80 characters, and you can list ten. A posting's title has to contain every word of at least one role. Words of two letters or fewer are ignored. So \"Software Engineer\" matches \"Senior Software Engineer II\" and does not match \"Backend Developer\".",
          "After a layoff the useful move is to list every title you would take as its own line: \"Backend Engineer\", \"Platform Engineer\", \"Software Engineer\". A posting that fails gets the reason \"Title does not match your roles\".",
        ],
      },
      {
        heading: "Seniority is narrower than it looks",
        body: [
          "You can pick any of intern, entry, mid, senior and lead. The title rule only acts in two cases. If you pick only intern and entry, titles containing words like senior, staff, principal, lead, head of, director, VP or manager are set aside. If you pick only senior and lead, titles containing junior, entry, new grad, graduate, associate or intern are set aside.",
          "Pick a mix, or include mid, and no title is dropped on seniority. The fit score then judges level from the posting text. If you were senior and want senior or above, tick only those two and the title rule will work for you.",
        ],
      },
      {
        heading: "Salary, places and keywords",
        body: [
          "The salary floor compares your number with the top of the pay range a posting lists. If the top is below your floor, the posting is set aside. A posting with no salary listed passes, because there is nothing to compare.",
          "Company excludes match the exact company name, ignoring case. Keyword excludes match anywhere in the title or description, ignoring case, so a keyword like \"clearance\" drops every posting that mentions it, including one that says no clearance is needed. Choose keywords with that in mind.",
        ],
      },
      {
        heading: "Reading a set-aside reason",
        body: [
          "Postings Kairos finds on its own that fail a rule are not stored or shown, and they cost no model call. You see a failure when you paste a job link yourself: the posting is saved as skipped, and its card lists every rule it failed under \"Why it was set aside\". The reasons are fixed sentences, listed below.",
          "If a reason matches what you meant, leave the posting skipped. If it does not, change the rule in Preferences. A role list that is too literal is a common cause after a layoff, when the titles you would accept are wider than the ones you first typed.",
        ],
        list: [
          "Title does not match your roles",
          "Title is more senior than you asked for",
          "Title is more junior than you asked for",
          "Location is outside your list",
          "Company is on your exclude list",
          "Mentions excluded keyword \"...\"",
          "Posted salary is below your floor",
          "Posting says it does not sponsor visas",
          "You hit your per-company limit for the last 30 days",
        ],
      },
      {
        heading: "A rule set worth starting from",
        body: [
          "Say you were a senior backend engineer and you want senior or lead roles. List \"Backend Engineer\", \"Platform Engineer\" and \"Software Engineer\" as three roles. Tick senior and lead only. Turn remote on and list the cities you would work in. Add a salary floor if you have a number in mind. Add your former employer's name under excluded companies, spelled exactly as it appears on postings, since \"Acme\" will not match \"Acme Inc.\".",
          "Then look at the fit bar. It starts at 75. Postings that pass every rule above are scored against your confirmed facts, and only those at or above the bar reach your matches. If your matches are mostly near misses, raise the bar. If you see almost nothing, lower it a little before you loosen the rules.",
        ],
      },
    ],
  },
  "opt-job-search-sponsorship-filter": {
    pull: {
      after: 1,
      text: "The filter saves you reading postings that say no. It does not tell you whether a yes is safe to rely on.",
    },
    sections: [
      {
        heading: "Turning it on",
        body: [
          "In Preferences, work authorization has four options: citizen or permanent resident, need visa sponsorship now, will need sponsorship later, and on OPT or STEM OPT. The last three switch the sponsorship filter on, and they all behave the same way. The first does not. Pick the option closest to your status; what that status allows is a question for your advisor, not for this setting.",
          "The filter is one of the rules that run before any model reads a posting, so a posting it removes costs nothing to score. Postings Kairos finds on its own that trip the filter are dropped and not shown. If you paste a link to a posting yourself, it is saved as skipped and its card lists the reason under \"Why it was set aside\", so you can check what the filter read.",
        ],
      },
      {
        heading: "What it matches",
        body: [
          "Kairos searches the posting's description for a short list of phrases. A posting that says \"We are unable to sponsor work visas at this time\" is set aside with the reason \"Posting says it does not sponsor visas\". So is one that says \"Candidates must be a U.S. citizen\". These are the phrases:",
        ],
        list: [
          "\"unable to sponsor\"",
          "\"not sponsor\" or \"not able to sponsor\"",
          "\"cannot sponsor\" or \"can't sponsor\"",
          "\"no sponsorship\" or \"no visa sponsorship\"",
          "\"sponsorship is not available\"",
          "\"must be a citizen\" or \"must be a U.S. citizen\"",
        ],
      },
      {
        heading: "What else a new grad should set",
        body: [
          "The filter works alongside the other rules, and for a new grad the seniority rule matters most. Pick intern and entry only, and titles containing senior, staff, principal, lead, head of, director, VP or manager are set aside. List each role you would take as its own line, because a posting's title must contain every word of at least one of them.",
          "The default fit bar is 75. Postings that pass every rule are scored against your confirmed facts, and only those at or above the bar reach you. The default cap is two applications per company in 30 days, which you can raise to five.",
          "Employer forms often ask whether you need sponsorship or what your work authorization is. Kairos does not let its AI draft helper write answers to questions about visas, sponsorship or work authorization. You review and answer those in the draft yourself, and nothing is sent until you approve it.",
        ],
      },
      {
        heading: "What the filter cannot know",
        body: [
          "The filter reads words. A posting that says \"We do not offer visa support\" passes, because that wording is not on the list, and so does a posting that never mentions sponsorship. A silent posting tells you nothing about whether the employer sponsors, or hires people on OPT or STEM OPT, and the filter lets it through. For wording the list misses, add a keyword exclude, such as a phrase you keep seeing, and Kairos will drop any posting that mentions it.",
          "Treat the filter as a time saver. It spares you postings that say no in plain words, and it makes no promise about the postings that remain.",
          "Kairos does not give immigration advice. Questions about what your status allows, or what an employer must do for you, belong with your school's international student office or an immigration attorney. The filter saves you reading postings that say no. It does not tell you whether a yes is safe to rely on.",
        ],
      },
    ],
  },
  "why-we-cap-applications-per-company": {
    pull: {
      after: 3,
      text: "We cannot see how any employer reads applications, so the default is a judgment and not a measurement.",
    },
    sections: [
      {
        heading: "What the cap does",
        body: [
          "The default is two applications per company in any 30 days. In Preferences it is called the per-company cap, and you can set it anywhere from one to five.",
          "The 30 days are a rolling window, not a calendar month. Kairos counts the applications you have for that company that were created in the last 30 days, whatever their status. A draft you withdraw still counts, so a slot is used when a draft is created, not when it is sent.",
        ],
      },
      {
        heading: "Where it runs",
        body: [
          "The cap is one of the rules checked before any model reads a posting. When a new posting arrives from a company where you are at your cap, it is not scored and does not reach your matches. Because the check comes first, it costs no model call.",
          "If you paste a link to a posting from such a company, it is saved as skipped with the reason \"You hit your per-company limit for the last 30 days\".",
        ],
      },
      {
        heading: "A worked example",
        body: [
          "Say you create a draft for a company on day 1 and another on day 9, with the default cap of two. From day 9 on, new postings from that company are not scored for you. On day 31 the first draft's creation date falls out of the 30-day window, the count drops to one, and the company's new postings are scored again.",
          "With the cap set to three, postings from that company would keep coming through after day 9, and the block would start only once a third application existed.",
        ],
      },
      {
        heading: "Why two",
        body: [
          "We cannot see how any employer reads applications, so the default is a judgment and not a measurement. Two is the smallest number that still lets you try a second role at a company you like. One would block that, and five would let a single company fill your queue. The reasoning is simple. If four of your applications reach one company in a week, whoever reads them sees the same name four times. Two applications to the roles you fit best say more about you than four sent to every role a title filter lets through.",
          "The cap is a hard rule and not a score because it is arithmetic. Kairos can count your applications to a company exactly, so there is nothing for a model to judge, and a rule that costs nothing to run can be applied to every posting.",
        ],
      },
      {
        heading: "When to raise it",
        body: [
          "Raise the cap if a company has several openings you fit. A company hiring for three roles on one team is a different case from a company with one general opening. Set it to three, four or five and Kairos keeps the same checks: the rules, then the fit bar, then your approval.",
          "Lower it to one if you want to pick the single best role at each company yourself. The fit bar works alongside the cap. Only postings at or above your bar reach your matches, so the slots are not used up on weak matches. The cap does not rank anything: slots are taken in the order you create applications, not by score.",
        ],
      },
    ],
  },
  "how-the-truth-lock-works": {
    pull: {
      after: 2,
      text: "A false rejection costs you an edit. A false acceptance would send an invented claim to an employer.",
    },
    sections: [
      {
        heading: "It starts with facts you confirm",
        body: [
          "When you upload a resume, Kairos splits it into facts: roles, projects, skills, metrics, education and certifications. You review the facts and confirm the ones that are true. You can also add a fact yourself on your profile page.",
          "An unconfirmed fact is never used. Fit scoring reads only confirmed facts, tailoring is given only confirmed facts, and so is the check described below. The resume writer can propose a note that becomes a new fact, but that fact stays unconfirmed, and cannot reach a draft, until you confirm it.",
        ],
      },
      {
        heading: "What the check looks at",
        body: [
          "The tailoring model has to list, for each line it writes, the ids of the facts the line uses. Kairos then checks the line without asking a model. It looks for three things:",
        ],
        list: [
          "The line cites at least one fact.",
          "Every cited fact is yours and is confirmed.",
          "Every number, job title, company or product name, skill, link, email address and phone number in the line appears in the text of the cited facts.",
        ],
      },
      {
        heading: "What it catches",
        body: [
          "Say your confirmed fact reads \"Cut report build time from 40 minutes to 12 with a nightly cache.\" A line that says \"Cut report build time from 40 to 12 minutes\" passes, since both numbers are in the fact. A line that says \"Cut report build time by 70%\" fails, because 70 is not in the fact. The same goes for a skill the fact never mentions, a title such as senior or director, a company name, or an email, phone number or link that is not in the fact.",
          "The check is strict on purpose. A false rejection costs you an edit. A false acceptance would send an invented claim to an employer. It is also plain code that runs after the model, not a request to the model, so it does not depend on the model behaving. Contact details are kept away from the model when it tailors a resume.",
        ],
      },
      {
        heading: "What happens to a line that fails",
        body: [
          "There are two paths. When the model drafts a tailored resume for a job, any line that fails is left out before the draft is stored. You see the lines that passed.",
          "When you edit, the check runs again on save. If any line fails, the save is refused and nothing is stored. The editor marks the lines and lists them so you can reword each one to match its fact, or remove it.",
        ],
      },
      {
        heading: "Where it stops",
        body: [
          "The lock shows that a line rests on facts you confirmed. It cannot tell whether a fact is true. If you confirm a fact that is wrong, a line built on it will pass, so confirm carefully.",
          "Cover letters are checked too. A paragraph the model drafts must cite facts and is checked against those facts. When you edit a letter, each paragraph is checked against all of your confirmed facts, with the company name and your own name allowed. Form answers from your profile and from saved answers you approved do not go through this check, while an answer the model drafts does.",
          "Before you approve, the editor shows each resume line beside the facts it cites, under \"Facts these lines cite\". Read a line against its source there. Nothing is sent until you approve the application.",
        ],
      },
    ],
  },
};

/** Newest first, the order of content/blog-meta.ts. */
export const postDrafts: PostDraft[] = postMeta.map((meta) => ({ ...meta, ...bodies[meta.slug] }));
