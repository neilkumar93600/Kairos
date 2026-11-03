import { readFileSync } from "node:fs";
import { chromium, type Browser } from "playwright-core";
import { applierEnv } from "../lib/env";
import { logger } from "../lib/logger";

/** What the pool needs of a browser; the tests pass fakes. */
export type PoolBrowser = Pick<Browser, "newContext" | "close" | "on" | "version">;

interface Generation {
  browser: Promise<PoolBrowser>;
  /** Contexts handed out by this browser. */
  contexts: number;
  /** Runs still using it. */
  active: number;
  retired: boolean;
}

/**
 * One Chromium per applier replica (07-cloud-applier 3.2 items 4 and 12, applications-58, scale-34). Each run gets the
 * current browser; after `recycleAfter` contexts, or when the memory watchdog asks, the browser is retired: new runs
 * start in a fresh one and the old one closes once its last run ends, so recycling never fails a run. A browser that
 * crashes or disconnects is relaunched by the next run. The BullMQ worker's concurrency is the slot count.
 */
export function browserPool(launch: () => Promise<PoolBrowser>, recycleAfter: number) {
  let current: Generation | undefined;
  /** Retired browsers whose runs have not all ended. */
  const draining = new Set<Generation>();

  function closeIfIdle(gen: Generation): void {
    if (gen.active > 0) return;
    draining.delete(gen);
    void gen.browser.then((b) => b.close()).catch(() => {});
  }

  function retire(gen: Generation, reason: string): void {
    if (gen.retired) return;
    gen.retired = true;
    if (current === gen) current = undefined;
    draining.add(gen);
    logger.info({ reason, contexts: gen.contexts }, "browser recycled");
    closeIfIdle(gen);
  }

  function generation(): Generation {
    if (current) return current;
    const gen: Generation = { browser: launch(), contexts: 0, active: 0, retired: false };
    current = gen;
    gen.browser.then(
      (b) =>
        b.on("disconnected", () => {
          if (current === gen) current = undefined;
          if (!gen.retired) logger.error({ contexts: gen.contexts }, "browser crashed; the next run relaunches it");
        }),
      () => {
        if (current === gen) current = undefined;
      },
    );
    return gen;
  }

  return {
    async run<T>(fn: (browser: PoolBrowser) => Promise<T>): Promise<T> {
      const gen = generation();
      gen.contexts += 1;
      gen.active += 1;
      if (gen.contexts >= recycleAfter) retire(gen, "contexts");
      try {
        return await fn(await gen.browser);
      } finally {
        gen.active -= 1;
        if (gen.retired) closeIfIdle(gen);
      }
    },
    /** Retires the current browser, unless an earlier one is still draining (a relaunch would only add memory). */
    recycle(reason: string): void {
      if (current && draining.size === 0) retire(current, reason);
    },
    /** The current browser, launched now if there is none. */
    warm: () => generation().browser,
    async close(): Promise<void> {
      const gen = current;
      current = undefined;
      await (await gen?.browser.catch(() => undefined))?.close();
    },
  };
}

/**
 * The container's memory in MB: cgroup v2 counts Chromium's processes too. ponytail: replica-wide, not per context
 * (the spec's 900 MB per-context kill needs per-process accounting over CDP); outside a cgroup v2 container it falls
 * back to Node's own RSS, which misses Chromium.
 */
export function containerMemoryMb(): number {
  try {
    return Number(readFileSync("/sys/fs/cgroup/memory.current", "utf8")) / 2 ** 20;
  } catch {
    return process.memoryUsage().rss / 2 ** 20;
  }
}

/** The memory watchdog (scale-34): above `limitMb` the browser is recycled, so the leak goes with it once its runs end. */
export function watchMemory(pool: { recycle(reason: string): void }, limitMb: number, readMb = containerMemoryMb, everyMs = 10_000): NodeJS.Timeout {
  return setInterval(() => {
    const rssMb = Math.round(readMb());
    if (rssMb > limitMb) {
      logger.warn({ rssMb, limitMb }, "applier memory above the limit");
      pool.recycle("memory");
    }
  }, everyMs).unref();
}

let shared: ReturnType<typeof browserPool> | undefined;

/** The applier's pool. Without chromiumSandbox: true Playwright adds --no-sandbox; off only under the signed S-AP4 risk acceptance. */
export function applierPool(): ReturnType<typeof browserPool> {
  shared ??= browserPool(() => {
    const e = applierEnv();
    return chromium.launch({ headless: true, executablePath: e.CHROMIUM_EXECUTABLE_PATH, chromiumSandbox: e.APPLIER_CHROMIUM_SANDBOX });
  }, applierEnv().APPLIER_RECYCLE_AFTER);
  return shared;
}

/** Launches Chromium at boot, so a sandbox that cannot start (spike S-AP4) shows in the log before any claim. */
export async function warmBrowser(): Promise<void> {
  await applierPool()
    .warm()
    .then(
      (b) => logger.info({ version: b.version(), sandbox: applierEnv().APPLIER_CHROMIUM_SANDBOX }, "chromium launched"),
      (err) => logger.error({ err }, "chromium failed to launch (with 'No usable sandbox', see S-AP4 in owner-actions/WP-04.md)"),
    );
}

export async function closeBrowser(): Promise<void> {
  await shared?.close();
}
