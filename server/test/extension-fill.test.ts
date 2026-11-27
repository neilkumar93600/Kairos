import type { AtsProvider, ApplicationAnswer } from "@auto-career/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FillPayload } from "../../extension/src/lib/messages";
import { createFakeAts, CUSTOM_QUESTION_FIELD, formUrl, SENSITIVE_FIELDS } from "./fake-ats";
import { fillFakeForm } from "./extension-fixture";

/**
 * T-006.6: the real extension filler on the three fake employer forms (jsdom, no network). INV-9: the work-authorization,
 * sponsorship and EEO fields get only what the user stored; INV-8: a challenge page is a failure, never a submit.
 */
const ATSES: AtsProvider[] = ["greenhouse", "lever", "ashby"];
const APP_ID = "8d6f2a3e-1d3c-4b8f-9a7e-2f1e0c9b7a61";

const SENSITIVE_LABELS = { work_auth: "Are you legally authorized to work in the United States?", sponsorship: "Will you now or in the future require visa sponsorship?" };
/** Per ATS: the labels of the custom question and the EEO gender field, and what the form's select calls "decline". */
const FORM: Record<AtsProvider, { custom: string; decline: string }> = {
  greenhouse: { custom: "Why do you want to work at Acme?", decline: "3" },
  lever: { custom: "What interests you about working at Acme?", decline: "Decline to self-identify" },
  ashby: { custom: "Why Acme?", decline: "Decline to self-identify" },
};

const a = (fieldKey: string, label: string, value: string, source: ApplicationAnswer["source"] = "profile"): ApplicationAnswer => ({ fieldKey, label, value, source });
const profile = [a("first_name", "First name", "Nilesh"), a("last_name", "Last name", "Kumar"), a("email", "Email", "nilesh@example.com")];

function payload(ats: AtsProvider, opts: { sensitive: boolean; submit?: boolean }): FillPayload {
  const sensitive = opts.sensitive
    ? [a("work_auth", SENSITIVE_LABELS.work_auth, "Yes", "saved_answer"), a("sponsorship", SENSITIVE_LABELS.sponsorship, "No", "saved_answer"), a("gender", "Gender", "Decline to self-identify", "saved_answer")]
    : [];
  return {
    applicationId: APP_ID,
    submit: opts.submit ?? true,
    coverLetter: null,
    resumeLines: [],
    answers: [...profile, a("why", FORM[ats].custom, "I like building tools that help people find work.", "generated"), ...sensitive],
  };
}

const fake = createFakeAts();
const accepted = () => fake.submissions.filter((s) => s.accepted);
afterEach(() => {
  fake.assertClean();
  fake.submissions.length = 0;
  vi.useRealTimers();
});

describe.each(ATSES)("the extension filler on the %s fake form", (ats) => {
  const url = formUrl(ats, "fit");
  const [auth, sponsor] = SENSITIVE_FIELDS[ats];

  it("fills, uploads the resume, submits once and reads the confirmation", async () => {
    const { report } = await fillFakeForm(fake, url, payload(ats, { sensitive: true }));
    expect(report).toMatchObject({ outcome: "submitted", applicationId: APP_ID });
    expect(report.filledFields.map((f) => f.fieldKey)).toEqual(expect.arrayContaining(["email", "why", "work_auth", "sponsorship", "resume"]));

    expect(fake.submissions).toHaveLength(1);
    const sent = fake.submissions[0]!;
    expect(sent.accepted).toBe(true);
    expect(Object.keys(sent.files)).toHaveLength(1);
    expect(Object.values(sent.files)[0]).toBe("resume.pdf");
    expect(sent.fields[CUSTOM_QUESTION_FIELD[ats]]).toBe("I like building tools that help people find work.");
    const email = ats === "ashby" ? "_systemfield_email" : "email";
    expect(sent.fields[email]).toBe("nilesh@example.com");
  });

  it("INV-9: work authorization, sponsorship and EEO carry the stored answers and nothing else", async () => {
    await fillFakeForm(fake, url, payload(ats, { sensitive: true }));
    const sent = fake.submissions.at(-1)!.fields;
    const yes = ats === "greenhouse" ? "1" : "Yes";
    const no = ats === "greenhouse" ? "0" : "No";
    expect(sent[auth!]).toBe(yes);
    expect(sent[sponsor!]).toBe(no);
    // Only the gender answer was stored: the other EEO fields stay empty, whatever the form offers.
    const eeo = SENSITIVE_FIELDS[ats].filter((n) => n !== auth && n !== sponsor);
    const filled = eeo.filter((n) => sent[n]);
    expect(filled).toHaveLength(1);
    expect(sent[filled[0]!]).toBe(FORM[ats].decline);
  });

  it("never invents a value: no stored sensitive answer means the form is left alone and nothing is sent", async () => {
    const { report, values } = await fillFakeForm(fake, url, payload(ats, { sensitive: false }));
    expect(report.outcome).toBe("failed");
    expect(report.failureReason).toMatch(/Required fields left empty: 2/);
    expect(fake.submissions).toEqual([]);
    for (const name of SENSITIVE_FIELDS[ats]) expect(values[name]).toBe("");
    // Optional fields with no answer (phone, linkedin, github) are blank too.
    const optional = ats === "ashby" ? ["_systemfield_phone", "_systemfield_linkedin"] : ats === "lever" ? ["phone", "urls[LinkedIn]", "urls[GitHub]"] : ["phone", "linkedin_profile"];
    for (const name of optional) expect(values[name]).toBe("");
  });

  it("review mode fills and stops: no POST", async () => {
    const { report, values } = await fillFakeForm(fake, url, payload(ats, { sensitive: true, submit: false }));
    expect(report).toMatchObject({ outcome: "failed", failureReason: "Filled for review; not submitted" });
    expect(fake.submissions).toEqual([]);
    expect(values[auth!]).not.toBe("");
  });

  it("INV-5: a posting that says 'application received' is not a confirmation; a refused POST stays a failure", async () => {
    fake.setFormVariant(ats, "fit", "challenge");
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    const run = fillFakeForm(fake, url, payload(ats, { sensitive: true }), { stayOnError: true, html: (p) => p.replace("<form", "<p>Every application received is read by a person.</p><form") });
    await vi.advanceTimersByTimeAsync(25_000);
    const { report } = await run;
    expect(report.outcome).toBe("failed");
    expect(fake.submissions.every((s) => !s.accepted)).toBe(true);
    fake.setFormVariant(ats, "fit", "open");
  });

  it("a real confirmation still counts when the posting already contained the words: the new text is what confirms", async () => {
    const { report } = await fillFakeForm(fake, url, payload(ats, { sensitive: true }), { html: (p) => p.replace("<form", "<p>Every application received is read by a person.</p><form") });
    expect(report).toMatchObject({ outcome: "submitted", matchedBefore: true });
    expect(accepted()).toHaveLength(1);
  });

  it("INV-8: a challenge page is a failure; the filler does not get past it", async () => {
    fake.setFormVariant(ats, "fit", "challenge");
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    const run = fillFakeForm(fake, url, payload(ats, { sensitive: true }));
    await vi.advanceTimersByTimeAsync(25_000);
    const { report } = await run;
    expect(report.outcome).toBe("failed");
    expect(fake.submissions.every((s) => !s.accepted)).toBe(true);
    fake.setFormVariant(ats, "fit", "open");
  });
});
