import { beforeEach, describe, expect, it, vi } from "vitest";

// INV-4: pressing Send claims the application first; a refused claim opens no tab, and a tab that never reports gives the claim back.
const item = { applicationId: "app-1", applyUrl: "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=1", title: "Engineer", answers: [], resumeLines: [], coverLetter: null };
const calls: string[] = [];
let claimStatus = 200;
let onMessage: (m: unknown, s: unknown, r: (v: unknown) => void) => boolean;
let onRemoved: (tabId: number) => void;
const session: Record<string, unknown> = {};

beforeEach(async () => {
  calls.length = 0;
  claimStatus = 200;
  for (const k of Object.keys(session)) delete session[k];
  vi.resetModules();
  vi.stubGlobal("fetch", async (url: string) => {
    const path = new URL(url).pathname;
    calls.push(path);
    if (path === "/api/extension/queue") return Response.json({ queue: [item] });
    if (path === "/api/extension/claim") return Response.json({ claimed: true }, { status: claimStatus });
    return Response.json({ released: true });
  });
  vi.stubGlobal("chrome", {
    action: { onClicked: { addListener() {} } },
    sidePanel: { open() {} },
    runtime: { onMessage: { addListener: (f: typeof onMessage) => (onMessage = f) }, onMessageExternal: { addListener() {} }, sendMessage: async () => undefined, getManifest: () => ({ content_scripts: [] }) },
    tabs: {
      create: async () => (calls.push("tabs.create"), { id: 7 }),
      update: async () => (calls.push("tabs.update"), {}),
      remove: async () => undefined,
      onUpdated: { addListener() {} },
      onRemoved: { addListener: (f: typeof onRemoved) => (onRemoved = f) },
    },
    storage: {
      local: { get: async () => ({ authToken: "t" }), remove: async () => undefined, set: async () => undefined },
      session: { get: async (k: string) => ({ [k]: session[k] }), set: async (o: Record<string, unknown>) => void Object.assign(session, o), remove: async (k: string) => void delete session[k] },
    },
  });
  await import("../src/background");
});

const send = (review = false) => new Promise<{ error?: string }>((resolve) => onMessage({ type: "queue:send", applicationId: "app-1", review }, {}, resolve as (v: unknown) => void));
const ready = () => new Promise<{ applicationId?: string; answers?: unknown[] } | null>((resolve) => onMessage({ type: "content:ready" }, { tab: { id: 7 } }, resolve as (v: unknown) => void));

describe("the send press", () => {
  it("claims before it opens the tab", async () => {
    expect(await send()).toEqual({ ok: true });
    expect(calls.filter((c) => c !== "/api/extension/queue")).toEqual(["/api/extension/claim", "tabs.create", "tabs.update"]);
  });

  it("opens nothing when another tab holds the claim", async () => {
    claimStatus = 409;
    expect((await send()).error).toBe("api_409");
    expect(calls).not.toContain("tabs.create");
  });

  it("releases the claim when the tab closes without a report", async () => {
    await send();
    onRemoved(7);
    await vi.waitFor(() => expect(calls).toContain("/api/extension/release"));
  });

  it("hands a submit payload to the page once: a page after a navigating submit gets a confirm-only marker", async () => {
    await send();
    expect(await ready()).toMatchObject({ applicationId: "app-1", submit: true });
    expect(await ready()).toEqual({ confirmOnly: true, applicationId: "app-1" }); // never the payload again
  });

  it("never releases after a submit payload was handed over: the filler may have clicked, so the lease settles as no_report", async () => {
    await send();
    await ready();
    onRemoved(7);
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).not.toContain("/api/extension/release");
  });

  it("review mode releases when the tab closes, even after the payload was handed over (the user presses submit)", async () => {
    await send(true);
    await ready();
    onRemoved(7);
    await vi.waitFor(() => expect(calls).toContain("/api/extension/release"));
  });
});
