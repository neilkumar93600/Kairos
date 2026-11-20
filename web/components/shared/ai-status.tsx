"use client";

import { useEffect, useState, type AnimationEvent, type ReactNode } from "react";
import "./ai-status.css";

export type AiState = "working" | "done" | "failed";

type Layer = { state: AiState; label: string; detail?: string; time?: string };

const same = (a: Layer | null, b: Layer | null) =>
  a?.state === b?.state && a?.label === b?.label && a?.detail === b?.detail && a?.time === b?.time;

/**
 * One-line AI status: working (the label shimmers, real elapsed seconds tick), done (a check draws in, "in 6 s") or
 * failed ("Failed after 4 s"). The API reports no phases, so there are none here. The live region gets state changes
 * only: the ticking seconds are aria-hidden. Motion lives in ai-status.css and is off under reduced motion.
 */
export function AiStatus({
  state,
  startedAt,
  endedAt,
  working,
  done,
  detail,
}: {
  /** null renders the empty live region, so the first state change is announced. */
  state: AiState | null;
  /** Epoch ms the request started. */
  startedAt: number;
  /** Epoch ms it settled. Ignored while older than startedAt (it belongs to the previous request). */
  endedAt: number;
  working: string;
  done: string;
  detail?: string;
}) {
  // One interval, only while working; cleared when the state changes or the component unmounts.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (state !== "working") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state]);

  const secs = (to: number) => Math.max(0, Math.round((to - startedAt) / 1000));
  // A sub-second request still reads "1 s", never "0 s".
  const took = endedAt >= startedAt ? `${Math.max(1, secs(endedAt))} s` : null;
  const layer: Layer | null =
    state === "working"
      ? { state, label: working, time: `${secs(now)} s` }
      : state === "done"
        ? { state, label: done, detail, time: took ? `in ${took}` : undefined }
        : state === "failed"
          ? { state, label: took ? `Failed after ${took}` : "Failed" }
          : null;

  // The row drawn last render, and a snapshot of it that rises out for 260 ms while the next row rises in.
  // Adjusting state during render (React docs, "storing information from previous renders"), so no effect runs twice.
  const [shown, setShown] = useState(layer);
  const [leaving, setLeaving] = useState<Layer | null>(null);
  if (!same(shown, layer)) {
    setShown(layer);
    if (shown && shown.state !== layer?.state) setLeaving(shown);
  }

  return (
    <span role="status" aria-live="polite" className="kx-ai">
      {leaving ? (
        <Row
          key={`out-${leaving.state}`}
          layer={leaving}
          out
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) setLeaving(null);
          }}
        />
      ) : null}
      {layer ? <Row key={layer.state} layer={layer} /> : null}
    </span>
  );
}

function Row({ layer: { state, label, detail, time }, out, onAnimationEnd }: { layer: Layer; out?: boolean; onAnimationEnd?: (e: AnimationEvent) => void }) {
  return (
    <span aria-hidden={out || undefined} className={`kx-ai__row kx-ai__row--${out ? "out" : "in"}`} onAnimationEnd={onAnimationEnd}>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`kx-ai__icon kx-ai__icon--${state}`}
      >
        {ICON[state]}
      </svg>
      <span className={`kx-ai__label kx-ai__label--${state}`}>{label}</span>
      {detail ? <span className="kx-ai__detail">{detail}</span> : null}
      {/* Only the ticking number is hidden: the live region would otherwise speak every second. */}
      {time ? (
        <span className="kx-ai__time" aria-hidden={state === "working" || undefined}>
          {time}
        </span>
      ) : null}
    </span>
  );
}

const ICON: Record<AiState, ReactNode> = {
  // A pen over a baseline: it is writing.
  working: <path d="M3 13l.75-2.75 7.5-7.5a1.41 1.41 0 0 1 2 2l-7.5 7.5zM9.75 4.25l2 2M9 13.25h4.25" />,
  // pathLength 1 lets the CSS draw it with stroke-dashoffset 1 to 0.
  done: <path pathLength={1} d="M3.5 8.5l3 3 6-7" />,
  failed: <path d="M4.5 4.5l7 7m0-7l-7 7" />,
};
