"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useInbox } from "@/hooks/use-inbox";
import { markInboxSeen, useInboxSeen } from "@/hooks/use-inbox-seen";
import "./inbox-bell.css";

const POLL_MS = 120_000;
const badgeText = (n: number) => (n > 9 ? "9+" : String(n));

/**
 * Header bell: a link to Replies with the number of replies received since this person last opened Replies on this
 * device (hooks/use-inbox-seen). Same ["inbox"] query as the page and the sidebar, so no second request. A rise while
 * mounted swings the bell, rolls the number and is announced politely; the first load only sets the baseline.
 */
export function InboxBell() {
  const { data } = useInbox();
  const seen = useInboxSeen();
  const queryClient = useQueryClient();

  // First visit on this device: everything already received counts as seen, never the whole history as new.
  useEffect(() => {
    if (data && seen === null) markInboxSeen(data);
  }, [data, seen]);

  // Focus refetch is the query default; this adds a slow poll, skipped while the tab is hidden.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [queryClient]);

  // On Replies itself nothing is new: the list on screen marks it seen (reply-list.tsx), so the bell never flashes there.
  const onReplies = usePathname()?.startsWith("/inbox");
  const count = data && seen !== null ? (onReplies ? 0 : data.filter((e) => Date.parse(e.receivedAt) > seen).length) : null;

  const [prev, setPrev] = useState<number | null>(null);
  const [rise, setRise] = useState<{ id: number; from: string; angle: number } | null>(null);
  const [last, setLast] = useState(""); // the badge keeps its last number while it fades out at zero
  const [said, setSaid] = useState("");
  if (count !== prev) {
    setPrev(count);
    if (count) setLast(badgeText(count));
    if (count !== null && prev !== null && count > prev) {
      setRise({ id: (rise?.id ?? 0) + 1, from: prev ? badgeText(prev) : "", angle: count - prev >= 3 ? 18 : 14 });
      setSaid(`${count} new ${count === 1 ? "reply" : "replies"}`);
    } else {
      setRise(null);
      if (!count) setSaid("");
    }
  }

  const text = count ? badgeText(count) : last;
  const rollFrom = rise && rise.from !== text ? rise.from : ""; // "9+" to "9+" has nothing to roll

  return (
    <>
      <Link
        href="/inbox"
        aria-label={count ? `Replies, ${count} new` : "Replies"}
        className="group grid size-11 shrink-0 place-items-center rounded-pill focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink"
      >
        <span className="relative grid size-10 place-items-center rounded-pill text-icon transition-colors duration-300 ease-out group-hover:bg-sunk group-active:bg-sunk">
          <span
            key={rise?.id ?? 0}
            className="kx-bell__icon grid"
            data-swing={rise ? "" : undefined}
            style={rise ? ({ "--kx-bell-angle": `${rise.angle}deg` } as CSSProperties) : undefined}
          >
            <Bell size={20} weight="light" aria-hidden />
          </span>
          <span
            aria-hidden
            data-on={count ? "" : undefined}
            className="kx-bell__badge absolute top-0.5 right-0.5 grid h-4.5 min-w-4.5 overflow-hidden rounded-pill bg-ink px-1 text-center text-[12px] leading-4.5 font-medium text-on-dark tabular-nums"
          >
            {rollFrom ? (
              <span key={`out-${rise?.id}`} className="kx-bell__out">
                {rollFrom}
              </span>
            ) : null}
            <span key={`in-${rise?.id ?? 0}`} className={rollFrom ? "kx-bell__in" : undefined}>
              {text}
            </span>
          </span>
        </span>
      </Link>
      <span className="sr-only" aria-live="polite">
        {said}
      </span>
    </>
  );
}
