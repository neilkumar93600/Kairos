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
    lang: "en",
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
  },

  // 08 1.3. Plain text, no logos.
  strip: {
    caption: "Applies through employer career pages on",
    items: ["Greenhouse", "Lever", "Ashby"],
    trailing: "We do not automate LinkedIn.",
  },

  // 08 1.4. Cards are numbered 001 to 003 by the builder.
  problems: {
    pill: "Reported, not measured",
    h2: "What people report about auto-apply tools.",
    cards: [
      { title: "Poor matches", body: "Applications sent to jobs that do not fit." },
      { title: "Invented resumes", body: "Skills the person does not have." },
      { title: "No edit step", body: "A draft you cannot change." },
    ],
  },

  // 08 1.5 intro
  howItWorks: {
    pill: "How it works", // optional
    h2: "Fit, cite, approve, receipt.",
    subline:
      "Each application passes a fit gate, cites your facts and waits for approval. Submitted ones leave a receipt.",
  },

  // 08 1.5.1. Rule strings for the skip reason are rendered from fit-sample.json and fit.ts.
  step1: {
    badge: "1",
    h3: "A fit gate before anything else.",
    body: "Role, location, salary and visa are hard rules. Break one and it is skipped.",
    card: {
      sampleChip: "SAMPLE",
      sponsorshipLegend: "Needs visa sponsorship",
      sponsorshipOptions: ["Yes", "No"], // default Yes
      skippedRow: "{id} · Skipped · {reason}",
      passRow: "{id} · Passes",
      skipRow: "{id} · Skipped",
      runLine: "{total} postings · {skipped} skipped · {passed} pass",
      liveRegion: "Needs sponsorship {value}. {skipped} postings skipped. {passed} pass.",
    },
  },

  // 08 1.5.2
  step2: {
    badge: "2",
    h3: "Resumes that cannot make things up.",
    body: "Each line cites a fact you confirmed, or it is not saved.",
    card: {
      sampleChip: "SAMPLE",
      line: "Wrote backend services in TypeScript for the billing team",
      cite: "cites #07, #12",
      citeAria: "Cites facts number 7 and 12",
      refusedLine: "Led a team of 6 engineers", // shown for 320 ms, falls and fades
      button: "Try a line without a fact",
      saved: "Saved. Cites facts #07, #12.",
      refused: "Not saved. Cites no confirmed fact.",
    },
  },

  // 08 1.5.3. Mock words 20, floating card 3.
  spotlight: {
    pill: "The moment", // optional
    h2: "Nothing is sent until you approve it.",
    body: "Edit anything. Approve one or a batch. Withdraw before it sends.",
    mock: {
      chip: "SAMPLE · NOTHING SENT",
      title: "Software Engineer · Company 014",
      lines: "4 lines · each cites a fact",
      answers: "7 answers · 0 guessed",
      button: "Approve sample draft",
      approvedButton: "Approved · sample",
      live: "Approved. Sample updated.",
    },
    floating: {
      awaiting: "Awaiting your approval",
      approved: "Approved by you · {approvedTime}",
    },
  },

  // 08 1.5.4. G3: the gated body ships until the extension and receipts are confirmed live.
  step3: {
    badge: "3",
    h3: "Sent through the employer's form. Then a receipt.",
    body: "The extension (in beta) saves every field, answer, resume version and confirmation page. Failed submits cost nothing.",
    bodyLive:
      "Kairos saves every field, answer, resume version and confirmation page. Failed submits cost nothing.", // ship when G3 passes
    card: {
      sampleChip: "SAMPLE",
      header: "Receipt",
      rows: [
        { label: "Form", value: "the employer's page" },
        { label: "Answers", value: "7 · approved by you" },
        { label: "Credit", value: "−1 · charged once" },
      ],
      answersApproved: "Approved · {approvedAt}", // replaces the Answers value after the visitor approves
      failedChip: "Failed · 0 credits",
      live: "Approved. Sample receipt updated.",
    },
  },

  // 08 1.5.5. G3: the gated first sentence ships. The honesty sentence is never gated.
  step4: {
    badge: "4",
    h3: "Replies come to an address you control.",
    body: "Reply tracking (in beta) tags each reply to its application.",
    bodyLive: "Replies are tagged to their application.", // ship when G3 passes
    honesty: "We cannot promise interviews.", // preceded by the 8 px hollow square
    openRowSquareAria: "Open.",
    card: {
      sampleChip: "SAMPLE",
      rows: [
        "Reply · tagged to 0233",
        "Interview request · tagged to 0233",
        "Offer · tagged to 0233",
      ],
    },
  },

  // 08 1.6. The only dark surface.
  darkCard: {
    h2: "Kairos is Greek for the right moment.",
    sub: "You choose it. Nothing is sent until you do.",
    cta: "Start with 25 free applications",
    chip: "Failed submits cost nothing", // dark-glass fact chip beside the button; same fact as pricing
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
    fullPricing: "See full pricing",
  },

  // 08 1.8. Three rows; the Review and Replies rows are dropped.
  compare: {
    pill: "No products named",
    h2: "How it compares with typical auto-apply.",
    columns: ["People report", "Kairos"],
    rows: [
      { topic: "Jobs", reported: "Matches that do not fit", kairos: "Only jobs past your rules" },
      { topic: "Resume", reported: "Skills they do not have", kairos: "Every line cites a fact" },
      {
        topic: "Billing",
        reported: "Charges after cancelling",
        kairos: "Cancel any time. Failed submits cost nothing.",
      },
    ],
  },

  // 08 1.9. items feed json-ld.tsx; answers are the Drop 1 answers, all within 40 words.
  faq: {
    pill: "Questions", // optional
    h2: "What people ask before signing up.",
    contact: "Something else?", // followed by siteConfig.supportEmail, never typed here
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
        a: "Version 1 takes pasted text.",
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
    logoAria: "Kairos, home",
    wordmark: "Kairos",
    tagline: "Fit-first job applications, sent only when you approve.",
    groups: [
      { title: "Product", links: ["How it works", "Pricing", "Blog"] },
      { title: "Company", links: ["About", "Careers", "Contact"] },
      { title: "Legal", links: ["Terms", "Privacy", "Cookies", "Refunds"] },
    ],
    copyright: "© {BUILD_YEAR} Kairos. A product of Gray Matter Labs.",
    legalNote: "Legal pages under review.", // drop when G8 passes
    motionLegend: "Motion",
    motionOptions: ["Full", "Reduced"],
    motionHelp:
      "Reduced turns off the floating and drifting effects. The page says the same things either way.",
    motionLive: "Motion set to {mode}.",
  },

  // Shared strings used by chips and islands.
  shared: {
    sampleChip: "SAMPLE",
    sampleChipAria: "Sample data",
  },
} as const;

export type LandingCopy = typeof landingCopy;
