# Marketing surfaces (2026-11-03)

Branch `frontend/marketing-surfaces`, worktree `E:/download/auto-career/.claude/worktrees/marketing`.
Backend half is WP-50 on branch `wp/50`, worktree `E:/download/auto-career/.claude/worktrees/wp-50`.

Base moved 2026-11-05: the owner merged `frontend/all-pages` and `backend/complete` into `main` and pushed. This branch now sits on `main` at `329e139`, so backend code (billing, privacy registry, retention) is readable from this worktree. WP-50 targets `main`.

## Owner decisions (2026-11-03)

| # | Decision |
|---|----------|
| D1 | Build missing pieces (top banner, breadcrumbs, CTA set, newsletter block, newsletter popup, blog sidebar) and rebuild existing pages (about, blog index, blog post, contact, terms, privacy, cookies, refunds, 404) to an awwwards bar, strictly inside `docs/DESIGN.md` (Duna + frosted glass). No new colours, no new fonts, no invented metrics or testimonials. |
| D2 | Signups go to a new backend endpoint `POST /api/newsletter` (WP-50), double opt-in. |
| D3 | Popup is restrained: exit-intent on desktop, 60% scroll on touch, only on `/blog`, `/blog/*` and `/about`; at most once per 30 days; never on pricing, auth, legal, contact or the app; glass card, not full-screen; honours reduced motion. |
| D4 | 404 gets recovery links (How it works, Pricing, Blog, Log in) beside the lockup. Amends DESIGN.md for the 404 only. Keep the existing scene; add the pause control (WCAG 2.2.2). |
| D5 | Truth lock. Owner answered "the editor lists them to fix"; the code does that for user edits and also does something else for model drafts, so the post describes both (coordinator checked 2026-11-05). Model-drafted lines that fail are dropped before the draft is stored (`server/src/jobs/tailor-application.ts:40-42`). A user edit that fails is refused with 422 `truth_lock`, nothing is stored, and the editor lists the lines (`server/src/routes/applications.ts:102,115-120`). "A line that cites nothing cannot be saved" is true of both paths. The post in `web/content/blog-posts.ts` follows the code. |
| D6 | Sign-up is open to everyone, no beta or early-access label. Every "Start free" goes to `/sign-up`. Banner points at the truth-lock post. |
| D7 | About "Who it is for" names all three segments (OPT students and new grads, US tech workers after a layoff, applicants in India going for US roles); the sponsorship filter is live and may be mentioned. |
| D8 | Coordinator: the dark CTA band (landing dark card) is allowed once, on blog posts only (pending owner confirmation). `PageHero` gets an optional `crumbs` prop, owned by FE-components. |
| D9 | Coordinator: no state change on GET (mail scanners open every link). Confirm and unsubscribe links in mail go to web pages that carry the token in the URL fragment and POST it on a button press. See the backend contract. |
| D10 | Owner 2026-11-05: **refund is not a separate page.** It lives inside all three legal pages (terms, privacy, cookies), rendered from one source so the copies cannot drift: `refundSection` in `web/content/legal-refund.ts`, a `LegalSection` with heading "Refunds" (anchor `#refunds`). `web/app/(legal)/refunds/page.tsx` becomes a `permanentRedirect("/terms#refunds")` so old links survive. Overrides D1's "refunds" and every "four legal pages". Footer, sitemap, QA routes and copy links are already repointed. |
| D11 | Owner 2026-11-05: **remake with real information, not only design.** Blog: 6 substantial posts, every claim traceable to the product (`web/content/blog-posts.ts`, MKT-content). Legal: complete drafts true of what the code does today, verified against `server/` and `shared/`, including the data, cookies and local storage the new surfaces add. No invented facts, entities, addresses or statistics; unknowns go on an owner list, never into the page as if settled. Visible "draft for legal review" note stays until counsel signs off. |

| D12 | Owner 2026-11-05, with three layout references: legal pages use a centred `PageHero` with a short painted band, then two columns on `--c-narrow` with no card, a sticky contents list and the long text directly on the page. Adds a Terms, Privacy, Cookies switch, and tables at full column width. Overrides DESIGN.md's "no painting on legal pages" (updated) and design direction 4.6. |
| D13 | Owner 2026-11-05: extension side panel rebuilt inside DESIGN.md, and its plan checked. Task 17 in `docs/06-implementation-plan.md` is updated, with new steps for the real company name and the claim lease. |

| D14 | Owner 2026-11-05: "you decide everything, I want the best result". Coordinator decisions: dark CTA stays on blog posts (D8 confirmed). Refund: 14 days from a charge with its credits unused, otherwise reviewed by a person. Newsletter issues carry a summary and a link, sender name Kairos; the sender is not built yet and needs a postal address. 404 links move to the dark sky on phones. Stale copy removed: pause on the billing button, the unenforced rollover limit, the offer-pause line. The rainbow ring on Start free stays: the owner added it, although DESIGN.md does not list it. |
| D15 | Owner 2026-11-05, with layout references ("blank" post page, "essos" index, Aceternity "The journal"): blog rebuilt. Index: cover post beside a Latest list, then All posts with search and image cards. Post: centred title, three columns with hairlines from 1200 px, each post with its own painting, share row, author box, related cards. Overrides DESIGN.md's "blog posts carry no painting" (updated) and design direction 4.2 and 4.3. Urbanist only on these pages, including the shared closing line and dark band. |
| D16 | Owner 2026-11-05, with an Aceternity empty-state reference: one shared `EmptyState`. Boxed form: centred on Bone inside four dashed guide lines that run past the corners and fade. `flat`: centred, no frame, inside a Panel. Titles in Deep Ash with one phrase in Ink; wording unchanged. Optional fan of three real blog links on Matches, Preferences, Queue, Applications and blog no-results, in place of the reference's templates. Page-level empty states with a next action use the Espresso button. The extension side panel and the 404 are left alone. |

## Sources of truth (read before building)

- `docs/DESIGN.md`: tokens, type, glass rules. Code beats doc where they disagree on font: the app font is now Urbanist (owner, 2026-10-23, see `web/app/layout.tsx`); Instrument Serif stays limited to the art-sharing display lines.
- `docs/04-ui-ux-brief.md`, `docs/superpowers/specs/2026-10-15-kairos-landing-design/06-copy-deck.md`: voice and banned patterns.
- `web/AGENTS.md`: this Next.js (16.4) differs from training data. Read `web/node_modules/next/dist/docs/` before using any Next API you are unsure of.
- Phase 1 outputs in this folder: `01-marketing-brief.md` (MKT-cmo), `02-design-direction.md` (DS-direction). All user-facing strings live in `web/content/marketing-copy.ts` (MKT-cmo owns it).

## Component contracts (FE-components builds, everyone else imports)

All under `web/components/marketing/<name>/`, each with its own `.css` file (pattern of `components/marketing/page-hero.*`). Nobody edits `web/app/globals.css`; ask the coordinator if a token is missing.

| Component | Export | Contract |
|-----------|--------|----------|
| Top banner | `TopBanner` (client) | Mounted once in `LandingShell` above the navbar. Light-glass status pill (04-ui-ux-brief line "Announcement pill"). Copy from `marketingCopy.banner` (has an `id`). Dismiss stores `kairos.banner.<id>` in localStorage (try/catch). No layout shift on load. |
| Breadcrumbs | `Breadcrumbs({ items: { label: string; href?: string }[] })` (server) | Last item is the current page (no link, `aria-current="page"`). Emits `BreadcrumbList` JSON-LD. Built on `web/components/ui/breadcrumb.tsx`. Used on about, blog, blog post, contact, newsletter, all legal pages. Not on `/` or 404. |
| CTA | `CtaBand({ variant: "dark" \| "quiet", heading, body?, primary: {label, href}, secondary?: {label, href} })`, `InlineCta({ label, href })` | `dark` reuses the landing dark-card look (`components/landing/entries/dark-card.*`); `quiet` is a Linen band. One primary action per band (DESIGN.md density rule). |
| Newsletter form | `NewsletterForm({ source, variant: "card" \| "inline" \| "compact", onSubscribed? })` (client) | Posts `{ email, source, website }` (website = honeypot, must stay empty) to `/api/newsletter`. Client in `web/lib/newsletter.ts`. States: idle, submitting, sent ("check your inbox to confirm"), rate-limited (429), invalid (400), network error. Visible labels, errors announced via `aria-live="polite"`. On sent, set localStorage `kairos.newsletter.subscribed=1`. |
| Newsletter popup | `NewsletterPopup` (client) | Mounted once in `LandingShell`; self-gates by `usePathname()` against the D3 allowlist. Triggers per D3, plus at least 10 s on page. Frequency key `kairos.popup.newsletter` (timestamp). Never shows if `kairos.newsletter.subscribed` is set. Uses `web/components/ui/dialog.tsx` (focus trap, Esc, return focus), labelled close button, backdrop no heavier than Linen at 40%. |
| Blog sidebar | `BlogSidebar({ current?: Post })` (server, may hold client islands) | Sticky from `lg`. Contains: recent posts (excluding current), compact newsletter (`source="blog-post"` or `"blog-index"`), one quiet CTA to `/sign-up`. Moves below the article on mobile. |

`source` enum (shared with WP-50): `"popup" | "blog-index" | "blog-post" | "about"`.

## Backend contract (WP-50, revised 2026-11-03 after BE-newsletter's report)

- `POST /api/newsletter` body `{ email, source: <enum above>, website? }`. Own `newsletter` rate-limit class (20/h/IP, failed validation not counted) plus a cap of 5 per address per 24 h that still answers 202. Non-empty `website` → 202 and drop. Always 202 `{ ok: true }` for valid input, whatever the address's state (no enumeration). **422 `invalid_body`** on a bad body (repo convention, not 400), 429 `rate_limited`.
- Confirm (D9): the confirm email links to the web page `${WEB_ORIGIN}/newsletter/confirm#token=<token>`. That page shows one "Confirm subscription" button which sends `POST /api/newsletter/confirm?token=<token>` → 200 `{ ok: true }` or 404 `not_found` (unknown, used or expired). No GET confirm endpoint.
- Unsubscribe: `POST /api/newsletter/unsubscribe?token=` (RFC 8058 one-click, no cookie) → 200 `{ ok: true }` or 404, own rate-limit class at 300/min/IP because one-click POSTs share mail-provider IPs. `List-Unsubscribe: <${WEB_ORIGIN}/api/newsletter/unsubscribe?token=…>` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` on every newsletter mail. The body link in mail goes to `${WEB_ORIGIN}/newsletter/unsubscribe#token=<token>` (web page, button, same POST). `GET /api/newsletter/unsubscribe?token=` changes nothing: 303 to `/newsletter/unsubscribe#token=<token>` (for clients that GET the header URL).
- Web side (FE-pages builds, using `confirmNewsletter(token)` / `unsubscribeNewsletter(token)` from `web/lib/newsletter.ts`, FE-components builds those):
  - `web/app/(public)/newsletter/page.tsx`: status page for `?status=confirmed|unsubscribed|invalid` and none.
  - `web/app/(public)/newsletter/confirm/page.tsx` and `.../unsubscribe/page.tsx`: read the token from `location.hash` client-side (never sent to the server or logs), clear the hash with `history.replaceState`, show the button, POST, then show the result in place. `referrer: "no-referrer"` metadata on both. No token in hash → the invalid state.

## File ownership (one owner per file; edits outside your list go through the coordinator)

| Agent | Owns |
|-------|------|
| MKT-cmo | `docs/.../01-marketing-brief.md`, `web/content/marketing-copy.ts` |
| DS-direction | `docs/.../02-design-direction.md` |
| FE-components | `web/components/marketing/{top-banner,breadcrumbs,cta,newsletter,popup,blog-sidebar}/**`, `web/components/marketing/page-hero.{tsx,css}` (add `crumbs` only), `web/lib/newsletter.ts`, `web/components/landing/landing-shell.tsx`, `web/app/layout.tsx` (banner pre-paint script only) |
| FE-pages | `web/app/(public)/{about,blog,contact,newsletter}/**`, `web/app/not-found.{tsx,css}`, `web/components/{about,blog,contact}/**`, `web/lib/blog.ts` |
| MKT-content | `web/content/blog-posts.ts` |
| FE-legal | `web/app/(legal)/**`, `web/components/legal/**`, `web/content/legal-refund.ts`, `docs/.../03-legal-owner-checks.md` |
| BE-newsletter | everything in the `wp-50` worktree for WP-50 |

## Blog content contract

`web/content/blog-posts.ts` (MKT-content writes, FE-pages reads through `web/lib/blog.ts`, which adds `readingMinutes`):

```ts
export interface PostSection { heading?: string; body: string[]; list?: string[] }
export interface PostDraft { slug: string; title: string; summary: string; date: string; sections: PostSection[] }
export const postDrafts: PostDraft[] = [/* newest first */];
```

Keep the slugs `how-the-truth-lock-works` (the banner links to it) and `why-we-cap-applications-per-company`.

## Working in this worktree

- One shared dev server already runs on `http://localhost:4410`. Do not start another `next dev` and do not run `next build`; the coordinator runs the build.
- See your work: `node web/scripts/qa/shots.mjs --routes /blog,/terms --viewports desktop,mobile --out <your scratch dir>`, then read the PNGs. The API is not running, so mock `/api/newsletter` with a Playwright route if you need form states.
- Do not commit. The coordinator commits once the phase passes.
- `npm run typecheck` in `web/` may report imports from a teammate who has not finished. Report those, do not stub them.

## Review protocol

Findings go to `reviews.md` in this folder as: `@<agent>: <severity P0-P3>, <file:line>, <problem>, <opinion>`. The named agent fixes or rebuts with a reason in the same thread. Unresolved disputes go to the owner.

## Done means

`npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass in `web/`; every page checked at 390 and 1440 wide; keyboard-only pass on popup, banner and forms; no text below 12 px; WCAG AA contrast per DESIGN.md.
