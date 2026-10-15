import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { Container } from "../shared/container";
import { Logo } from "../shared/logo";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-rule/40 py-14">
      <Container className="grid grid-cols-1 gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-faint">Job applications you would sign. Built by {siteConfig.company}.</p>
        </div>
        {siteConfig.footer.map((group) => (
          <div key={group.title} className="flex flex-col gap-3 text-sm">
            <p className="font-medium text-ink">{group.title}</p>
            {group.links.map((l) => (
              <Link key={l.href} href={l.href} className="text-body transition hover:text-ink hover:underline underline-offset-[3px]">
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </Container>
    </footer>
  );
}
