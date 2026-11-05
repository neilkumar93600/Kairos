"use client";

import Image from "next/image";
import { useMotionValueEvent } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { LogoMark } from "@/components/shared/logo";
import { landingCopy } from "@/content/landing-copy";
import { formatTime } from "@/lib/landing/format";
import { useLedger } from "@/lib/landing/ledger-store";
import { SampleChip } from "../marks/chip";
import { Stamp } from "../marks/stamp";
import { useScrollStage } from "../motion";

const c = landingCopy.steps;
const s = c.sheet;
const { app, card } = landingCopy.hero;
const { facts, uncited, skipped } = landingCopy.sample;
const held = app.rows[0]; // the draft open in the hero window
// Step 1 rule values: role and place from the held row ("Company 109 · Remote"), salary and visa from the sheet copy.
const ruleValues = [held.role, held.company.split(" · ").at(-1), s.rules.salary, s.rules.visa];

/** The rise runs over the first 18 percent of the track; the sheet counts as risen (crisp, threads shown) from 20. */
const RISE = 0.18;
const RISEN = 0.2;

/**
 * The sheet's transform at track progress p: Aceternity Container Scroll Animation's rotate, widened to lay the sheet
 * on the painted desk (spec start 72 / 18 / 0.66 / 12%, tuned against the painting to 74 / 26 / 0.6 / 10%). Linear
 * and clamped like useTransform, in motion's order (translate, scale, rotateX, rotateZ). "none" once standing, so the
 * resting sheet has no transform layer and its text rasterises crisp. No spring: Lenis smooths.
 */
export function riseTransform(p: number, xStartPct: number): string {
  const t = Math.min(Math.max(p / RISE, 0), 1);
  if (t === 1) return "none";
  const k = 1 - t;
  return `translateX(${xStartPct * k}%) scale(${1 - 0.4 * k}) rotateX(${74 * k}deg) rotateZ(${26 * k}deg)`;
}

const WIDE = "(min-width: 768px)";
const subscribeWide = (cb: () => void) => {
  const mql = matchMedia(WIDE);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
};

/** Layout offset of `el` inside `root`, summed through offsetParents. Ignores transforms, so it is safe mid-rise. */
function offsetIn(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = el; n && n !== root; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return { x, y };
}

/**
 * The held application on the painted desk (docs/DESIGN.md "Landing v3 mid-page chapter", 3 and "Signature moment").
 * Server HTML is the final frame: the sheet standing, slips struck and set aside, lines cited, threads drawn, the foot
 * waiting. When the ScrollStage is armed the sheet's four transform values are bound to scroll (the rise, the only
 * per-frame work); every other beat is a CSS transition keyed to the track's data-reached (entry-steps.css).
 */
export function HeldStage() {
  const { progress, armed } = useScrollStage();
  const approvedAt = useLedger((st) => st.approvedAt);
  // The 4:3 and 3:4 stages crop the painting differently, so the lying sheet starts from a different x. Changes only
  // when the breakpoint flips, never on scroll.
  const wide = useSyncExternalStore(subscribeWide, () => matchMedia(WIDE).matches, () => true);
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const xStart = wide ? 10 : 0;

  // The rise is the only per-frame work: one inline transform string on the sheet, written straight to the DOM from the
  // progress value (no motion component, no React state), and only when it changes. Cleared when the stage disarms.
  const writeRise = (v: number) => {
    const el = sheetRef.current;
    const next = armed ? riseTransform(v, xStart) : "";
    if (el && el.style.transform !== next) el.style.transform = next;
  };
  // An attribute write only when 0.2 is crossed (toggleAttribute is a no-op otherwise): drops will-change once the sheet
  // stands, and hides the threads while it lies (they are measured on the standing sheet).
  useMotionValueEvent(progress, "change", (v) => {
    stageRef.current?.toggleAttribute("data-risen", v >= RISEN);
    writeRise(v);
  });
  useLayoutEffect(() => {
    stageRef.current?.toggleAttribute("data-risen", progress.get() >= RISEN);
    writeRise(progress.get());
  });

  // Threads (Magic UI Animated Beam's path between two refs, no gradient): from the sheet's right edge level with each
  // cite chip to its note's pin. Layout offsets only, written through the DOM; never React state.
  useEffect(() => {
    const stage = stageRef.current;
    const overlay = overlayRef.current;
    if (!stage || !overlay) return;
    let live = true;
    const measure = () => {
      const sheet = overlay.querySelector<HTMLElement>(".ens-sheet");
      if (!live || !sheet) return;
      const edge = offsetIn(sheet, overlay).x + sheet.offsetWidth;
      const sag = matchMedia(WIDE).matches ? 12 : 8;
      overlay.querySelectorAll<SVGSVGElement>("svg[data-thread]").forEach((svg) => {
        const i = svg.dataset.thread;
        const chip = overlay.querySelector<HTMLElement>(`[data-cite="${i}"]`);
        const pin = overlay.querySelector<HTMLElement>(`[data-pin="${i}"]`);
        const path = svg.firstElementChild;
        if (!chip || !pin || !path) return;
        const a = offsetIn(chip, overlay);
        const b = offsetIn(pin, overlay);
        const x1 = edge;
        const y1 = a.y + chip.offsetHeight / 2;
        const x2 = b.x + pin.offsetWidth / 2;
        const y2 = b.y + pin.offsetHeight / 2;
        const cy = Math.max(y1, y2) + sag;
        const left = Math.min(x1, x2) - 2;
        const top = Math.min(y1, y2) - 2;
        const w = Math.abs(x2 - x1) + 4;
        const h = cy - top + 2;
        Object.assign(svg.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        path.setAttribute("d", `M ${x1 - left} ${y1 - top} Q ${(x1 + x2) / 2 - left} ${cy - top} ${x2 - left} ${y2 - top}`);
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    void document.fonts?.ready.then(measure);
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [armed]); // arming changes which beat states apply, so measure again

  // No-break spaces inside the time ("9:58 AM" never splits); the line may still wrap before it on a narrow sheet.
  const time = approvedAt ? formatTime(approvedAt).replace(/\s/g, " ") : "";

  return (
    <div
      ref={stageRef}
      className="ens-stage lp-grain"
      role="img"
      aria-label={c.stageAria}
      data-approved={approvedAt ? "" : undefined}
    >
      <div className="ens-stage__art">
        <Image
          src="/landing/art/step-2-truth-lock.png"
          alt=""
          fill
          // Below 768 the 4:3 painting covers a 3:4 stage about 52svh tall, so it needs about 70vh of width, not 100vw.
          sizes="(min-width: 1280px) 845px, (min-width: 1024px) 50vw, (min-width: 768px) 640px, 70vh"
        />
      </div>
      <div ref={overlayRef} className="ens-overlay">
        {skipped.map((p, i) => (
          <div key={p.company} className="ens-slip" data-slip={i}>
            <p className="ens-slip__role">
              <span className="ens-struck">
                {p.role} · {p.company}
                <span className="ens-strike" />
              </span>
            </p>
            <p className="ens-slip__reason">{p.reason}</p>
          </div>
        ))}

        {/* The sheet is a grid sized by its content and anchored by its bottom edge on the desk; the step 1 rules and
            the step 2 copy share rows. Its transform is written by writeRise (server HTML: none, the standing frame). */}
        <div ref={sheetRef} className="ens-sheet">
          <div className="ens-sheet__head">
            <SampleChip />
            <p className="ens-sheet__role">{held.role}</p>
            <p className="ens-sheet__co">{held.company}</p>
          </div>
          <p className="ens-fit">
            <span className="lp-dot" />
            {held.fit} · {card.fitTail}
          </p>
          {/* Step 1 only: shown while armed and before step 2 (entry-steps.css); the final frame hides it. */}
          <div className="ens-rules">
            <p className="lp-micro ens-sheet__label">{s.rules.label}</p>
            {s.rules.names.map((name, i) => (
              <p key={name} className="ens-rule" style={{ "--i": i } as CSSProperties}>
                <span className="ens-tick">
                  <span className="lp-square-open" />
                  <span className="lp-dot" />
                </span>
                <span className="ens-rule__k">{name}</span>
                <span className="ens-rule__v">{ruleValues[i]}</span>
              </p>
            ))}
          </div>
          <div className="ens-copy">
            <p className="lp-micro ens-sheet__label">{s.label}</p>
            {app.lines.map((l, i) => (
              <div key={l.cites} className="ens-line" data-line={i}>
                <p className="ens-line__text">{l.text}</p>
                <span className="lp-chip ens-cite" data-cite={i}>
                  {l.cites}
                </span>
              </div>
            ))}
            <div className="ens-line ens-line--uncited">
              <p className="ens-line__text">
                <span className="ens-struck">
                  {uncited.before}
                  {uncited.claim}
                  {uncited.after}
                  <span className="ens-strike" />
                </span>
              </p>
              {/* The empty cite: a dashed chip where the fact would be, inside the sheet. */}
              <span className="lp-chip ens-cite ens-cite--none">{s.noCite}</span>
            </div>
            <p className="ens-status">
              <span className="lp-square-open" />
              {s.notSaved}
            </p>
          </div>
          <div className="ens-foot">
            {approvedAt && time ? (
              <p className="ens-foot__word">
                <span className="lp-dot" />
                <Stamp>{`${s.approvedBy} · ${time}`}</Stamp>
              </p>
            ) : (
              <p className="ens-foot__word">
                <span className="lp-square-open" />
                {s.waiting}
              </p>
            )}
            {/* The seal: an empty dashed ring while the sheet waits, the Kairos mark once the visitor approves. Not a
                control (the press is "Approve sample" in caption 3), so it is drawn as a ring, never as a button. */}
            <span className="ens-seal">{approvedAt ? <LogoMark className="h-6" /> : null}</span>
          </div>
        </div>

        {app.lines.map((l, i) => (
          <svg key={l.cites} className="ens-thread" data-thread={i} viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M 0 0 Q 50 108 100 100" />
          </svg>
        ))}

        {facts.map((f, i) => (
          <div key={f.id} className="ens-note" data-note={i}>
            <span className="lp-pin" data-pin={i} />
            <p className="ens-note__id">{f.id}</p>
            <p className="ens-note__topic">{f.topic}</p>
            <p className="ens-note__ok">
              <span className="lp-dot" />
              <span className="ens-note__long">{s.confirmed}</span>
              <span className="ens-note__short">{s.confirmedShort}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
