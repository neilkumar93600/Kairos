import { describe, expect, it, vi } from "vitest";

// Review mode (side panel "Review"): the extension fills, the user presses the board's own submit. Ported from the R3d probe.
// Each test uses its own application id: content scripts from earlier tests keep polling, and the worker ignores a report or a
// handover for an application it did not open in that tab.
const ITEM = { applicationId: "", applyUrl: "", title: "Engineer", answers: [{ fieldKey: "email", label: "Email", value: "a@b.co", source: "profile" }], resumeLines: [], coverLetter: null };
const reports: Array<{ applicationId: string; outcome: string }> = [];
const calls: string[] = [];
let onMessage: (m: unknown, s: unknown, r: (v: unknown) => void) => boolean;
let onRemoved: (tabId: number) => void;
const session: Record<string, unknown> = {};
const toBackground = (m: unknown) => new Promise((resolve) => onMessage(m, { tab: { id: 7 } }, resolve));
const location = { href: "" };
const settle = () => new Promise((r) => setTimeout(r, 50));
// A description that already reads like a confirmation (P1).
const PAGE = `<h1>Engineer</h1><p>Thank you for applying! Every application received is read by a person.</p><form><input name=email><button type=submit>Submit application</button></form>`;

/** Opens `applyUrl` in review mode and runs the content script on it. */
async function review(applyUrl: string) {
  reports.length = 0;
  calls.length = 0;
  for (const k of Object.keys(session)) delete session[k];
  vi.resetModules();
  ITEM.applicationId = crypto.randomUUID();
  ITEM.applyUrl = applyUrl;
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    calls.push(path);
    if (path === "/api/extension/queue") return Response.json({ queue: [ITEM] });
    if (path === "/api/extension/report") reports.push(JSON.parse(String(init?.body)));
    return Response.json({ claimed: true, released: true, status: "submitted" });
  });
  vi.stubGlobal("chrome", {
    action: { onClicked: { addListener() {} } },
    sidePanel: { open() {} },
    runtime: { onMessage: { addListener: (f: typeof onMessage) => (onMessage = f) }, onMessageExternal: { addListener() {} }, sendMessage: toBackground, getManifest: () => ({ content_scripts: [] }) },
    tabs: { create: async () => ({ id: 7 }), update: async () => ({}), remove: async () => undefined, onUpdated: { addListener() {} }, onRemoved: { addListener: (f: typeof onRemoved) => (onRemoved = f) } },
    storage: {
      local: { get: async () => ({ authToken: "t" }), remove: async () => undefined, set: async () => undefined },
      session: { get: async (k: string) => ({ [k]: session[k] }), set: async (o: Record<string, unknown>) => void Object.assign(session, o), remove: async (k: string) => void delete session[k] },
    },
  });
  await import("../src/background");
  await toBackground({ type: "queue:send", applicationId: ITEM.applicationId, review: true });
  await pageLoad(applyUrl, PAGE);
  document.querySelector("form")!.addEventListener("submit", (e) => e.preventDefault());
}

/** A new page in the tab: a fresh content script. */
async function pageLoad(href: string, body: string) {
  vi.resetModules();
  document.body.innerHTML = body;
  location.href = href;
  vi.stubGlobal("window", { location });
  await import("../src/content");
  await settle();
}

const mine = () => reports.filter((r) => r.applicationId === ITEM.applicationId);
const BOARDS = { ashby: "https://jobs.ashbyhq.com/acme/1/application", lever: "https://jobs.lever.co/acme/1/apply", greenhouse: "https://job-boards.greenhouse.io/acme/jobs/1" };

describe("review mode never confirms on page text (P1)", () => {
  for (const [board, url] of Object.entries(BOARDS))
    it(`${board}: a description saying "Thank you for applying" and no click reports nothing`, async () => {
      await review(url);
      await new Promise((r) => setTimeout(r, 1500)); // past the content script's first poll
      expect(mine()).toEqual([]);
    });
});

describe("review mode confirms only at the board's confirmation address", () => {
  it("greenhouse: the address changes in place to /confirmation after the user's submit -> submitted", async () => {
    await review(BOARDS.greenhouse);
    (document.querySelector("button") as HTMLButtonElement).click();
    location.href = "https://job-boards.greenhouse.io/acme/jobs/1/confirmation";
    await vi.waitFor(() => expect(mine()).toMatchObject([{ outcome: "submitted", filledFields: [{ fieldKey: "email" }] }]), { timeout: 3000 });
  });

  it("lever: the submit navigates to /thanks, the new page is confirm-only -> submitted, and the form is never refilled", async () => {
    await review(BOARDS.lever);
    (document.querySelector("button") as HTMLButtonElement).click();
    await settle();
    expect(await toBackground({ type: "content:ready" })).toEqual({ confirmOnly: true, applicationId: ITEM.applicationId });
    await pageLoad("https://jobs.lever.co/acme/1/thanks", "<h1>Thank you for applying</h1>");
    expect(mine()).toMatchObject([{ outcome: "submitted" }]);
  });
});

describe("closing a review tab", () => {
  it("before the user pressed submit: the claim is released", async () => {
    await review(BOARDS.ashby);
    onRemoved(7);
    await vi.waitFor(() => expect(calls).toContain("/api/extension/release"));
  });

  it("after the user pressed submit: no release (the lease settles as needs_check, no charge)", async () => {
    await review(BOARDS.ashby);
    (document.querySelector("button") as HTMLButtonElement).click();
    await settle();
    onRemoved(7);
    await settle();
    expect(calls).not.toContain("/api/extension/release");
    expect(mine()).toEqual([]);
  });
});
