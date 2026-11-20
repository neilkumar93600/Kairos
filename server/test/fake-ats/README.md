# Fake ATS harness (T-006.2)

Test-only. Serves Greenhouse, Lever and Ashby board APIs and employer application forms at the REAL hostnames by
interception. No port, no network, no production code or allowlist change. Anything not routed fails the test.

```ts
import { createFakeAts, formUrl, IDS, SENSITIVE_FIELDS, CUSTOM_QUESTION_FIELD } from "./fake-ats";
const fake = createFakeAts();
afterEach(() => fake.assertClean());          // unrouted request => throw
```

## Boards (poller, adapters) - T-006.7
`greenhouse.fetchBoard("acme", { fetcher: fake.fetcher })` (same for `lever`, `ashby`; `fetchPosting` too). Token is `acme`.
Four postings per ATS (`IDS[ats][scenario]`): `fit` (junior, remote US, sponsors), `hardFilter` (staff, onsite London),
`noSponsorship` ("unable to sponsor"), `closed` (off the board; Ashby keeps it unlisted; single lookup null).
`fake.closePosting(ats, scenario)` removes one between polls. ETag round trip gives `not_modified`.
The fetcher keeps safeFetchJson's host/scheme checks (`ssrf_host`, `ssrf_scheme`).

## Forms in a browser (cloud applier) - T-006.5
```ts
const browser = fake.wrapBrowser(realChromiumBrowser);   // pass as fillInBrowser's `browser`
```
Its contexts answer every request from the harness; the applier's own guard route is registered later and runs first,
then falls back to it. For a plain Playwright context use `await fake.routeContext(ctx)` (register before any guard).
Apply URLs: `formUrl(ats, scenario)`. Browser tests must `skipIf(process.env.CI || no chromium)` like
`cloud-apply.browser.test.ts`.

## Forms in jsdom (extension) - T-006.6
`fake.respond("GET", formUrl(ats, "fit"))` returns `{ status, body }`; load `body` into jsdom. Forms use each ATS's real field names
(the ones in `extension/src/ats/*`), so the fillers map them.

## Variants and assertions
- `fake.setFormVariant(ats, scenario, "challenge")`: visible reCAPTCHA frame; a POST is refused (403), never a confirmation (INV-8: must end as failure).
- `"closed"` (or `closePosting`): 404 "no longer open" page (INV-23).
- Required custom question (`CUSTOM_QUESTION_FIELD[ats]`), resume file input, EEO block + work-authorization and sponsorship questions
  (`SENSITIVE_FIELDS[ats]`, INV-9: assert `fake.submissions.at(-1).fields[name]` equals the stored sensitive answer, or is empty; never a model's text).
- A POST missing a required field gets 422. A good one reaches the confirmation (Lever via a client-side navigation to `/thanks`).
- `fake.submissions`: every POST (`fields`, `files`, `accepted`). `fake.requests`, `fake.unrouted`.

## Gotcha
Never make the harness answer with a 3xx. A fulfilled redirect is followed by Chromium outside `context.route`; the first
Lever draft used a 303 and the browser fetched the real `jobs.lever.co` thanks page. Use JS navigation (as the Lever form does).
