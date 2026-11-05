// Kairos landing copy (light rebuild). Source: docs/superpowers/specs/2026-10-15-kairos-landing-design/
// 08-restructure-plan.md sections 1, 5 and 6, with the 09 section 9 changes applied.
// Placeholders in braces ({approvedTime}, {id}, ...) are filled at runtime or build time.
// Gate G3 is applied as "(in beta)" wording where 08 names a gated variant.
// Prices, allowances and plan names are NOT here: they are read from shared/src/plans.ts (P3).
// Pills marked "optional" are dropped by 09 section 9 item 12 unless the owner confirms them.
// Banned characters: em dash, en dash. Allowed: middle dot, minus sign (U+2212), multiplication sign.

export const landingCopy = {
  // 08 1.1. Links are the first three siteConfig.publicNav entries; hrefs come from config.
  nav: {
    logoAria: "Kairos, home",
    wordmark: "Kairos",
    links: ["How it works", "Pricing", "Blog"],
    login: "Log in",
    startFree: "Start free",
    menuButton: "Menu",
    menuButtonClose: "Close menu",
    sheetTitle: "Site menu",
    sheetStartFree: "Start free",
    skipMain: "Skip to main content", // target #main
    skipPricing: "Skip to pricing", // target #pricing
    motionToggle: "Reduce motion", // compact toggle in the menu sheet
  },

  // 08 1.2 and the SEO strings kept from Drop 1. url, email come from siteConfig.
  meta: {
    title: "Kairos: job applications you would sign",
    description:
      "Kairos finds jobs that fit, tailors your resume from facts you confirmed, and sends only the applications you approve.",
    ogTitle: "Job applications you would sign.",
    ogDescription:
      "Kairos finds roles that fit, tailors your resume only from facts you confirmed, and sends nothing until you approve it. Every submitted application comes with a receipt.",
    ogImageAlt:
      "A light painted valley at dawn under the headline Job applications you would sign, with a sample match card.",
    ogSiteName: "Kairos",
    twitterCard: "summary_large_image",
    orgJsonLd: {
      name: "Kairos",
      legalName: "Gray Matter Labs",
    },
  },

  // 08 1.2 and 5. Copy 30 words, card 10.
  hero: {
    pill: "25 free applications",
    h1: "Job applications you would sign.", // hard break after "applications" is a layout choice
    subline:
      "Kairos finds jobs that fit, writes only from facts you confirmed, and sends nothing until you approve.",
    cta: "Start with 25 free applications", // links to /sign-up
    card: {
      sampleChip: "SAMPLE",
      title: "Software Engineer · Company 014",
      fit: "Fit 82",
      fitTail: "passes your rules",
    },
    // Landing v3 side card at the window's right: a later step of the same story. Synthetic company.
    sent: { title: "Data Analyst · Company 052", word: "Sent", tail: "receipt saved" },
    // Landing v3 app mockup (docs/DESIGN.md "Hero app mockup"). SAMPLE data, synthetic companies. The first row is
    // the draft open in the pane. aria is the whole picture's label: the mockup is one role="img".
    app: {
      aria: "Sample of the Kairos review queue: three drafts wait for approval, and the open draft shows two resume lines, each citing a fact you confirmed. Nothing is sent until you press Approve.",
      title: "Review queue",
      count: "3 drafts waiting",
      status: "Draft",
      rows: [
        { role: "Backend Engineer", company: "Company 109 · Remote", fit: "Fit 86" },
        { role: "Platform Engineer", company: "Company 031 · Hybrid", fit: "Fit 79" },
        { role: "Data Engineer", company: "Company 077 · Remote", fit: "Fit 74" },
      ],
      label: "Tailored resume",
      lines: [
        { text: "Led the move of the payments API to an event queue.", cites: "cites #03" },
        { text: "Wrote the on-call runbook the team still uses.", cites: "cites #07" },
      ],
      approve: "Approve",
    },
  },

  // 08 1.3. Plain text, no logos. caption, items and trailing are shared with /how-it-works (AtsHub); label, h2 and
  // subline are the landing intro (docs/DESIGN.md "Landing v3 mid-page chapter" > "1. Where it applies").
  strip: {
    label: "Where it applies",
    h2: "Through the employer's own career page.",
    subline: "Kairos fills the Greenhouse, Lever or Ashby form with your details and the answers you approved.",
    caption: "Applies through employer career pages on",
    items: ["Greenhouse", "Lever", "Ashby"],
    trailing: "We do not automate LinkedIn.",
  },

  // Landing v3 mid-page chapter, "What goes wrong" (docs/DESIGN.md "Landing v3 mid-page chapter" > 2): what people
  // report about other auto-apply tools, drawn as the clock rail those tools send on. Panel slips read sample.skipped[0]
  // and sample.uncited; the Data Clerk slip is the panel's own. The items carry the meaning; the panel is aria-hidden.
  problems: {
    pill: "Reported, not measured",
    h2: "What people report about auto-apply tools.",
    subline: "Each one is a check Kairos runs before anything is sent.",
    items: [
      { title: "Poor matches", body: "Applications sent to jobs that do not fit." },
      { title: "Invented resumes", body: "Skills the person does not have." },
      { title: "No edit step", body: "A draft you cannot change." },
    ],
    panel: {
      head: "Sent today",
      outside: "Outside your rules",
      noFact: "No fact behind this",
      clerk: "Data Clerk · Company 212",
      edit: "Edit",
      unread: "Sent before you read it",
    },
  },

  // Landing v3 mid-page chapter, the signature (docs/DESIGN.md "3. The three checks"). The held sheet reads
  // hero.app.rows[0], hero.app.lines and `sample`; only its own labels live here. stageAria is the stage's one label.
  steps: {
    label: "How it works",
    h2: "Three checks before anything is sent.",
    subline: "The last check is yours: the application waits, untouched, until you approve it.",
    stageAria:
      "Sample application for Backend Engineer at Company 109 on a writing desk. Two postings that break your rules are struck out and set aside. Two resume lines each cite a fact you confirmed; a third line cites nothing and is marked not saved. The application waits for your approval.",
    cards: [
      { step: "Step 1", line: "Jobs that break your rules are skipped.", body: "Role, location, salary and visa are hard rules, checked before any model runs." },
      { step: "Step 2", line: "Every resume line cites a fact you confirmed.", body: "A line with no confirmed fact behind it is not saved." },
      // `try` points at the Approve button, so it renders only with scripts on (data-requires-js), like the button.
      { step: "Step 3", line: "Sent only after you approve, with a receipt.", try: "Try it on the sample.", body: "Nothing is sent." },
    ],
    sheet: {
      // Step 1 only (shown while the stage is armed, before step 2): the hard rules the held posting passes, ticked.
      // Role and Location values are read from hero.app.rows[0]; Salary and Visa are SAMPLE values.
      rules: { label: "Your rules", names: ["Role", "Location", "Salary", "Visa"], salary: "In your range", visa: "Not needed" },
      label: "Tailored resume",
      noCite: "cites none",
      notSaved: "No fact behind this · not saved",
      confirmed: "Confirmed by you",
      confirmedShort: "Confirmed",
      waiting: "Waiting for your approval",
      approvedBy: "Approved by you",
    },
    approve: {
      idle: "Approve sample",
      pending: "Approving",
      done: "Approved",
      live: "Approved. Sample receipt updated. Nothing was sent.",
      receipt: "See the sample receipt", // links to #features once approved
    },
  },

  // 08 1.6. The only dark surface.
  darkCard: {
    label: "καιρός", // the word itself, rendered with lang="el"
    h2: "Kairos is Greek for the right moment.",
    sub: "You choose it. Nothing is sent until you do.",
    cta: "Start with 25 free applications",
    chip: "Failed submits cost nothing", // dark-glass fact chip beside the button; same fact as pricing
    // SAMPLE timeline of one application beside the copy: the pipeline does its part, then waits for your moment.
    moment: {
      aria: "Sample timeline of one application: matched at 08:12, drafted at 08:14 with every line cited, and now waiting for your approval.",
      title: "Data Engineer · Company 014",
      rows: [
        { time: "08:12", text: "Matched · Fit 82" },
        { time: "08:14", text: "Drafted · every line cited" },
        { time: "Now", text: "Waiting for you" },
      ],
    },
  },

  // 08 1.7. Plan names, taglines, prices, allowances and features are read from shared/src/plans.ts.
  pricing: {
    h2: "Pay for applications that went through.",
    subline: "One credit per submitted application. Bill weekly, monthly or quarterly.",
    intervalLegend: "Billing interval",
    intervals: ["Weekly", "Monthly", "Quarterly"], // default Monthly
    intervalLive: "Showing {interval} prices.",
    intervalWords: ["/week", "/month", "/quarter"],
    freeAllowance: "25 applications, once",
    allowanceLine: "{n} applications", // {n} formatted with thousands separator
    recommended: "Recommended", // never "Most popular": there are no users yet
    included: "What's included",
    ctaFree: "Start free",
    ctaPaid: "Choose {plan}",
    noteFree: "Never expires", // docs/pricing.md: the free grant never expires
    notePaid: "{cost} each at full use", // {cost} = price / credits for the interval, see calculator.ts
    // G3: these features ship with "(in beta)" after their name until confirmed live (08, section spec 10).
    betaTag: "(in beta)",
    betaFeatures: ["Chrome extension apply", "Cloud applier", "Reply tracking"],
    betaTaglines: { pro: "Applies with your laptop closed (in beta)." },
    // G3: the offer pause depends on reply tracking, so the gated line ships.
    guarantee: "Failed submits cost nothing. Cancel any time.",
    guaranteeLive: "Failed submits cost nothing. Billing pauses when an offer email arrives.", // ship when G3 passes
    fullPricing: "Compare every plan", // Landing v3: quiet link to /pricing, where the full compare lives
  },


  // 08 1.9. items feed json-ld.tsx; answers are the Drop 1 answers, all within 40 words.
  faq: {
    h2: "What people ask before signing up.",
    contact: "Something else?", // /pricing: followed by siteConfig.supportEmail, never typed here
    subline: "Short answers on where it applies, what it writes and what it costs.", // Landing v3 left column
    contactLink: "Contact us", // Landing v3: quiet link to /contact
    items: [
      {
        q: "Which job sites does it apply on?",
        a: "Employer career pages on Greenhouse, Lever and Ashby. We do not automate LinkedIn, because its user agreement bans bots and it puts your account at risk.",
      },
      {
        q: "Will recruiters know I used it?",
        a: "The application is submitted through the employer's own form with your details and answers you approved. We do not promise it is undetectable; we make sure it is something you would have sent yourself.",
      },
      {
        q: "Does it invent experience?",
        a: "No. Tailored lines must cite facts from your confirmed profile. A line that cites nothing cannot be saved; the editor lists it so you can fix or remove it.",
      },
      {
        q: "What if a submission fails?",
        a: "You keep the credit. The application shows why it failed so you can fix it and send again.",
      },
      {
        q: "Do you need Gmail access?",
        a: "No. You set one forwarding filter, and replies about your applications come to a private address we give you.",
      },
      {
        q: "Can I upload my resume?",
        // ships with R1 (file import). Until then the honest answer is "Version 1 takes pasted text."
        a: "Yes. Upload a PDF or DOCX, or the PDF LinkedIn saves of your profile. Nothing from it is used until you confirm each fact.",
      },
    ],
  },

  // 08 1.10
  closing: {
    h2: "Try it on 25 real applications.",
    subline: "Every application waits for your approval. The free credits never expire.",
    sublineApproved: "You approved the sample at {approvedTime}. Every real application waits the same way.",
    cta: "Start free",
  },

  // 08 section 6. Link hrefs come from siteConfig.footer.
  footer: {
    wordmark: "Kairos",
    copyright: "© {BUILD_YEAR} Kairos. A product of Gray Matter Labs.",
    motionLegend: "Motion",
    motionOptions: ["Full", "Reduced"],
    motionLive: "Motion set to {mode}.",
  },

  // Landing v3 coda (docs/DESIGN.md "Landing v3 mid-page chapter" > "4. What you get"): the chapter's sample application
  // after approval. Built features only. G3: `line` ships with "(in beta)"; swap to `lineLive` when G3 passes.
  bento: {
    label: "What you get",
    h2: "Everything that went out, and what came back.",
    subline: "The same sample application, after you approve it.",
    cards: [
      {
        title: "A receipt for every send",
        line: "The extension (in beta) keeps the form, your answers and the confirmation page.",
        lineLive: "Kairos keeps the form, your answers and the confirmation page.", // ship when G3 passes
      },
      {
        title: "Replies, sorted",
        line: "Reply tracking (in beta) files each reply to its application.",
        lineLive: "Each reply is filed to its application as interview or other.", // ship when G3 passes
      },
      {
        title: "Credits only for sends that land",
        line: "One credit per application that goes through, none for a failed submit.", // not gated
      },
    ],
    more: "See every step",
    // Coda panel, aria-hidden: every fact here is also in the text column. Rows of Company 109 only (sample).
    panel: {
      head: "Backend Engineer · Company 109",
      approved: "Approved by you",
      receiptHead: "Receipt",
      receipt: [
        ["Form", "Employer's page"],
        ["Answers", "7 · approved by you"],
        ["Resume", "Lines you approved"],
      ],
      saved: "Confirmation page saved",
      repliesHead: "Replies, sorted",
      replies: [
        { text: "Are you free on Thursday?", tag: "Interview" },
        { text: "Thank you for applying", tag: "Other" },
      ],
      creditsHead: "Credits",
      charged: ["Credit", "−1 · charged once"],
      failed: "A failed submit · 0 credits",
    },
  },

  // Shared strings used by chips and islands.
  shared: {
    sampleChip: "SAMPLE",
    sampleChipAria: "Sample data",
  },

  // Shared SAMPLE data for the mid-page chapter (docs/DESIGN.md "Landing v3 mid-page chapter"). Synthetic names only.
  // The held application is the hero's open draft: hero.app.rows[0] (Backend Engineer · Company 109 · Remote, Fit 86)
  // with hero.app.lines (cites #03, cites #07). Problem panel, chapter and coda read from here so they cannot drift.
  sample: {
    facts: [
      { id: "Fact #03", topic: "payments API" },
      { id: "Fact #07", topic: "on-call runbook" },
    ],
    // The line no confirmed fact backs: other tools send it (problem panel); Kairos marks it not saved (chapter).
    uncited: { before: "Led a team of ", claim: "12", after: " engineers" },
    // Postings outside the person's rules: other tools sent the first (problem panel); the fit gate skips both (chapter).
    skipped: [
      { role: "Night Auditor", company: "Company 078", reason: "Skipped · title" },
      { role: "Sales Director", company: "Company 107", reason: "Skipped · location" },
    ],
  },
} as const;

export type LandingCopy = typeof landingCopy;
