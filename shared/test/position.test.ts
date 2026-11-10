import { describe, expect, it } from "vitest";
import { positionBetween } from "../src/position";

describe("positionBetween", () => {
  it("fits between neighbours, byte-wise, however often one gap is split", () => {
    let low: string | null = null;
    let high: string | null = null;
    for (let i = 0; i < 200; i++) {
      const k: string = positionBetween(low, high);
      if (low !== null) expect(k > low, `${k} > ${low}`).toBe(true);
      if (high !== null) expect(k < high, `${k} < ${high}`).toBe(true);
      expect(k).toMatch(/^[0-9A-Za-z]+$/);
      if (i % 2) low = k;
      else high = k;
    }
  });

  it("splits the server's default keys and keys that end in zero", () => {
    for (const [a, b] of [["t019a00000000", "t019a00000010"], ["a0", "t019a00000000"], ["t0", "t1"], ["0009", "0010"], ["a", "a01"]] as const) {
      const k = positionBetween(a, b);
      expect(k > a && k < b, `${a} < ${k} < ${b}`).toBe(true);
    }
  });

  it("appends at either end", () => {
    expect(positionBetween("t019", null) > "t019").toBe(true);
    expect(positionBetween(null, "a0") < "a0").toBe(true);
  });

  it("a tie, or no room, lands after the first key instead of failing", () => {
    expect(positionBetween("a0", "a0") > "a0").toBe(true);
    expect(positionBetween("x", "x0") > "x").toBe(true);
  });
});
