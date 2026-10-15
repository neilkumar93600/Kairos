import type { ReactNode } from "react";

/**
 * The signature line in the spotlight floating card, such as "Approved by you · 14:32" (M12: it writes in
 * when it mounts, so render it only once approved). A recorded time, never a countdown or a running clock.
 */
export function Stamp({ children }: { children: ReactNode }) {
  return <span className="lp-sign">{children}</span>;
}
