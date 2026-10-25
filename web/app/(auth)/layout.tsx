import "@/components/landing/landing.css";
import "@/components/landing/motion.css";
import "@/components/auth/auth.css";
import Image from "next/image";
import { FloatingCard } from "@/components/landing/floating-card";
import { Logo } from "@/components/shared/logo";

/**
 * Sign in, sign up, verify, forgot and reset (docs/DESIGN.md "Inner pages" > Auth). The form sits in one glass panel
 * on the site haze;
 * the dawn valley is a 24px panel beside it from 1024 and a short band behind the logo below that. The aside comes
 * last in the DOM, so the logo and the form are the first things read and tabbed.
 */
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
          <div className="auth__form glass-panel">{children}</div>
        </main>
      </div>
      <aside className="lp-art auth__art">
        <Image
          src="/landing/art/scene-a-dawn-valley-portrait.png"
          alt=""
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
        <FloatingCard sample={false} float className="auth__rule">
          <p className="auth__rule-title">Nothing is sent until you approve it.</p>
          <p className="auth__rule-body">You read every draft first, and each application keeps a receipt of what went out.</p>
        </FloatingCard>
      </aside>
    </div>
  );
}
