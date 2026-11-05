# Landing motion engine

Client primitives for the landing's mid-page chapter. Import from `@/components/landing/motion`.
Stack: `motion` (motion/react) and `lenis`, both pinned. No GSAP, no Magic UI or Aceternity packages.

Rules every consumer keeps (docs/DESIGN.md "Motion & Transition Philosophy", motion.css rules a to c):

- No React state on scroll. Bind `progress` with `useTransform` / `style`, never copy it into state.
- Transform, opacity and clip-path only. One easing family (`--ease-out`).
- Hidden or pre-states live only under attributes JavaScript writes (`[data-armed]`, `[data-post="pending"]`,
  `html[data-motion="full"]`), so scripts-off and reduced motion show the final frame.
- `html[data-motion="reduced"]` is the single switch; the media query is the backstop.

## useMotionAllowed(): boolean

True only while `html[data-motion="full"]`. False on the server and the hydration render.

```tsx
const allowed = useMotionAllowed();
return <motion.div style={allowed ? { y } : undefined} />;
```

## SmoothScroll(): null

Lenis wheel smoothing (lerp 0.1, touch never smoothed, native anchors). Off under reduced motion, paused while
`html[data-dialog]` exists, destroyed on unmount. Mount once, on `/` only, after `<MotionPreference />`.

```tsx
<MotionPreference />
<SmoothScroll />
```

## ScrollStage / useScrollStage

Sticky-chapter engine (Aceternity "Sticky Scroll Reveal" mechanism). Mark step blocks `data-step="0".."n-1"`.

Props: `steps: number`, `offset?: [string, string]` (default `["start 0.1", "end end"]`),
`band?: { wide; narrow }` (rootMargin; defaults `-45% 0px -45% 0px` from 1024, `-78% 0px -16% 0px` below),
`shortQuery?: string` (default `(max-height: 640px)`, never arms when it matches), plus any div attribute.

Root attributes, written from IntersectionObserver callbacks and progress changes (only when a value changes):

| attribute | when |
| --- | --- |
| `data-stage-root` | always |
| `data-armed` | motion full and viewport not short; written after the two below |
| `data-active="i"` | highest step in the band (keeps the last value when none is) |
| `data-reached="0 1"` | monotonic; match with `[data-reached~="1"]` |
| `data-live` | track within half a viewport of the screen; gate `will-change` on it |

`useScrollStage()` returns `{ progress: MotionValue<number>, armed: boolean }` and throws outside a stage.

```tsx
<ScrollStage steps={3} className="chapter">
  <div className="chapter__stage"><Sheet /></div>
  {checks.map((c, i) => <section key={c.id} data-step={i}>{c.title}</section>)}
</ScrollStage>

function Sheet() {
  const { progress, armed } = useScrollStage();
  const rotateX = useTransform(progress, [0, 0.3], [18, 0]);
  return <motion.div style={armed ? { rotateX } : undefined} />;
}
```

```css
/* final frame by default; pre-state only when armed */
.lp [data-armed]:not([data-reached~="1"]) .cite-chip { opacity: 0; }
.lp .chapter[data-active="2"] .receipt { transform: none; }
```

`stepsFromRects(rects, band, prevReached)` is the pure maths behind it (tested in `web/test/scroll-stage.test.ts`).

## Reveal

One-shot arrival (Magic UI "Animated List" mechanism) on top of motion.css rule (b). Props: `as?` (default
`"div"`), `amount?` (default 0.4), plus any HTML attribute. Writes `data-post="pending"` then `"live"`; nothing
under reduced motion. Children with `.lp-post` and `--i` rise with the 70 ms stagger.

```tsx
<Reveal as="ul">
  {replies.map((r, i) => <li key={r.id} className="lp-post" style={{ "--i": i } as React.CSSProperties}>{r.subject}</li>)}
</Reveal>
```

## CSS helpers in motion.css

- `.lp-trace`: a rail drawn top to bottom as it scrolls through (Tracing Beam idea, clip-path). Drawn by default.
- `.lp-pin`: 10 px ink disc with a 2 px Linen ring. Static.
