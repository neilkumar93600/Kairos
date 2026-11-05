# 01. Marketing brief: marketing surfaces

Owner: MKT-cmo. Date: 2026-11-03. Every string named here lives in `web/content/marketing-copy.ts`. Builders take copy from that file and add none of their own. Visual choices belong to `02-design-direction.md` and must stay inside `docs/DESIGN.md`.

Skills applied: `c-level-skills:cmo-advisor`, `marketing-skills:marketing-strategy-pmm`, `marketing-skills:popups`, `cta-generator`, `newsletter-signup-generator`, `top-banner-generator`, `about-page-generator`, `contact-page-generator`, `404-page-generator`.

Lines marked `OWNER-CHECK:` ship as written but need an answer from the owner. All of them are listed again in section 10.

## 1. Positioning for these surfaces

**ICP.** The people from `docs/01-prd.md`: US OPT and STEM OPT students and new grads, tech workers in the US after a layoff, and applicants in India going for US-listed roles. These surfaces reach them **before they are ready to sign up**: they are reading the blog or the about page to decide whether an auto-apply tool can be trusted with their name. Contact also serves a second group: press, partners and existing users with a billing or support question.

**The alternative we beat.** Not a named rival. People choose between two things they already know:
- **Applying by hand.** It is slow (the same fields typed into every form), but they control every word.
- **Mass auto-apply.** It is fast, but people report wrong matches, invented resume lines and no way to edit before sending.

Kairos keeps the speed of the second and the control of the first. The line already on the about page says this: "Kairos keeps the speed. You keep the pen."

**Three planks. Each one is a check the product runs, not a slogan.**

| Plank | Proof the reader can check |
|---|---|
| Fit first | Role, location, salary and visa are hard rules, checked before any model runs. The sponsorship filter and the cap of 2 applications per company per 30 days are both built (PRD). |
| Truth lock | A tailored line that cites no confirmed fact cannot be saved. The blog post "How the truth lock works" explains it. |
| Approve before send | Nothing is submitted until the user approves it. A credit is spent only when the employer's form confirms the submission, and a failed submit costs nothing (one ledger row per application, unique index). |

**Who we are not for**, said in public on `/about` as `about.forWhom.notFor`: "Not for sending applications you have not read." Kept internal: anyone who needs LinkedIn Easy Apply, a search that runs mostly on Workday or iCIMS (both P2), or recruiter outreach emails (out of scope).

## 2. Newsletter value proposition

**What a subscriber gets:** one email each time a new post goes up on `/blog`, and never more than two emails a month. There is no fixed schedule, no lead magnet, no product promotions and no "weekly tips" promise. Kairos is pre-launch and has two posts, both dated 2026-10-13, so the only promise we can keep is "the next post, when it exists". The cap tells the reader we will not flood their inbox, and we can keep it even if nothing is published for a month.

- Promise string: `nextPost.body`, which the popup and `newsletter.inline` share so the two cannot drift.
- OWNER-CHECK: scope is new posts only, capped at two emails a month.
- OWNER-CHECK: WP-50 builds signup, confirm and unsubscribe, but nothing that **sends an issue**. Before any form promises "the next post by email", the owner needs to decide how a post gets mailed out (a manual send through the outbound mail path, or a small send job) and whether the email carries the full post or a summary with a link. The posts are short, so I recommend sending the full text.
- The sent state never claims the address is new. The API answers 202 for new, pending and already confirmed addresses alike, so `states.sent.body` reads "Confirm with the link we sent to {email}. Already subscribed? Nothing changes." Echoing the address back lets people catch typos, and `sent.retry` resets the form.

## 3. Top banner

**Message:** "On the blog: how the truth lock works." with the link "Read the post" (`/blog/how-the-truth-lock-works`).

**Why this message:**
- It is true today and will stay true. It needs no owner sign-off on launch status.
- It sits on every marketing page, including `/` and `/pricing`, and it does not compete with their one Espresso action. It is a content link, not a second "Start free".
- It points at the strongest plank. Invented resume lines are the complaint our ICP fears most.
- It feeds the newsletter path: the post page is where the compact form and the popup live.

**Rules:**
- The banner always points at the newest post. When a post ships, change `id`, `text` and `href` together. The new id shows the banner again to people who dismissed the old one.
- FE-components: hide the banner on the page its link points to.
- Only one message at a time. No countdowns and no urgency words.

OWNER-CHECK: the alternative is a status banner, for example a line saying Kairos is in beta and the first 25 applications are free. That needs the owner to state the launch status in public words ("beta", "early access", or nothing) and to confirm that sign-up is open to everyone. Every "Start free" on the site assumes it is.

## 4. Popup (D3)

**Offer:** the same promise as the inline form. Heading "Get the next post by email." Body is `nextPost.body`. Button "Email me new posts". The decline is a neutral "No thanks" text button, and there is a labelled X ("Close"). There is no discount, no countdown and no confirmshaming.

**Why this offer, and only on these routes:** people on `/blog`, `/blog/*` and `/about` are researching, not ready to sign up. A free newsletter is the right size of ask for that stage. On pricing, auth, contact, legal and the app, the visitor is in the middle of a task, and a popup there would cost sign-ups.

**Trigger (D3 plus these specifics):**
- At least 10 s on the page in every case.
- Desktop (fine pointer): exit intent, meaning the pointer leaves through the top edge of the viewport.
- Touch: 60% scroll depth of the document.
- Shown at most once per 30 days. Close, Esc, backdrop click and "No thanks" all write `kairos.popup.newsletter`.
- A successful submit sets `kairos.newsletter.subscribed`, and the popup never shows again.

**Suppress it when** (my additions, so we never ask twice at once):
- another newsletter form on the page is in the viewport, has focus, or was submitted this session (the about inline form and the sidebar compact form);
- another dialog is already open.

**Measure:** shown, submitted and closed, per route, if MKT-5 has an analytics hook. If there is none, do not build one for this.

## 5. CTA hierarchy per page

One primary per section. "Primary" means the one Espresso pill. Everything else is a text link or an outlined button.

| Page | Section | Primary | Secondary (quiet) |
|---|---|---|---|
| All marketing pages | Top banner | none (content link "Read the post") | none |
| `/about` | Hero | none (a reading page) | none |
| | Rules | none | `cta.aboutSteps` "See every step" |
| | Does not do / Who it is for / Studio | none | Studio: "Through the contact form" |
| | Newsletter (`newsletter.inline`, source `about`) | "Email me new posts" | none |
| | Closing | `Entry10Start` "Start free" (landingCopy, unchanged) | none |
| `/blog` | Post list | none (post links) | none |
| | Newsletter (`newsletter.card`, source `blog-index`) | "Email me new posts" | none |
| | Closing | `Entry10Start` "Start free" | none |
| `/blog/[slug]` | Article end | none | `cta.blogPostEnd` "See how Kairos works" |
| | Sidebar | compact form "Subscribe" (source `blog-post`) | `blogSidebar.cta` "Start free", quiet, not Espresso |
| `/contact` | Form | "Send message" | Billing topic: "Read the refund terms"; aside: careers link |
| `/newsletter` | Status | `newsletterStatus.<status>.cta` | none |
| | Confirmed only | `cta.newsletterConfirmed` "Start free" | "See every step" |
| Legal pages | End | none | `cta.legalContact` |
| 404 | Scene | Kairos lockup (back to `/`) | see section 8 |

On a blog post, the sidebar's form and its sign-up link both sit in one aside. So the sign-up link stays quiet and the form button is the aside's only filled button. Mobile stacks the sidebar under the article, which is why the article end carries a content link and not a second sign-up band.

## 6. About page narrative arc

Problem, then the answer, then the limits, then the audience, then the people, then the ask. Each step is one section, kept within the density budget.

1. **Hero: the problem.** "Speed was never the problem." Kept from the current page.
2. **Rules: the answer.** "Kairos keeps the speed. You keep the pen." Each of the three rules now carries the complaint it answers (`reported`, from the PRD problem list, attributed and not accusing), so the section reads as an origin story without inventing a founder story. `cta.aboutSteps` sits under it.
3. **Does not do: the limits.** "Three things Kairos does not do." Kept; the bodies are tightened to 20 words.
4. **Who it is for: the audience (new).** The three PRD segments, each with the one built feature that matters to that segment, then the exclusion line. OWNER-CHECK: naming the three segments in public, and that the sponsorship filter is live.
5. **Studio: the people.** "{company} is an independent AI product studio." Kept from the current page. No team photos, no headcount, no logos.
6. **Newsletter (new).** `newsletter.inline`, source `about`.
7. **Closing.** `Entry10Start`.

## 7. Contact routing

`contactMessageSchema.topic` is `support | billing | partnership | press | other`, and `contact.form.topics` matches it. `satisfies` checks this at compile time, so a new enum value without copy fails `tsc`.

All topics go to the same people. We do not claim separate teams. The topic tags the message, and the hint under the select tells the sender what to include:

| Topic | Hint | Self-serve link |
|---|---|---|
| support | Name the page and what you expected to happen. | none |
| billing | Write from the email on your account. Never send card numbers. | Refund terms `/terms#refunds` |
| partnership | Say who you are and what you have in mind. | none |
| press | Include your outlet and your deadline. | none |
| other ("Something else") | Anything that does not fit above. | none |

**Error copy:** map schema issues to `contact.form.errors` by field. Today the form shows raw validator text, which must go. The rate-limit lines say "an hour" because `publicFormLimiter` allows 5 per hour. The reply promise "within two working days" is kept from the live page. The careers line changes from "Looking for a role?" to "Want to work on Kairos?": on a job-application product the old line reads as if we place candidates.

## 8. 404 recovery

What stays: the owner-referenced scene, "404", the line "The path may be broken, but the journey isn’t. Let’s get you back." (kept verbatim), and the lockup as the way home.

Recovery paths (`notFound.links`): How it works, Pricing, Blog, and Log in. Log in is there because `not-found.tsx` also catches dead app URLs, where a signed-in user's way back is the app, not the landing page. There is no search: the site is too small to need it. There is no auto-redirect.

OWNER-CHECK: `docs/DESIGN.md` (Inner pages, 404 row) says the lockup is "the only link". Render `notFound.links` only if the owner agrees. Otherwise the lockup alone is the recovery path.

## 9. Confirmation email (for BE-newsletter)

The server cannot import from `web/`, so this is the copy for WP-50's confirmation email:

- **Subject:** Confirm your Kairos newsletter subscription
- **Body:** "Someone asked to get new Kairos blog posts at this address. If it was you, confirm with the button below. If not, ignore this email and nothing happens."
- **Button:** "Confirm subscription"
- **Footer:** "Kairos, a product of Gray Matter Labs." then the postal address, then the unsubscribe link.
- OWNER-CHECK: CAN-SPAM requires a valid postal address in every newsletter email. The owner also needs to set the sender name and address.

## 10. OWNER-CHECK items

1. **Newsletter scope and cap:** new posts only, never more than two emails a month (`nextPost`, `newsletter.card`, `newsletter.compact`, `newsletterStatus`).
2. **No send path:** WP-50 has no way to send an issue. Decide how a post gets mailed, and whether the email carries the full post or a summary. This must be settled before the forms go live.
3. **Email compliance:** the postal address in every newsletter footer (CAN-SPAM), plus the sender name and address.
4. **Privacy policy:** it must cover the newsletter: email, source, consent time, purpose and unsubscribe. This is FE-legal's page, and the form links to `/privacy`.
5. **Launch status in public:** can we say "beta" or "early access", and is sign-up open to everyone? This decides whether a status banner can replace the post banner, and every "Start free" link depends on it.
6. **404 recovery links:** they conflict with DESIGN.md "lockup is the only link".
7. **About "Who it is for":** naming the three segments in public, including applicants in India, and confirming the sponsorship filter is live.
8. **Blog post contradicts the FAQ:** the blog post "How the truth lock works" says uncited lines "are dropped before you see them". The landing FAQ says "the editor lists it so you can fix or remove it". One of them is wrong. FE-pages owns `web/lib/blog.ts`, and the owner must say which behavior is true.

## 11. Notes to other agents

- **FE-components:**
  - Hide the banner on its own link target.
  - Popup suppression rules are in section 4.
  - The popup's dialog title is `popup.heading`, and its form uses the `newsletter.inline` fields.
  - `newsletter.states.sent.short` is for the compact variant.
- **FE-pages:**
  - Blog hero, back link, reading time and post navigation are in `marketingCopy.blog`. The blog hero title now ends in a full stop, like every other heading.
  - Page labels for breadcrumbs come from `siteConfig`, except "Newsletter".
  - `/newsletter` handles a missing or unknown status with `newsletterStatus.none`.
- **BE-newsletter:** the `source` enum has no value for the `/newsletter` page, so that page links to `/blog` instead of embedding a form. Add a value only if the owner wants a form there.
