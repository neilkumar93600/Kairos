import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Urbanist } from "next/font/google";
import { siteConfig } from "@/lib/site";
import { MOTION_HEAD_SCRIPT } from "@/lib/motion/preference";
import "./globals.css";
import { cn } from "@/lib/utils";



// Urbanist (owner, 2026-10-23: "Switch to Urbanist", after the Synthex reference) for UI, body, headings and figures.
// 300 is for large figures only (40px and up); 400 paragraphs and headings; 500 labels, buttons, nav; 600 the footer.
const urbanist = Urbanist({ variable: "--font-urbanist", subsets: ["latin"], weight: ["300", "400", "500", "600"], display: "swap" });
// The four landing art lines only (hero H1, spotlight H2, dark card H2, closing line). Tailwind: font-serif.
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: `${siteConfig.name}: job applications you'd sign`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  // Default share card for every page that does not set its own (the landing and blog posts do).
  openGraph: {
    siteName: siteConfig.name,
    type: "website",
    images: [{ url: "/landing/og-kairos.png", width: 1200, height: 630, alt: "Kairos: job applications you would sign." }],
  },
  twitter: { card: "summary_large_image", images: ["/landing/og-kairos.png"] },
};

// cover: env(safe-area-inset-*) is non-zero on notched phones, so the app tab bar clears the home indicator.
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The head script sets data-motion pre-paint.
    <html lang="en" className={cn("h-full", "antialiased", urbanist.variable, instrumentSerif.variable, "font-sans")} suppressHydrationWarning>
      <head>
        {/* Static constant from our own module, no user input (Next guide: preventing flash before hydration). */}
        <script dangerouslySetInnerHTML={{ __html: MOTION_HEAD_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* The valley haze every glass surface blurs (globals.css .site-backdrop). Decorative. */}
        <div aria-hidden className="site-backdrop" />
        {children}
      </body>
    </html>
  );
}
