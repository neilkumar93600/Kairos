"use client";

import "./delete-confirm.css";
import { useEffect, useId, useRef, useState } from "react";
import { Check, CircleNotch, X } from "@phosphor-icons/react";

// ponytail: one shared polite region on <body>, so "Fact removed" outlives the row that held the button.
let region: HTMLElement | null = null;
function liveRegion() {
  if (!region?.isConnected) {
    region = document.createElement("div");
    region.className = "sr-only";
    region.setAttribute("aria-live", "polite");
    document.body.append(region);
  }
  return region;
}
/** A new line per message, so the same message twice is still read; it clears itself after 7 s. */
function announce(message: string) {
  const line = document.createElement("div");
  line.textContent = message;
  liveRegion().append(line);
  setTimeout(() => line.remove(), 7000);
}

const RING = "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink";
/** 32px round button with a 44px hit area (the 6px pseudo-element just meets its neighbour across the 12px gap). */
const ROUND = `relative inline-flex size-8 cursor-pointer items-center justify-center rounded-pill after:absolute after:-inset-1.5 disabled:pointer-events-none disabled:opacity-50 ${RING}`;

/**
 * Inline delete confirmation, no modal. A bin icon button opens a Confirm and Cancel pair beside it; focus moves to
 * Cancel, the safe choice. Cancel, Escape or focus leaving the control closes the pair. Motion lives in
 * delete-confirm.css and is off under reduced motion.
 */
export function DeleteConfirm({
  thing,
  onConfirm,
  pending = false,
  disabled = false,
  describedBy,
}: {
  /** Lower-case noun for the names: "Remove fact", "Yes, remove fact", "Keep fact", and the announcement "Fact removed". */
  thing: string;
  /** Resolves once removed. On rejection the pair stays open and the caller shows the error. */
  onConfirm: () => Promise<unknown>;
  /** The removal is in flight: spinner on Confirm, both buttons disabled. */
  pending?: boolean;
  /** Something else on the row is busy. */
  disabled?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const groupId = useId();

  // The region must exist before its first message, or screen readers skip it.
  useEffect(() => void liveRegion(), []);
  // On open, and again after a failed removal: disabling the pair dropped focus to <body>.
  useEffect(() => {
    if (open && !pending) cancel.current?.focus();
  }, [open, pending]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function confirm() {
    onConfirm().then(
      () => {
        announce(`${thing[0].toUpperCase()}${thing.slice(1)} removed`);
        close(); // usually a no-op on focus: the removed row unmounts the trigger with it
      },
      () => {}, // the caller shows the error; the pair stays open to try again or cancel
    );
  }

  return (
    <div
      className="kx-del relative flex items-center"
      data-open={open || undefined}
      // Clicks inside never move focus (Safari would blur Cancel to <body> and close the pair under the pointer).
      onMouseDown={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !open || pending) return;
        e.stopPropagation();
        close();
      }}
      onBlur={(e) => {
        // Tab or a click elsewhere closes the pair; focus stays wherever the user sent it.
        if (open && !pending && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`Remove ${thing}`}
        aria-describedby={describedBy}
        aria-expanded={open}
        aria-controls={groupId}
        disabled={disabled || pending}
        onClick={() => (open ? close() : setOpen(true))}
        className={`inline-flex size-11 cursor-pointer items-center justify-center rounded-pill text-icon hover:bg-sunk active:bg-sunk/70 aria-expanded:bg-sunk disabled:pointer-events-none disabled:opacity-50 ${RING}`}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-5 overflow-visible"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <g className="kx-del__lid">
            <path d="M3.75 6.75h16.5" />
            <path d="M9 6.75v-1.5a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v1.5" />
          </g>
          <path d="M5.25 6.75l.84 12.6a1.5 1.5 0 0 0 1.5 1.4h8.82a1.5 1.5 0 0 0 1.5-1.4l.84-12.6M10 10.5v6M14 10.5v6" />
        </svg>
      </button>
      {/* The pair floats over the actions to the bin's left instead of reserving room after it, so a row of actions
          never wraps on a phone (Confirm, Edit and a reserved pair need about 296 px; a 390 phone row has about 286). */}
      <div
        id={groupId}
        role="group"
        aria-label={`Remove ${thing}?`}
        className="kx-del__group absolute top-1/2 right-full z-10 mr-1 flex -translate-y-1/2 items-center gap-3 rounded-pill bg-surface p-1.5 shadow-edge"
      >
        <span className="kx-del__item flex">
          <button
            type="button"
            aria-label={`Yes, remove ${thing}`}
            aria-describedby={describedBy}
            disabled={disabled || pending}
            onClick={confirm}
            className={`${ROUND} bg-danger-fill text-white hover:brightness-110 active:brightness-95`}
          >
            {pending ? (
              <CircleNotch size={16} weight="bold" aria-hidden className="kx-del__spin" />
            ) : (
              <Check size={16} weight="bold" aria-hidden />
            )}
          </button>
        </span>
        <span className="kx-del__item flex">
          <button
            ref={cancel}
            type="button"
            aria-label={`Keep ${thing}`}
            aria-describedby={describedBy}
            disabled={pending}
            onClick={close}
            className={`${ROUND} bg-sunk text-ink hover:brightness-95`}
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        </span>
      </div>
    </div>
  );
}
