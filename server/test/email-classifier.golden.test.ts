import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyByRules, RULES_VERSION, stripQuoted } from "../src/services/email-classifier";

/**
 * The rules golden file (messaging-17; workers/10-inbound-email.md 3.3). classifyEmail runs classifyByRules on the subject
 * and stripQuoted(body), so this does too. A change to any rule bumps RULES_VERSION, keeps this green and gets an owner
 * review, because the offer rule is the only path to a billing pause.
 */
type Case = { group: string; kind: string | null; subject: string; body: string; note?: string };
const cases: Case[] = readFileSync(new URL("./fixtures/inbox/rules-golden.jsonl", import.meta.url), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line) as Case);

describe("rules golden file", () => {
  it(`holds at least 200 cases at RULES_VERSION ${RULES_VERSION}, with all 40 "offer you an interview" wordings`, () => {
    expect(cases.length).toBeGreaterThanOrEqual(200);
    expect(cases.filter((c) => c.group === "offer_you_an_interview")).toHaveLength(40);
  });

  it.each(cases.map((c) => [c.group, c.subject, c.body, c.kind] as const))("%s: %s / %s", (_group, subject, body, kind) => {
    expect(classifyByRules(subject, stripQuoted(body))).toBe(kind);
  });

  it('an "offer you an interview" wording never yields offer', () => {
    for (const c of cases.filter((x) => x.group === "offer_you_an_interview")) {
      expect(classifyByRules(c.subject, stripQuoted(c.body)), c.body).not.toBe("offer");
    }
  });
});
