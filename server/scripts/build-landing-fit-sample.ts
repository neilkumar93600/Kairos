/**
 * Builds web/content/fit-sample.json for the landing page's "Sample run" (entry 02).
 * 48 synthetic postings are run through the real `passesHardFilters` under all 18 combinations of the three
 * sample controls (seniority x needs sponsorship x per-company limit). Nothing here is a rate or a real posting.
 *
 *   npx tsx server/scripts/build-landing-fit-sample.ts
 *
 * server/test/landing-fit-sample.test.ts re-runs `buildFitSample()` and fails if the committed JSON differs.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Preferences } from "@auto-career/shared";
import { passesHardFilters, type FitJob } from "../src/services/fit";

export const SAMPLE_PATH = fileURLToPath(new URL("../../web/content/fit-sample.json", import.meta.url));

export interface FitSample {
  version: 1;
  /** Exact `fit.ts` strings in `fit.ts` order; index = reason code. */
  reasons: string[];
  /** Posting order is the order the receipt feed prints. `score` is written by us, not by a model. */
  postings: { id: string; company: string; title: string; score: number }[];
  /** 18 arrays of 48 bitmasks, indexed by `comboIndex`; bit c set = reason code c; 0 = passes. */
  combos: number[][];
  cards: { id: string; title: string; lines: [string, string, string]; validIn: number[] }[];
}

// Reason codes in fit.ts order (lines 42 to 73). Every string is checked against the function's real output below.
const REASONS = [
  "Title does not match your roles",
  "Title is more senior than you asked for",
  "Title is more junior than you asked for",
  "Location is outside your list",
  "Company is on your exclude list",
  'Mentions excluded keyword "clearance"',
  "Posted salary is below your floor",
  "Posting says it does not sponsor visas",
  "You hit your per-company limit for the last 30 days",
];

const SENIORITY = ["entry", "mid", "senior"] as const;
const CAPS = [1, 2, 3] as const;

const BASE_PREFS: Omit<Preferences, "seniority" | "workAuthorization" | "maxApplicationsPerCompanyPer30Days"> = {
  roles: ["Software Engineer", "Backend Engineer"],
  locations: ["New York", "Austin"],
  remoteOk: true,
  salaryFloorUsd: 85_000,
  excludedCompanies: ["Company 031"],
  excludedKeywords: ["clearance"],
  fitThreshold: 70,
};

// Fixed synthetic count of recent applications per company (0 for every company not listed).
const RECENT: Record<number, number> = { 8: 3, 19: 2, 22: 2, 36: 1, 40: 1 };

const PLACE = {
  R: { location: "Remote", remote: true },
  NY: { location: "New York, NY", remote: false },
  AU: { location: "Austin, TX", remote: false },
  SEA: { location: "Seattle, WA", remote: false },
  DEN: { location: "Denver, CO", remote: false },
  CHI: { location: "Chicago, IL", remote: false },
} as const;

const BASE_DESC = [
  "Build and ship services in TypeScript.",
  "Own APIs and data pipelines on a small team.",
  "Work on reliability and developer tooling.",
  "Ship product features across a Node and Postgres stack.",
  "Improve latency and cost of core services.",
];
const NO_SPONSOR = ["We are unable to sponsor visas for this role.", "Must be a U.S. citizen.", "No visa sponsorship is available."];
const FLAG_TEXT = {
  p: "We sponsor visas for qualified candidates.",
  k: "Some work requires an active security clearance.",
} as const;

// [company number, title, place, max salary USD, flags (s = says no sponsorship, k = keyword, p = sponsors), score]
type Spec = [number, string, keyof typeof PLACE, number | null, string, number];
const SPECS: Spec[] = [
  // Pass every default rule (10). The first three are the authored cards.
  [14, "Software Engineer, Platform", "NY", 138_000, "p", 82],
  [27, "Backend Engineer I", "R", 124_000, "", 76],
  [3, "Software Engineer, New Grad", "AU", 112_000, "", 74],
  [11, "Software Engineer", "NY", 128_000, "", 71],
  [6, "Software Engineer II", "R", null, "", 68],
  [17, "Backend Engineer", "AU", 118_000, "", 66],
  [24, "Junior Software Engineer", "R", 96_000, "", 63],
  [33, "Software Engineer, Payments", "NY", 132_000, "", 61],
  [9, "Software Engineer, Entry Level", "AU", null, "", 57],
  [38, "Backend Engineer, Data", "R", 104_000, "", 52],
  // Postings that say they do not sponsor visas (9, plus 3 below that break a second rule).
  [2, "Software Engineer", "NY", 126_000, "s", 79],
  [4, "Backend Engineer", "R", 134_000, "s", 72],
  [7, "Software Engineer, Infrastructure", "AU", 142_000, "s", 69],
  [10, "Associate Software Engineer", "NY", 98_000, "s", 64],
  [13, "Software Engineer, Graduate Program", "AU", 92_000, "s", 62],
  [15, "Software Engineer, Growth", "R", null, "s", 58],
  [18, "Backend Engineer II", "NY", 121_000, "s", 55],
  [20, "Software Engineer, Mobile", "R", 115_000, "s", 49],
  [21, "Software Engineer, Search", "AU", 129_000, "s", 47],
  // Title does not match your roles.
  [1, "Product Designer", "R", 118_000, "", 44],
  [5, "Data Analyst", "NY", 92_000, "", 41],
  [12, "DevOps Engineer", "AU", 125_000, "", 46],
  [16, "Frontend Engineer", "R", 122_000, "", 48],
  [23, "Marketing Manager", "NY", 98_000, "", 42],
  [25, "Account Executive", "SEA", 105_000, "", 40],
  // Title is more senior than you asked for (pass under Mid and Senior).
  [26, "Senior Software Engineer", "NY", 165_000, "", 78],
  [28, "Staff Software Engineer", "R", 190_000, "", 75],
  [29, "Principal Backend Engineer", "AU", 188_000, "", 73],
  [30, "Lead Software Engineer", "NY", 172_000, "", 70],
  // Location is outside your list.
  [32, "Software Engineer", "SEA", 130_000, "", 56],
  [34, "Backend Engineer", "DEN", 127_000, "", 53],
  [35, "Software Engineer, Platform", "CHI", 136_000, "", 50],
  [37, "Software Engineer, Billing", "DEN", 119_000, "", 48],
  // Company is on your exclude list.
  [31, "Software Engineer", "NY", 131_000, "", 77],
  [31, "Backend Engineer", "R", 126_000, "", 69],
  // Mentions excluded keyword.
  [39, "Software Engineer, Systems", "NY", 150_000, "k", 66],
  [11, "Backend Engineer, Core", "AU", 140_000, "k", 62],
  // Posted salary is below your floor.
  [6, "Software Engineer, Tools", "R", 72_000, "", 58],
  [17, "Backend Engineer", "NY", 68_000, "", 55],
  [24, "Software Engineer", "AU", 80_000, "", 52],
  [33, "Software Engineer, QA Automation", "R", 76_000, "", 57],
  [9, "Backend Engineer, Integrations", "NY", 62_000, "", 46],
  // You hit your per-company limit (cap 2: companies 008, 019, 022; cap 1 adds 036 and 040; cap 3 only 008).
  [8, "Software Engineer", "NY", 128_000, "", 69],
  [19, "Backend Engineer", "R", 122_000, "", 66],
  [22, "Software Engineer, Platform", "AU", 135_000, "", 63],
  // Sponsorship plus a second rule.
  [36, "Software Engineer", "R", 74_000, "s", 50],
  [40, "Backend Engineer", "SEA", 133_000, "s", 48],
  [26, "Senior Backend Engineer", "NY", 170_000, "s", 61],
];

const CARDS = [
  { index: 0, entryOnly: true, lines: ["Entry-level title, matches your roles", "Posting says it sponsors visas", "Asks for Kafka; your profile mentions RabbitMQ only"] },
  { index: 1, entryOnly: false, lines: ["Remote, within your list", "Posted salary is above your floor", "Asks for Go; your profile lists TypeScript and Python only"] },
  { index: 2, entryOnly: true, lines: ["New-grad title, matches your seniority", "Austin, within your list", "Asks for a year of React; your profile shows a course project only"] },
] as const;

/** Seeded PRNG (mulberry32) so posting order and ids are reproducible. */
function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], next: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

export function buildFitSample(): FitSample {
  const next = rng(20261015);
  const ids = shuffle(Array.from({ length: 999 }, (_, i) => i + 1), next);
  const order = shuffle(SPECS.map((_, i) => i), next);

  const rows = order.map((specIndex, position) => {
    const [co, title, place, salary, flags, score] = SPECS[specIndex]!;
    const description = [
      BASE_DESC[specIndex % BASE_DESC.length]!,
      flags.includes("s") ? NO_SPONSOR[specIndex % NO_SPONSOR.length]! : "",
      flags.includes("p") ? FLAG_TEXT.p : "",
      flags.includes("k") ? FLAG_TEXT.k : "",
    ]
      .filter(Boolean)
      .join(" ");
    const company = `Company ${pad(co, 3)}`;
    const job: FitJob = { title, companyName: company, ...PLACE[place], descriptionText: description, salaryMaxUsd: salary };
    return { specIndex, job, recent: RECENT[co] ?? 0, id: pad(ids[position]!, 4), score };
  });

  const combos: number[][] = [];
  for (const seniority of SENIORITY) {
    for (const needsSponsorship of [true, false]) {
      for (const cap of CAPS) {
        const prefs: Preferences = {
          ...BASE_PREFS,
          seniority: [seniority],
          workAuthorization: needsSponsorship ? "needs_sponsorship_now" : "citizen_or_pr",
          maxApplicationsPerCompanyPer30Days: cap,
        };
        combos.push(
          rows.map((row) => {
            const { reasons } = passesHardFilters(row.job, prefs, row.recent);
            let mask = 0;
            let last = -1;
            for (const reason of reasons) {
              const code = REASONS.indexOf(reason);
              // A reason fit.ts now words differently, or orders differently, must fail the build rather than ship stale text.
              if (code <= last) throw new Error(`Unexpected or out-of-order reason from passesHardFilters: ${reason}`);
              mask |= 1 << code;
              last = code;
            }
            return mask;
          }),
        );
      }
    }
  }

  const seen = new Set<number>();
  for (const masks of combos) for (const m of masks) REASONS.forEach((_, c) => m & (1 << c) && seen.add(c));
  if (seen.size !== REASONS.length) throw new Error("A reason string is never produced by any combination");

  const cards = CARDS.map((card) => {
    const row = rows.find((r) => r.specIndex === card.index)!;
    const at = rows.indexOf(row);
    // A line is only true where the posting passes and, for the seniority lines, the control is Entry.
    const validIn = combos.flatMap((masks, c) => (masks[at] === 0 && (!card.entryOnly || c < 6) ? [c] : []));
    return { id: row.id, title: `${row.job.companyName} · ${row.job.title}`, lines: [...card.lines] as [string, string, string], validIn };
  });

  return {
    version: 1,
    reasons: REASONS,
    postings: rows.map((r) => ({ id: r.id, company: r.job.companyName, title: r.job.title, score: r.score })),
    combos,
    cards,
  };
}

/** One line per posting, per combination and per card, so a changed rule shows up as a readable diff. */
export function serializeFitSample(s: FitSample): string {
  const lines = (items: unknown[]) => items.map((item) => `    ${JSON.stringify(item)}`).join(",\n");
  return [
    "{",
    `  "version": ${s.version},`,
    `  "reasons": [\n${lines(s.reasons)}\n  ],`,
    `  "postings": [\n${lines(s.postings)}\n  ],`,
    `  "combos": [\n${lines(s.combos)}\n  ],`,
    `  "cards": [\n${lines(s.cards)}\n  ]`,
    "}",
    "",
  ].join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  writeFileSync(SAMPLE_PATH, serializeFitSample(buildFitSample()));
  console.log(`Wrote ${SAMPLE_PATH}`);
}
