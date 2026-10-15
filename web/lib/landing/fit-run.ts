/** Entry 02 sample run, the pure part (sections/05-entry-02-fit-gate.md 10.1): precomputed hard-rule masks in, counts out. */
export type Seniority = "entry" | "mid" | "senior";
export type Sponsorship = "yes" | "no";
export type Cap = 1 | 2 | 3;

export interface FitSample {
  version: 1;
  /** Exact fit.ts strings in fit.ts order; index = reason code. */
  reasons: string[];
  postings: { id: string; company: string; title: string; score: number }[];
  /** 18 arrays of 48 bitmasks; bit c set = reason code c; 0 = passes. */
  combos: number[][];
  cards: { id: string; title: string; lines: [string, string, string]; validIn: number[] }[];
}

export interface RunResult {
  skipped: number;
  passed: number;
  kept: number;
  below: number;
  /** Codes present, fit.ts order. */
  rows: { code: number; count: number; postings: number[] }[];
  /** Kept, valid in this combo, score descending, at most 3. */
  cards: FitSample["cards"];
  more: number;
}

export const SENIORITIES: Seniority[] = ["entry", "mid", "senior"];

export const comboIndex = (s: Seniority, v: Sponsorship, c: Cap) =>
  SENIORITIES.indexOf(s) * 6 + (v === "yes" ? 0 : 3) + (c - 1);

export function computeRun(sample: FitSample, combo: number, bar: number): RunResult {
  const masks = sample.combos[combo];
  const rows = sample.reasons.map((_, code) => ({ code, count: 0, postings: [] as number[] }));
  let skipped = 0;
  let kept = 0;
  masks.forEach((m, i) => {
    if (m === 0) {
      if (sample.postings[i].score >= bar) kept++;
      return;
    }
    skipped++;
    for (const r of rows) {
      if (m & (1 << r.code)) {
        r.count++;
        r.postings.push(i);
      }
    }
  });
  const passed = masks.length - skipped;
  const score = (id: string) => sample.postings.find((p) => p.id === id)?.score ?? 0;
  const cards = sample.cards
    .filter((card) => {
      const i = sample.postings.findIndex((p) => p.id === card.id);
      return i >= 0 && masks[i] === 0 && sample.postings[i].score >= bar && card.validIn.includes(combo);
    })
    .sort((a, b) => score(b.id) - score(a.id))
    .slice(0, 3);
  return { skipped, passed, kept, below: passed - kept, rows: rows.filter((r) => r.count > 0), cards, more: kept - cards.length };
}
