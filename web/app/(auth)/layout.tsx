import "@/components/landing/landing.css";
import "@/components/landing/motion.css";
import "@/components/auth/auth.css";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { siteConfig } from "@/lib/site";

/** The form comes first in reading order; the landscape becomes a compact doorway on phones. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="lp auth">
      <a className="lp-skip" href="#main">
        Skip to main content
      </a>
      <div className="auth__col">
        <header className="auth__head">
          <Logo />
        </header>
        <main id="main" className="auth__main">
          <div className="auth__form">{children}</div>
        </main>
        <footer className="auth__footer">
          <nav aria-label="Legal and support">
            {siteConfig.footer.find((group) => group.title === "Legal")?.links.map((link) => (
              <Link key={link.href} href={link.href}>{link.label}</Link>
            ))}
            <Link href="/contact">Support</Link>
          </nav>
        </footer>
      </div>
      <aside className="lp-art auth__art" aria-label="Your next chapter">
        <Image
          src="/landing/art/scene-a-dawn-valley-portrait.png"
          alt=""
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1024px) 50vw, (min-width: 768px) 720px, 100vw"
        />
        <p className="auth__statement">Your next chapter.<br />On your terms.</p>
        <div className="auth__rule">
          <span className="auth__rule-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="m6 12 4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <div>
            <p className="auth__rule-title">You always have the final say.</p>
            <p className="auth__rule-body">Review every draft. Nothing is sent until you approve it.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
