# Reviews: marketing surfaces (frontend half)

WP-50 threads are in `docs/superpowers/plans/2026-10-30-backend-completion/reviews/WP-50.md` on `wp/50`.

## REV-code, 2026-11-05

| Finding | Owner | Severity | Result |
|---|---|---|---|
| "Do not send it again" lost when the panel closes, so Send came back after an unrecorded submission | coordinator | P1 | Fixed: session-storage flag read on load. Reproduced in real Chromium: warning survives reopen, Send stays hidden |
| `content:report` accepted with no pending tab, trusting the application id | coordinator | P2 | Fixed: only a tab this worker opened, for the application it was given |
| Row could stick on "Sending" | coordinator | P2 | Fixed: tab parked on about:blank until the payload is stored; a page that leaves the supported boards reports a failure |
| Popup rarely shows on blog posts on desktop | FE-components | P2 | Rebutted: agreed behaviour. The sidebar form is the same offer and is already on screen |
| Blog: one "fixed sentence" the product never shows | MKT-content | P3 | Fixed: split into the two real strings |
| Blog: cover-letter and form-answer sentences true of one path only | MKT-content | P3 | Fixed: both paths described |
| Dismissed banner could return in engines that do not animate fr rows | FE-components | P3 | Fixed: timed backstop |
| Dead unsubscribe link landed on subscribe copy | FE-pages, BE-newsletter | P3 | Fixed on `wp/50` (9f7dbc4) |
| Outcome not announced, focus lost when the list rebuilt | coordinator | P3 | Fixed: one list for the life of the panel |
| Unused `ui/sidebar.tsx` writes a cookie the policy does not list | coordinator | P3 | Fixed: deleted, no importers |
| 404 pause button could misreport state | FE-pages | P3 | Fixed: driven by the video events |
| Honeypot had no max length | FE-components | P3 | Fixed: 2048, matching the shared schema |
| Merge order: forms and the privacy text need WP-50 live | coordinator | note | Open: land `wp/50` and this branch together |

## Jury critic, 2026-11-05 (/privacy only)

Critic 7.1. Applied: one right edge, intro clear of the ridge, 24 px inline link targets, banner focus ring, og:image on blog posts. Kept against its advice: refunds on all three pages (owner decision D10). Open: site-wide hover treatment, page transitions, phone footer poster, image weight, footer video button name.

## REV-design, 2026-11-05

No P0 or P1. Fixed: blog featured card fills its width, duplicate Studio row and double rule on About, About cards on phones, banner wraps at 320, contact card keeps its height when sent, popup art shrinks on short screens. Not changed: the first H2 gap on About measures 65 px live, so the reported 10 px was a stitched-screenshot artifact.
