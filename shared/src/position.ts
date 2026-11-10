/** Fractional-index keys for a tracker column (PRD 15): compared byte-wise, as the server's ORDER BY position COLLATE "C". */
const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const at = (c: string | undefined) => (c === undefined ? 0 : DIGITS.indexOf(c));
const strip = (k: string) => k.replace(/0+$/, "");

function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let i = 0;
    while (b[i] !== undefined && (a[i] ?? "0") === b[i]) i++;
    if (i > 0) return b.slice(0, i) + midpoint(a.slice(i), b.slice(i));
  }
  const low = at(a[0]);
  const high = b === null ? DIGITS.length : at(b[0]);
  if (high - low > 1) return DIGITS[Math.round((low + high) / 2)]!;
  if (b !== null && b.length > 1) return b[0]!;
  return DIGITS[low]! + midpoint(a.slice(1), null);
}

/**
 * A key that sorts after `before` and before `after` (null: the column's start or end). Two neighbours that tie, or that no key
 * fits between, give a key just after `before`.
 * A key from here never ends in 0, so a gap above and below it always remains. A leading zero can be generated ("0V", below "1") and
 * is safe; only a key of all zeros would have nothing below it, and that is never generated.
 * ponytail: never rebalances; a key grows a character about every six drops into one gap, and the server refuses over 64. Add a
 * rebalance when someone reaches that.
 */
export function positionBetween(before: string | null, after: string | null): string {
  const a = before ?? "";
  if (after !== null && strip(after) <= strip(a)) return `${a}V`;
  return midpoint(a, after);
}
