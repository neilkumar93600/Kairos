"use client";

import { ArrowDown, PenNib } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { landingCopy } from "@/content/landing-copy";
import { ledgerStore, useLedger } from "@/lib/landing/ledger-store";
import { useMotionAllowed } from "../motion";

const a = landingCopy.steps.approve;
const PENDING_MS = 600;

/**
 * Below 1024 the sticky stage sits over the single caption column, so a focused button can land under it (WCAG 2.4.11).
 * After the browser's own focus scroll, if the button's centre is not the topmost element (or is off screen), scroll it
 * to the viewport's bottom edge, below the stage. A no-op whenever the button is already visible, as on a mouse press.
 */
function keepClear(e: FocusEvent<HTMLButtonElement>) {
  const b = e.currentTarget;
  requestAnimationFrame(() => {
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || !b.contains(hit)) b.scrollIntoView({ block: "end" });
  });
}

/**
 * The page's one press (Aceternity Stateful Button rebuilt: no spinner, no check, no layoutId). Click only; scroll never
 * approves. One store write updates the held sheet's foot and seal, the coda's receipt and the closing band's
 * ApprovedLine. Pending is a Bone fill sweeping across the pill; done reads as a result (lime dot, Bone pill), then a
 * visible status line and a quiet link down to the receipt. Hidden with scripts off (data-requires-js). Focus stays on
 * the button through every state.
 */
export function ApproveSample() {
  const approvedAt = useLedger((st) => st.approvedAt);
  const allowed = useMotionAllowed();
  const [pending, setPending] = useState(false);
  const [live, setLive] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Done comes from the store, so a reload in the same session (sessionStorage) shows it too.
  const state = approvedAt ? "done" : pending ? "pending" : "idle";

  const onClick = () => {
    if (state !== "idle") return;
    setPending(true);
    timer.current = setTimeout(
      () => {
        ledgerStore.approve(new Date().toISOString());
        setPending(false);
        setLive(a.live);
      },
      allowed ? PENDING_MS : 0,
    );
  };

  return (
    <div className="ens-press" data-requires-js="">
      <button
        type="button"
        className="lp-btn lp-btn--outlined ens-approve"
        data-state={state}
        aria-disabled={state === "done" || undefined}
        aria-busy={state === "pending" || undefined}
        onClick={onClick}
        onFocus={keepClear}
      >
        {state === "done" ? (
          <span className="lp-dot" aria-hidden="true" />
        ) : (
          <PenNib className="ens-approve__icon" size={16} weight="light" aria-hidden="true" />
        )}
        <span className="ens-approve__label">{a[state]}</span>
      </button>
      <p role="status" aria-live="polite" className="lp-body-sm ens-press__status">
        {live}
      </p>
      {state === "done" ? (
        <a href="#features" className="lp-link ens-press__more">
          {a.receipt} <ArrowDown size={16} weight="light" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}
