import { chromium } from "playwright-core";
import { vi } from "vitest";

/**
 * Stands in for Chromium in the integration tests (CI has Postgres but no browser): chromium.launch resolves to a
 * browser whose one page shows `frames` (each visible) and whose filler call returns `fill()`. Real page behaviour
 * is covered by cloud-apply.browser.test.ts. Returns the fill spy. Call closeBrowser() (jobs/browser-pool.ts) after each test.
 */
export function fakeBrowser(opts: { frames?: string[]; fill?: () => Promise<unknown> } = {}) {
  const fill = vi.fn(opts.fill ?? (async () => ({})));
  const page = {
    on: () => {},
    url: () => "https://job-boards.greenhouse.io/x/jobs/1",
    title: async () => "Apply",
    $: async () => null,
    goto: async () => ({ status: () => 200 }),
    waitForLoadState: async () => {},
    frames: () => (opts.frames ?? []).map((u) => ({ url: () => u, frameElement: async () => ({ evaluate: async () => true }) })),
    evaluate: async (fn: unknown) => (typeof fn === "string" ? undefined : fill()),
  };
  const context = { route: async () => {}, on: () => {}, newPage: async () => page, close: async () => {} };
  vi.spyOn(chromium, "launch").mockResolvedValue({ newContext: async () => context, on: () => {}, close: async () => {} } as never);
  return fill;
}
