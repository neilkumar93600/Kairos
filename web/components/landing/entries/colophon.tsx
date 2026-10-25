import Link from "next/link";
import { cacheLife } from "next/cache";
import { landingCopy } from "@/content/landing-copy";
import { siteConfig } from "@/lib/site";
import { InstagramLogo, LinkedinLogo, TiktokLogo, XLogo, YoutubeLogo } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/shared/logo";
import { FooterVideo } from "../islands/footer-video";
import "./colophon.css";

const c = landingCopy.footer;
const MEDIA = "/landing/footer";

/** The year the page was built. `new Date()` is only allowed in a cached scope under cacheComponents. */
async function buildYear() {
  "use cache";
  cacheLife("max");
  return (process.env.BUILD_DATE ?? new Date().toISOString()).slice(0, 4);
}

const SOCIAL_ICONS = {
  LinkedIn: LinkedinLogo,
  X: XLogo,
  Instagram: InstagramLogo,
  TikTok: TiktokLogo,
  YouTube: YoutubeLogo,
};

/**
 * Full-viewport footer (spec 10, "Driftbar" layout with the Kairos adaptations): paper top with the brand block and
 * three link columns, the blue-hour meadow loop fading up into the paper, and a frosted-glass "Kairos" wordmark
 * sinking into lavender fog. Last element in .lp, outside <main>, the page's one contentinfo. Server-rendered; the
 * island is the video with its pause control (plays near the viewport, paused under reduced motion).
 */
export async function Colophon() {
  const year = await buildYear();

  return (
    <footer id="colophon" data-section="footer" className="ft">
      <div className="ft__stage">
        <picture>
          <source type="image/avif" srcSet={`${MEDIA}/meadow-poster.avif`} />
          <img className="ft__media" src={`${MEDIA}/meadow-poster.webp`} alt="" width={1920} height={1080} loading="lazy" decoding="async" />
        </picture>
        <FooterVideo className="ft__media ft__video" src={`${MEDIA}/meadow.mp4`} />
      </div>
      <p className="ft__wordmark" aria-hidden="true">
        {c.wordmark}
      </p>
      <div className="ft__fog" aria-hidden="true" />

      <div className="ft__content">
        <div className="ft-brand">
          <Logo className="ft-brand__logo" />
          <h2 className="ft-brand__title">Job applications you would sign.</h2>
          <p className="ft-brand__text">
            A job application agent that applies only where you fit, cites a confirmed fact for every line, and keeps a
            receipt of everything it sends.
          </p>
          <p className="ft-brand__follow">Follow us</p>
          <ul className="ft-social" aria-label="Follow Kairos">
            {siteConfig.social.map(({ label, href }) => {
              const Icon = SOCIAL_ICONS[label];
              return (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Kairos on ${label}`}>
                    <Icon size={18} weight="light" aria-hidden="true" />
                  </a>
                </li>
              );
            })}
          </ul>
          <p className="ft-brand__copy">{c.copyright.replace("{BUILD_YEAR}", year)}</p>
        </div>

        {siteConfig.footer.map((group, i) => (
          // The first column takes the spec's "Menu" styling (tighter, weight 500, ink).
          <nav key={group.title} className={i === 0 ? "ft-col ft-col--menu" : "ft-col"} aria-label={group.title}>
            <h3 className="ft-col__title">{group.title}</h3>
            <ul className="ft-col__list">
              {group.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
