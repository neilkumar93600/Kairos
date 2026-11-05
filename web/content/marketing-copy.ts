// Kairos marketing surfaces copy: top banner, newsletter (forms, popup, status page), CTA bands, breadcrumbs, blog
// sidebar and pages, about, contact, 404. Rationale and placement: docs/superpowers/specs/2026-11-03-marketing-surfaces/
// 01-marketing-brief.md. Builders read every user-facing string from here and type none inline.
// Same rules as landing-copy.ts: headings 8 words or fewer, sublines 20 or fewer, American spelling, headings end in a
// full stop, no em or en dash, no hype words, no invented numbers, counts, logos, quotes or testimonials.
// Placeholders in braces are filled at runtime: {company} = siteConfig.company, {email} = the address as typed,
// {n} = reading minutes. Strings marked OWNER-CHECK ship as written and wait on an answer listed in the brief.

import type { ContactMessage } from "@auto-career/shared";

/** The newsletter's one promise, shared by the popup and the inline form so they cannot drift. OWNER-CHECK: scope and cap. */
const nextPost = {
  heading: "Get the next post by email.",
  body: "One email when a new post goes up, never more than two a month. Unsubscribe in one click.",
} as const;

const emailField = { label: "Email", placeholder: "you@example.com" } as const;

/** Contact topics. `value` must stay a contactMessageSchema topic (shared/src/schemas.ts); order is the select order. */
const contactTopics = [
  { value: "support", label: "Support", hint: "Name the page and what you expected to happen." },
  {
    value: "billing",
    label: "Billing",
    hint: "Write from the email on your account. Never send card numbers.",
    link: { label: "Read the refund terms", href: "/terms#refunds" },
  },
  { value: "partnership", label: "Partnership", hint: "Say who you are and what you have in mind." },
  { value: "press", label: "Press", hint: "Include your outlet and your deadline." },
  { value: "other", label: "Something else", hint: "Anything that does not fit above." },
] as const satisfies readonly {
  value: ContactMessage["topic"];
  label: string;
  hint: string;
  link?: { label: string; href: string };
}[];

export const marketingCopy = {
  // Light-glass pill above the navbar. Always points at the newest post: when a post ships, change id, text and href
  // together (a new id shows it again to people who dismissed the old one). Hidden on the page its link points to.
  banner: {
    id: "post-how-the-truth-lock-works",
    text: "On the blog: how the truth lock works.",
    link: { label: "Read the post", href: "/blog/how-the-truth-lock-works" },
    regionLabel: "Announcement",
    dismiss: "Dismiss announcement", // aria-label of the close button
  },

  // D3: /blog, /blog/* and /about only. The form inside uses newsletter.inline fields and newsletter.states.
  popup: {
    ...nextPost,
    decline: "No thanks", // neutral text button; same effect as close
    close: "Close", // aria-label of the X button
  },

  // Variants per the NewsletterForm contract. card: /blog index (source "blog-index"). inline: /about and the popup
  // (sources "about", "popup"). compact: blog sidebar (source "blog-post"). The label is always visible.
  newsletter: {
    card: {
      heading: "Notes on applying well, by email.",
      body: "Each new post on how Kairos decides, drafts and sends. At most two emails a month.",
      ...emailField,
      button: "Email me new posts",
    },
    inline: { ...nextPost, ...emailField, button: "Email me new posts" },
    compact: {
      heading: "New posts by email.",
      body: "At most two a month.",
      ...emailField,
      button: "Subscribe",
    },
    privacy: { text: "We email you a link to confirm first.", link: { label: "Privacy policy", href: "/privacy" } },
    // The API answers 202 for new, pending and already confirmed addresses alike, so `sent` never claims which.
    states: {
      submitting: "Subscribing…",
      sent: {
        title: "Check your inbox.",
        body: "Confirm with the link we sent to {email}. Already subscribed? Nothing changes.",
        short: "Check your inbox to confirm.", // compact variant
        retry: "Use a different email", // resets the form to idle
      },
      rateLimited: "Too many attempts. Try again in an hour.", // publicFormLimiter: 5 per hour
      invalid: "Enter a valid email address, like you@example.com.",
      networkError: "Could not reach Kairos. Check your connection and try again.",
    },
  },

  // CtaBand ({ heading, body?, primary, secondary? }) and InlineCta ({ label, href }) content. One primary per band.
  // Dark or quiet is DS-direction's call. /about and /blog close with Entry10Start (landingCopy.closing), not a band here.
  cta: {
    aboutSteps: { label: "See every step", href: "/how-it-works" }, // InlineCta under about.rules
    legalContact: { label: "Questions about this page? Contact us", href: "/contact" }, // InlineCta at the end of legal pages
    newsletterConfirmed: {
      heading: "Try it on your own search.",
      body: "Your first 25 applications are free, and each one waits for your approval.",
      primary: { label: "Start free", href: "/sign-up" },
      secondary: { label: "See every step", href: "/how-it-works" },
    },
  },

  // Other page labels come from siteConfig.footer and publicNav.
  breadcrumbs: { home: "Home", navLabel: "Breadcrumb", newsletter: "Newsletter" },

  blogSidebar: {
    label: "More from the blog", // aside aria-label
    recent: "Recent posts",
    // The compact form reads newsletter.compact. This is the sidebar's one quiet CTA.
    cta: {
      heading: "Applying now?",
      body: "Kairos applies only to jobs that fit, and only after you approve.",
      primary: { label: "Start free", href: "/sign-up" },
    },
  },

  blog: {
    meta: { title: "Blog", description: "How Kairos works, and what we learn about applying to jobs well." },
    hero: {
      title: "Notes on applying well.",
      lead: "How Kairos decides, drafts and sends, written plainly.",
    },
    latest: "Latest",
    all: {
      heading: "All posts",
      searchLabel: "Search posts",
      placeholder: "Search posts",
      count: "{n} posts",
      matches: "{n} of {total} posts", // status line while a search is typed
    },
    empty: {
      title: "No posts match “{q}”.",
      body: "Try one word, such as credits or visas.",
      clear: "Clear search",
    },
    minRead: "{n} min read",
    // The left column on a post, from 1200 px.
    about: {
      heading: "About Kairos",
      body: "Kairos finds jobs that fit, drafts from facts you confirmed, and sends nothing until you approve.",
      link: { label: "More about us", href: "/about" },
    },
    share: {
      label: "Share this post",
      copy: "Copy link",
      copied: "Link copied",
      failed: "Could not copy. The address bar has the link.",
      linkedin: "LinkedIn",
      x: "X",
      newTab: "(opens in a new tab)",
    },
    author: {
      title: "Written by the Kairos team",
      body: "We build Kairos at {company}, and we check what these posts say against the product.",
      link: { href: "/about" },
    },
    related: "Related posts",
  },

  // Arc: the problem, the three rules that answer it, three refusals, who it is for, who builds it, an invitation.
  about: {
    meta: {
      title: "About",
      description: "Why Kairos exists, the three rules built into it, and the studio behind it, {company}.",
    },
    hero: {
      pill: "Built by {company}",
      title: "Speed was never the problem.",
      lead: "Auto-apply tools made it easy to send hundreds of wrong applications, in words the applicant never wrote.",
      artAlt: "At noon, a small stack of receipts rests on a stone in the meadow, held down by a pebble.",
      // FloatingCard over the art, with the SAMPLE chip (landingCopy.shared.sampleChip). Synthetic company.
      card: { title: "Product Analyst · Company 027", status: "Approved by you", meta: "3 lines · 3 facts cited" },
    },
    // docs/01-prd.md core features. `reported` is the complaint each rule answers (PRD "Problem"); `when` is where the
    // app runs the check.
    rules: {
      title: "Kairos keeps the speed. You keep the pen.",
      subline: "Three rules are built into the product. Each is a check the app runs, not a promise it makes.",
      reportedLabel: "Reported by people who used other tools",
      items: [
        {
          title: "Fit first",
          reported: "Matches that do not fit.",
          body: "Role, location, salary and visa are checked first. A posting that fails one rule is skipped, not softened.",
          when: "Before every draft",
        },
        {
          title: "Truth lock",
          reported: "Skills the person does not have.",
          body: "Every tailored line must cite a fact you confirmed. A line that cites nothing cannot be saved.",
          when: "On every save",
        },
        {
          title: "Approve before send",
          reported: "A review step with no edit step.",
          body: "Nothing is submitted until you approve it. Until then you can edit any field or withdraw the draft.",
          when: "Before every send",
        },
      ],
    },
    // docs/01-prd.md "Out of scope", "Honest billing", "Reply tracking".
    notDo: {
      title: "Three things Kairos does not do.",
      subline: "Each one costs us a feature and spares you a risk.",
      items: [
        {
          title: "Automate LinkedIn",
          body: "Its user agreement bans bots, which puts your account at risk. Kairos uses employer career pages instead.",
        },
        {
          title: "Read your Gmail",
          body: "No inbox access. One forwarding filter sends replies about your applications to a private address Kairos gives you.",
        },
        {
          title: "Charge for a failed submit",
          body: "A credit is spent only when the employer's form confirms it. A failed submit shows its reason and costs nothing.",
        },
      ],
    },
    // docs/01-prd.md "Target users". OWNER-CHECK: naming the three segments, and the sponsorship filter being live.
    forWhom: {
      title: "Who Kairos is for.",
      subline: "People who send many applications and still want to sign each one.",
      items: [
        {
          title: "Students and new grads on OPT",
          body: "Postings that say they do not sponsor are skipped before a draft exists.",
        },
        {
          title: "Tech workers after a layoff",
          body: "Fewer, better applications, and a credit spent only when a submission goes through.",
        },
        {
          title: "Applying to US roles from India",
          body: "The same product and the same rules. Prices are in US dollars.",
        },
      ],
      notFor: "Not for sending applications you have not read.",
    },
    studio: {
      title: "The studio behind it.",
      body: "{company} is an independent AI product studio. The people who build Kairos also read the mail.",
      facts: {
        studio: "Studio",
        write: "Write to us", // value: siteConfig.supportEmail as a mailto link
        press: "Press and partnerships",
        pressLink: { label: "Through the contact form", href: "/contact" },
      },
    },
    // The newsletter section reads newsletter.inline (source "about"); the page then closes with Entry10Start.
  },

  contact: {
    meta: {
      title: "Contact",
      description:
        "Support, billing, partnerships or press. Write to the people who build Kairos; replies within two working days.",
    },
    hero: {
      title: "Talk to a person.",
      lead: "Support, billing, partnerships or press. A person who works on Kairos reads every message.",
      artAlt: "A post box at the end of the path in the late afternoon, with envelopes sorted into two piles beside it.",
    },
    form: {
      title: "Send a message",
      name: "Name",
      email: "Email",
      topic: "Topic",
      message: "Message",
      messageHint: "At least 10 characters.",
      topics: contactTopics, // the first is the default; show the chosen topic's hint (and link) under the select
      submit: "Send message",
      sending: "Sending…",
      sent: { title: "Sent", body: "Thanks. We reply within two working days." },
      // Map schema issues to these by field; never show raw validator text.
      errors: {
        name: "Enter your name.",
        email: "Enter a valid email address.",
        topic: "Choose a topic.",
        message: "Write at least 10 characters.",
        rateLimited: "Too many messages. Try again in an hour.", // publicFormLimiter: 5 per hour
        network: "Could not send. Check your connection and try again.",
      },
    },
    facts: {
      title: "What to expect",
      who: { label: "Who reads it", value: "The people who build Kairos, at {company}." },
      email: "Email", // value: siteConfig.supportEmail
      reply: { label: "Reply time", value: "Within two working days." },
    },
    careers: { lead: "Want to work on Kairos?", link: { label: "See careers", href: "/careers" } },
  },

  notFound: {
    meta: { title: "Page not found" },
    code: "404",
    message: "The path may be broken, but the journey isn’t. Let’s get you back.", // owner reference 2026-10-30, verbatim
    logoAria: "Kairos, back to the start",
    // OWNER-CHECK: docs/DESIGN.md makes the lockup the only link on the 404. Render these only once the owner agrees.
    links: {
      label: "Other ways back",
      items: [
        { label: "How it works", href: "/how-it-works" },
        { label: "Pricing", href: "/pricing" },
        { label: "Blog", href: "/blog" },
        { label: "Log in", href: "/login" },
      ],
    },
  },

  // /newsletter?status=confirmed|unsubscribed|invalid (WP-50 redirects). `none` covers a missing or unknown status.
  newsletterStatus: {
    meta: { title: "Newsletter", description: "Confirm or change your Kairos newsletter subscription." },
    confirmed: {
      title: "You are subscribed.",
      body: "New posts will come to this address, at most two a month. Every email has a one-click unsubscribe.",
      cta: { label: "Read the blog", href: "/blog" }, // then cta.newsletterConfirmed below it
    },
    unsubscribed: {
      title: "You are unsubscribed.",
      body: "No more newsletter emails will go to this address.",
      cta: { label: "Back to the blog", href: "/blog" },
    },
    invalid: {
      title: "This link no longer works.",
      body: "It may have been used already. Subscribe again from the blog to get a fresh link.",
      cta: { label: "Go to the blog", href: "/blog" },
    },
    invalidUnsubscribe: {
      title: "This link no longer works.",
      body: "It may be out of date. Every newsletter email has its own unsubscribe link. If mail keeps coming, tell us and we will stop it.",
      cta: { label: "Contact us", href: "/contact" },
    },
    none: {
      title: "Notes on applying well, by email.",
      body: "Subscribe from any blog page. At most two emails a month.",
      cta: { label: "Go to the blog", href: "/blog" },
    },
    // The two pages mail links open (README D9): nothing changes until the button is pressed, because mail scanners open links.
    confirmPrompt: {
      title: "Confirm your subscription.",
      body: "New posts will come to this address, at most two a month.",
      button: "Confirm subscription",
      busy: "Confirming",
    },
    unsubscribePrompt: {
      title: "Unsubscribe from the newsletter?",
      body: "No more newsletter emails will go to this address.",
      button: "Unsubscribe",
      busy: "Unsubscribing",
    },
    // Shown beside the button; the press can be retried.
    errors: {
      rateLimited: "Too many tries from this connection. Wait a minute, then press the button again.",
      network: "We could not reach Kairos. Check your connection and press the button again.",
    },
  },
} as const;

export type MarketingCopy = typeof marketingCopy;
