import { beforeEach, describe, expect, it } from "vitest";
import { detectAdapter } from "../src/ats";
import { fillApplication } from "../src/filler";
import { findField, normalizeLabel, setValue } from "../src/lib/fill";
import type { FillPayload } from "../src/lib/messages";

const greenhouseUrl = "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=1";

function loc(href: string): Location {
  return { href } as Location;
}

const payload = (submit: boolean): FillPayload => ({
  applicationId: "8d6f2a3e-1d3c-4b8f-9a7e-2f1e0c9b7a61",
  submit,
  coverLetter: null,
  resumeLines: [],
  answers: [
    { fieldKey: "first_name", label: "First name", value: "Nilesh", source: "profile" },
    { fieldKey: "last_name", label: "Last name", value: "Kumar", source: "profile" },
    { fieldKey: "email", label: "Email", value: "nilesh@example.com", source: "profile" },
    { fieldKey: "work_auth", label: "Are you legally authorized to work in the United States?", value: "Yes", source: "saved_answer" },
  ],
});

beforeEach(() => {
  document.body.innerHTML = `
    <form id="application_form">
      <label for="first_name">First Name *</label><input id="first_name" required />
      <label for="last_name">Last Name *</label><input id="last_name" required />
      <label for="email">Email *</label><input id="email" type="email" required />
      <label for="q1">Are you legally authorized to work in the United States? *</label>
      <select id="q1" required><option value="">Select</option><option value="1">Yes</option><option value="0">No</option></select>
      <button type="submit">Submit application</button>
    </form>`;
  document.querySelector("form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    document.body.innerHTML = "<h1>Thank you for applying!</h1>";
  });
});

describe("form helpers", () => {
  it("detects supported boards by URL", () => {
    expect(detectAdapter(new URL(greenhouseUrl))?.provider).toBe("greenhouse");
    expect(detectAdapter(new URL("https://jobs.lever.co/acme/1/apply"))?.provider).toBe("lever");
    expect(detectAdapter(new URL("https://example.com/careers"))).toBeNull();
  });

  it("normalizes labels with asterisks and punctuation", () => {
    expect(normalizeLabel("  Are you legally authorized?* ")).toBe("are you legally authorized");
  });

  it("finds a select by its label and picks the option by text", () => {
    const el = findField(document, "work_auth", "Are you legally authorized to work in the United States?");
    expect(el?.id).toBe("q1");
    expect(setValue(el!, "Yes")).toBe(true);
    expect((el as HTMLSelectElement).value).toBe("1");
  });
});

describe("fillApplication", () => {
  it("fills every answer and stops before submitting in review mode", async () => {
    const report = await fillApplication(payload(false), document, loc(greenhouseUrl));
    expect(report.outcome).toBe("failed");
    expect(report.failureReason).toBe("Filled for review; not submitted");
    expect(report.filledFields.map((f) => f.fieldKey)).toEqual(["first_name", "last_name", "email", "work_auth"]);
    expect((document.getElementById("email") as HTMLInputElement).value).toBe("nilesh@example.com");
  });

  it("submits and reports success when the board confirms", async () => {
    const report = await fillApplication(payload(true), document, loc(greenhouseUrl));
    expect(report.outcome).toBe("submitted");
    expect(report.confirmationText).toContain("Thank you for applying");
  });

  it("refuses to submit while a required field is empty", async () => {
    const p = payload(true);
    p.answers = p.answers.filter((a) => a.fieldKey !== "email");
    const report = await fillApplication(p, document, loc(greenhouseUrl));
    expect(report.outcome).toBe("failed");
    expect(report.failureReason).toMatch(/Required fields left empty: 1/);
  });
});
