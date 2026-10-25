export const siteConfig = {
  name: "Kairos",
  company: "Gray Matter Labs",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description:
    "Kairos finds jobs that fit, tailors your resume from facts you confirmed, and sends only the applications you approve.",
  supportEmail: "hello@kairos.app",
  // Placeholder links: replace with the real Kairos account URLs before launch.
  social: [
    { label: "LinkedIn", href: "#" },
    { label: "X", href: "#" },
    { label: "Instagram", href: "#" },
    { label: "TikTok", href: "#" },
    { label: "YouTube", href: "#" },
  ],
  publicNav: [
    { href: "/how-it-works", label: "How it works" },
    { href: "/pricing", label: "Pricing" },
    { href: "/blog", label: "Blog" },
    { href: "/about", label: "About" },
  ],
  footer: [
    {
      title: "Product",
      links: [
        { href: "/how-it-works", label: "How it works" },
        { href: "/pricing", label: "Pricing" },
        { href: "/blog", label: "Blog" },
      ],
    },
    {
      title: "Company",
      links: [
        { href: "/about", label: "About" },
        { href: "/careers", label: "Careers" },
        { href: "/contact", label: "Contact" },
      ],
    },
    {
      title: "Legal",
      links: [
        { href: "/terms", label: "Terms" },
        { href: "/privacy", label: "Privacy" },
        { href: "/cookies", label: "Cookies" },
        { href: "/refunds", label: "Refunds" },
      ],
    },
  ],
  dashboardNav: [
    { href: "/dashboard", label: "Overview", icon: "overview" },
    { href: "/matches", label: "Matches", icon: "matches" },
    { href: "/queue", label: "Review queue", icon: "queue" },
    { href: "/applications", label: "Applications", icon: "applications" },
    { href: "/inbox", label: "Replies", icon: "inbox" },
    { href: "/resume", label: "Resume", icon: "resume" },
    { href: "/profile", label: "Profile", icon: "profile" },
    { href: "/preferences", label: "Preferences", icon: "preferences" },
    { href: "/billing", label: "Billing", icon: "billing" },
    { href: "/settings", label: "Settings", icon: "settings" },
  ],
} as const;

export type DashboardIcon = (typeof siteConfig.dashboardNav)[number]["icon"];
