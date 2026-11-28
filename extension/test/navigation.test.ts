import { beforeEach, describe, expect, it, vi } from "vitest";

// A navigating submit (Lever /thanks, classic Greenhouse): the content script of the form page dies, a NEW one starts on the next page.
// Two separate content-script instances share one background worker here, so nothing carries over in memory.
const ITEM = { applicationId: "8d6f2a3e-1d3c-4b8f-9a7e-2f1e0c9b7a61", applyUrl: "https://jobs.lever.co/acme/1/apply", title: "Engineer", answers: [{ fieldKey: "email", label: "Email", value: "a@b.co", source: "profile" }], resumeLines: [], coverLetter: null };
const reports: unknown[] = [];
let onMessage: (m: unknown, s: unknown, r: (v: unknown) => void) => boolean;
const session: Record<string, unknown> = {};
const toBackground = (m: unknown) => new Promise((resolve) => onMessage(m, { tab: { id: 7 } }, resolve));

beforeEach(async () => {
  reports.length = 0;
  for (const k of Object.keys(session)) delete session[k];
  vi.resetModules();
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    if (path === "/api/extension/queue") return Response.json({ queue: [ITEM] });
    if (path === "/api/extension/report") reports.push(JSON.parse(String(init?.body)));
    return Response.json({ claimed: true, released: true, status: "submitted" });
  });
  vi.stubGlobal("chrome", {
    action: { onClicked: { addListener() {} } },
    sidePanel: { open() {} },
    runtime: { onMessage: { addListener: (f: typeof onMessage) => (onMessage = f) }, onMessageExternal: { addListener() {} }, sendMessage: toBackground, getManifest: () => ({ content_scripts: [] }) },
    tabs: { create: async () => ({ id: 7 }), update: async () => ({}), remove: async () => undefined, onUpdated: { addListener() {} }, onRemoved: { addListener() {} } },
    storage: {
      local: { get: async () => ({ authToken: "t" }), remove: async () => undefined, set: async () => undefined },
      session: { get: async (k: string) => ({ [k]: session[k] }), set: async (o: Record<string, unknown>) => void Object.assign(session, o), remove: async (k: string) => void delete session[k] },
    },
  });
  await import("../src/background");
  await toBackground({ type: "queue:send", applicationId: ITEM.applicationId, review: false });
});

/** Starts a fresh content script on `href` (a new page: new module instance, the form page's one is gone). */
async function pageLoad(href: string, body: string) {
  vi.resetModules();
  document.body.innerHTML = body;
  vi.stubGlobal("window", { location: { href } });
  await import("../src/content");
  await vi.waitFor(() => expect(true).toBe(true));
  await new Promise((r) => setTimeout(r, 30));
}

describe("a navigating submit", () => {
  it("reports submitted from the new page only when it is the board's confirmation address", async () => {
    // Page 1: the form. The worker hands the payload; the filler clicks and the page navigates away before it reports.
    expect(await toBackground({ type: "content:ready" })).toMatchObject({ submit: true, answers: [{ fieldKey: "email" }] });
    // Page 2: /thanks, a new content script. It gets the confirm-only marker, never the answers.
    await pageLoad("https://jobs.lever.co/acme/1/thanks", "<h1>Thank you for applying</h1>");
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ applicationId: ITEM.applicationId, outcome: "submitted", filledFields: [] });
  });

  it("a text-only look-alike (the form page again, or a description saying 'application received') reports nothing", async () => {
    await toBackground({ type: "content:ready" });
    await pageLoad("https://jobs.lever.co/acme/1/apply", "<p>Every application received is read by a person.</p><button type=submit>Submit</button>");
    expect(reports).toEqual([]);
    expect((document.querySelector("button") as HTMLButtonElement).disabled).toBe(false); // and it did not click
  });

  it("Ashby confirms in place, so a page loaded after the submit is never a confirmation", async () => {
    await toBackground({ type: "content:ready" });
    await pageLoad("https://jobs.ashbyhq.com/acme/1/application", "<h1>Thank you for applying</h1>");
    expect(reports).toEqual([]);
  });
});
