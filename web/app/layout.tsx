import type { Metadata } from "next";
import { Inter, Inter_Tight, Instrument_Serif } from "next/font/google";
import { siteConfig } from "@/lib/site";
import { MOTION_HEAD_SCRIPT } from "@/lib/motion/preference";
import "./globals.css";
import { cn } from "@/lib/utils";



// UI and body. Weight 400 for paragraphs, 500 for buttons, nav, card titles, FAQ questions; 600 for the landing footer
// (title, column heads, glass wordmark).
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
// Display and headings (h1, h2, landing display).
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"], weight: ["400", "500"], display: "swap" });
// The four landing art lines only (hero H1, spotlight H2, dark card H2, closing line). Tailwind: font-serif.
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: `${siteConfig.name}: job applications you'd sign`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  openGraph: { siteName: siteConfig.name, type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The head script sets data-motion pre-paint.
    <html lang="en" className={cn("h-full", "antialiased", inter.variable, interTight.variable, instrumentSerif.variable, "font-sans")} suppressHydrationWarning>
      <head>
        {/* Static constant from our own module, no user input (Next guide: preventing flash before hydration). */}
        <script dangerouslySetInnerHTML={{ __html: MOTION_HEAD_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
