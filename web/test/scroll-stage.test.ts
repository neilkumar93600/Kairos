import { describe, expect, it } from "vitest";
import { bandFromMargin, stepsFromRects } from "@/components/landing/motion/scroll-stage";

// Viewport 1000 px tall, wide band "-45% 0px -45% 0px" => [450, 550]. Three 300 px step blocks, 600 px apart.
const band = { top: 450, bottom: 550 };
const steps = (y: number) => [0, 1, 2].map((i) => ({ top: y + i * 600, bottom: y + i * 600 + 300 }));

describe("stepsFromRects", () => {
  it("reaches nothing while the track is below the band", () => {
    expect(stepsFromRects(steps(800), band, [])).toEqual({ active: null, reached: [] });
  });

  it("activates the middle step inside the band", () => {
    // step 0 at -200..100 (above the band), step 1 at 400..700 (in it), step 2 at 1000 (below)
    expect(stepsFromRects(steps(-200), band, [])).toEqual({ active: 1, reached: [0, 1] });
  });

  it("counts a step that jumped over the band in one frame as reached", () => {
    // before: step 1 at 1100..1400 (below); after one flick: step 1 at 100..400 (above), nothing in the band
    const before = stepsFromRects(steps(500), band, []);
    expect(before.reached).toEqual([0]);
    const after = stepsFromRects(steps(-500), band, before.reached);
    expect(after.reached).toEqual([0, 1]);
    expect(after.active).toBe(null);
  });

  it("never shrinks reached when scrolling back up", () => {
    const down = stepsFromRects(steps(-1000), band, []);
    expect(down.reached).toEqual([0, 1, 2]);
    expect(stepsFromRects(steps(2000), band, down.reached).reached).toEqual([0, 1, 2]);
  });
});

describe("bandFromMargin", () => {
  it("turns percent and px insets into viewport edges", () => {
    expect(bandFromMargin("-45% 0px -45% 0px", 1000)).toEqual({ top: 450, bottom: 550 });
    expect(bandFromMargin("-78% 0px -16% 0px", 1000)).toEqual({ top: 780, bottom: 840 });
    expect(bandFromMargin("-10px 0px -20px 0px", 1000)).toEqual({ top: 10, bottom: 980 });
  });
});
