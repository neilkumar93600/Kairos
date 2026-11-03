import { afterEach, describe, expect, it, vi } from "vitest";
import { browserPool, watchMemory, type PoolBrowser } from "../src/jobs/browser-pool";

/** WP-45 (applications-58, scale-34): one Chromium per applier, recycled every 25 contexts and on memory pressure. */

class FakeBrowser {
  closed = false;
  contexts = 0;
  private onDisconnect: (() => void) | undefined;
  newContext = async () => ({}) as never;
  version = () => "fake";
  on(_event: "disconnected", fn: () => void) {
    this.onDisconnect = fn;
    return this;
  }
  async close() {
    this.closed = true;
  }
  crash() {
    this.closed = true;
    this.onDisconnect?.();
  }
}

function fakeLaunch() {
  const browsers: FakeBrowser[] = [];
  const launch = vi.fn(async () => {
    const b = new FakeBrowser();
    browsers.push(b);
    return b as unknown as PoolBrowser;
  });
  return { browsers, launch };
}

const tick = () => new Promise((r) => setTimeout(r, Math.random() * 3));

/** A run that fails if its browser is closed under it. */
async function run(b: PoolBrowser) {
  const fake = b as unknown as FakeBrowser;
  fake.contexts += 1;
  for (let i = 0; i < 3; i++) {
    if (fake.closed) throw new Error("browser closed during a run");
    await tick();
  }
  return "ok";
}

afterEach(() => vi.useRealTimers());

describe("browser pool", () => {
  it("recycles the browser after 25 contexts with no failed runs, four at a time", async () => {
    const { browsers, launch } = fakeLaunch();
    const pool = browserPool(launch, 25);
    const results: string[] = [];
    let next = 0;
    // Four slots, like APPLIER_CONCURRENCY = 4, taking 60 runs in turn.
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (next < 60) {
          next += 1;
          results.push(await pool.run(run));
        }
      }),
    );
    expect(results).toEqual(Array(60).fill("ok"));
    expect(launch).toHaveBeenCalledTimes(3);
    expect(browsers.map((b) => b.contexts)).toEqual([25, 25, 10]);
    // Each retired browser closed once its last run ended; the current one stays up for the next run.
    await tick();
    expect(browsers.map((b) => b.closed)).toEqual([true, true, false]);
    await pool.close();
    expect(browsers[2]!.closed).toBe(true);
  });

  it("relaunches on the next run after Chromium crashes or disconnects", async () => {
    const { browsers, launch } = fakeLaunch();
    const pool = browserPool(launch, 25);
    await pool.run(run);
    browsers[0]!.crash();
    await pool.run(run);
    expect(launch).toHaveBeenCalledTimes(2);
    expect(browsers[1]!.contexts).toBe(1);
  });

  it("fails only the run whose launch failed, and launches again for the next", async () => {
    const launch = vi.fn<() => Promise<PoolBrowser>>().mockRejectedValueOnce(new Error("No usable sandbox"));
    launch.mockResolvedValue(new FakeBrowser() as unknown as PoolBrowser);
    const pool = browserPool(launch, 25);
    await expect(pool.run(run)).rejects.toThrow(/sandbox/);
    await expect(pool.run(run)).resolves.toBe("ok");
    expect(launch).toHaveBeenCalledTimes(2);
  });

  it("the memory watchdog moves new runs to a fresh browser and lets the old one finish its run", async () => {
    vi.useFakeTimers();
    const { browsers, launch } = fakeLaunch();
    const pool = browserPool(launch, 25);
    let release!: () => void;
    const long = pool.run(async (b) => {
      await new Promise<void>((r) => (release = r));
      return (b as unknown as FakeBrowser).closed ? "closed under the run" : "ok";
    });
    await vi.advanceTimersByTimeAsync(0);

    let rssMb = 4_000;
    const timer = watchMemory(pool, 3_600, () => rssMb, 10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    // Still high while the old browser drains: no second recycle, so no relaunch storm.
    await vi.advanceTimersByTimeAsync(30_000);
    await pool.run(async () => "ok");
    expect(launch).toHaveBeenCalledTimes(2);
    expect(browsers[0]!.closed).toBe(false);

    release();
    await expect(long).resolves.toBe("ok");
    expect(browsers[0]!.closed).toBe(true);
    rssMb = 1_000;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(launch).toHaveBeenCalledTimes(2);
    clearInterval(timer);
  });
});
