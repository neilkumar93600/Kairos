"use client";

import { useEffect, useId, useRef, type CSSProperties } from "react";
import "./goo-marker.css";

/**
 * Liquid selection marker for an `.lp-seg` radio toggle (the billing interval on /pricing and the landing). Two Paper
 * White pills sit in a layer behind the labels; an SVG goo filter on that layer only joins them, so label text stays
 * crisp. Segments differ in width (the Quarterly chip), so each pill is clipped to the checked label's measured box;
 * on change the leading pill moves in 300 ms and the trailing one in 520 ms, stretching into one shape mid-move.
 * Selection only: hover and focus never move it. Until the first measurement, and with JavaScript off, the marker is
 * hidden and the checked label keeps its own Paper White fill. Render it inside the fieldset, before the labels.
 * ponytail: it follows the native change event and the checked radio, so it needs no props; a toggle whose selection
 * changes without a change event would need an index prop.
 */
export function GooMarker() {
  const ref = useRef<HTMLSpanElement>(null);
  const filterId = `kx-goo-${useId().replace(/[^\w-]/g, "")}`;

  useEffect(() => {
    const wrap = ref.current;
    const seg = wrap?.parentElement;
    if (!wrap || !seg) return;

    // A label can be mid-press (scale 0.97 about its centre, globals.css): its rect centre holds, its size does not,
    // so the size comes from offsetWidth/Height. (Offset positions are off by the glass border inside a fieldset.)
    const place = (animate: boolean) => {
      const label = seg.querySelector<HTMLElement>(":scope > label:has(input:checked)");
      if (!label || !wrap.offsetWidth) return; // display none (forced colours): nothing to place
      const a = wrap.getBoundingClientRect();
      const b = label.getBoundingClientRect();
      const left = (b.left + b.right - label.offsetWidth) / 2 - a.left;
      const top = (b.top + b.bottom - label.offsetHeight) / 2 - a.top;
      const right = a.width - left - label.offsetWidth;
      const bottom = a.height - top - label.offsetHeight;
      if (!animate) wrap.dataset.instant = "";
      wrap.style.setProperty("--kx-clip", `inset(${top}px ${right}px ${bottom}px ${left}px round 999px)`);
      if (!animate) {
        void wrap.offsetWidth; // apply with transitions off, so the first placement and resizes jump
        delete wrap.dataset.instant;
      }
      wrap.dataset.ready = "";
    };

    const onChange = () => place(true);
    const ro = new ResizeObserver(() => place(false));
    ro.observe(wrap);
    seg.querySelectorAll(":scope > label").forEach((label) => ro.observe(label));
    seg.addEventListener("change", onChange);
    return () => {
      ro.disconnect();
      seg.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <span ref={ref} className="kx-goo" aria-hidden="true">
      <svg width="0" height="0" focusable="false">
        <filter id={filterId} colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="5" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" />
        </filter>
      </svg>
      <span className="kx-goo__layer" style={{ "--kx-goo": `url("#${filterId}")` } as CSSProperties}>
        <span className="kx-goo__pill" />
        <span className="kx-goo__pill" />
      </span>
    </span>
  );
}
