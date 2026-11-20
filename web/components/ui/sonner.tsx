"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { InfoIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import "./sonner.css"

// Glyphs sit in a span so Sonner's own promise-icon animation ([data-icon] > svg) never reaches them.
const glyph = (icon: React.ReactNode) => (
  <span className="kx-toast__glyph" aria-hidden>
    {icon}
  </span>
)

const lucide = { size: 14, strokeWidth: 2 }

/**
 * App toasts (signed-in area only, mounted once in the dashboard layout). Kairos is light only, so the theme is fixed.
 * Unstyled Sonner plus sonner.css: Sonner keeps stacking, swipe, timers and its polite live region.
 * Bottom-right from 768px, bottom-center below; both clear the phone tab bar (--app-tabbar-h).
 */
const Toaster = (props: ToasterProps) => {
  const narrow = useIsMobile()
  return (
    <Sonner
      theme="light"
      className="kx-toaster"
      position={narrow ? "bottom-center" : "bottom-right"}
      offset={{ bottom: "calc(var(--app-tabbar-h, 0px) + 24px)" }}
      mobileOffset={{ bottom: "calc(var(--app-tabbar-h, 0px) + 16px)" }}
      closeButton
      style={{ "--width": "360px" } as React.CSSProperties}
      icons={{
        success: glyph(
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path className="kx-toast__check" d="M3.5 8.5l3 3 6-7" pathLength={1} />
          </svg>,
        ),
        info: glyph(<InfoIcon {...lucide} />),
        warning: glyph(<TriangleAlertIcon {...lucide} />),
        error: glyph(<XIcon {...lucide} />),
        loading: (
          <svg className="kx-toast__spin" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="8" cy="8" r="6" strokeOpacity="0.2" />
            <path d="M14 8a6 6 0 0 0-6-6" />
          </svg>
        ),
      }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: "Dismiss",
        classNames: {
          toast: "kx-toast",
          icon: "kx-toast__icon",
          loader: "kx-toast__loader",
          content: "kx-toast__content",
          title: "kx-toast__title",
          description: "kx-toast__description",
          closeButton: "kx-toast__close",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
