/**
 * Board fixtures for the fake ATS: one board per ATS, token "acme", four scenario postings each, written as the
 * providers' public API payloads (the shapes services/ats/*.ts parse). Sample user these were written against:
 * entry-level backend engineer, US remote, needs OPT/STEM OPT sponsorship later.
 */
import type { AtsProvider } from "@auto-career/shared";

export const BOARD_TOKEN = "acme";
export type Scenario = "fit" | "hardFilter" | "noSponsorship" | "closed";
export const SCENARIOS: readonly Scenario[] = ["fit", "hardFilter", "noSponsorship", "closed"];

/** Posting ids per ATS and scenario. Greenhouse ids are numeric, Lever and Ashby ids are UUIDs. */
export const IDS: Record<AtsProvider, Record<Scenario, string>> = {
  greenhouse: { fit: "5000001", hardFilter: "5000002", noSponsorship: "5000003", closed: "5000004" },
  lever: {
    fit: "a0000000-0000-4000-8000-000000000001",
    hardFilter: "a0000000-0000-4000-8000-000000000002",
    noSponsorship: "a0000000-0000-4000-8000-000000000003",
    closed: "a0000000-0000-4000-8000-000000000004",
  },
  ashby: {
    fit: "b0000000-0000-4000-8000-000000000001",
    hardFilter: "b0000000-0000-4000-8000-000000000002",
    noSponsorship: "b0000000-0000-4000-8000-000000000003",
    closed: "b0000000-0000-4000-8000-000000000004",
  },
};

export const TITLES: Record<Scenario, string> = {
  fit: "Backend Engineer, New Grad",
  hardFilter: "Staff Software Engineer, Infrastructure", // senior title, onsite London: fails seniority and location
  noSponsorship: "Software Engineer, Entry Level",
  closed: "Associate Backend Engineer",
};

const DESCRIPTIONS: Record<Scenario, string> = {
  fit: "Build APIs in Node.js and Postgres. New graduates welcome. We can sponsor OPT and STEM OPT candidates.",
  hardFilter: "Lead the infrastructure team. 12+ years of experience. Onsite in London five days a week.",
  noSponsorship: "Build payments APIs in Node.js. We are unable to sponsor work visas for this role.",
  closed: "This role has been filled.",
};

const LOCATIONS: Record<Scenario, string> = {
  fit: "Remote - United States",
  hardFilter: "London, UK",
  noSponsorship: "Remote - United States",
  closed: "Remote - United States",
};

/** Greenhouse content is entity-encoded HTML, as the real API sends it. */
const ghContent = (s: Scenario) => `&lt;p&gt;${DESCRIPTIONS[s]}&lt;/p&gt;`;

/** The Greenhouse board listing (open postings only: a closed posting is simply gone). */
export type IsOpen = (s: Scenario) => boolean;
const defaultOpen: IsOpen = (s) => s !== "closed";

export function greenhouseBoard(isOpen: IsOpen = defaultOpen) {
  return { jobs: SCENARIOS.filter(isOpen).map(greenhouseJob) };
}
export function greenhouseJob(s: Scenario) {
  const id = Number(IDS.greenhouse[s]);
  return {
    id,
    title: TITLES[s],
    absolute_url: `https://acme.example/jobs/${id}`,
    updated_at: "2026-11-01T10:00:00-05:00",
    first_published: "2026-10-28T09:00:00-05:00",
    content: ghContent(s),
    location: { name: LOCATIONS[s] },
    departments: [{ name: "Engineering" }],
  };
}

export function leverPosting(s: Scenario) {
  return {
    id: IDS.lever[s],
    text: TITLES[s],
    hostedUrl: `https://jobs.lever.co/${BOARD_TOKEN}/${IDS.lever[s]}`,
    applyUrl: `https://jobs.lever.co/${BOARD_TOKEN}/${IDS.lever[s]}/apply`,
    createdAt: 1_761_955_200_000,
    descriptionPlain: DESCRIPTIONS[s],
    additionalPlain: "Equal opportunity employer.",
    workplaceType: LOCATIONS[s].startsWith("Remote") ? "remote" : "onsite",
    categories: { location: LOCATIONS[s], team: "Engineering" },
    lists: [],
    salaryRange: { min: 110000, max: 140000, currency: "USD", interval: "per-year-salary" },
  };
}
export const leverBoard = (isOpen: IsOpen = defaultOpen) => SCENARIOS.filter(isOpen).map(leverPosting);

export function ashbyJob(s: Scenario, open = s !== "closed") {
  return {
    id: IDS.ashby[s],
    title: TITLES[s],
    location: LOCATIONS[s],
    department: "Engineering",
    isRemote: LOCATIONS[s].startsWith("Remote"),
    isListed: open, // Ashby keeps a closed posting in the payload, unlisted
    descriptionPlain: DESCRIPTIONS[s],
    publishedAt: "2026-10-28T14:00:00.000Z",
    jobUrl: `https://jobs.ashbyhq.com/${BOARD_TOKEN}/${IDS.ashby[s]}`,
    applyUrl: `https://jobs.ashbyhq.com/${BOARD_TOKEN}/${IDS.ashby[s]}/application`,
    compensation: { summaryComponents: [{ compensationType: "Salary", interval: "1 YEAR", currencyCode: "USD", minValue: 110000, maxValue: 140000 }] },
  };
}
export const ashbyBoard = (isOpen: IsOpen = defaultOpen) => ({ jobs: SCENARIOS.map((s) => ashbyJob(s, isOpen(s))) });
