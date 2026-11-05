import "./rainbow-button.css";
import Link from "next/link";
import type { ComponentProps } from "react";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

type Base = {
  /** lg: 56px hero CTA. md: 44px navbar. */
  size?: "md" | "lg";
  /** Trailing arrow; it moves 4px right on hover. */
  arrow?: boolean;
};
type AsLink = Base & ComponentProps<typeof Link>;
type AsButton = Base & ComponentProps<"button"> & { href?: undefined };

/**
 * Magic UI's Rainbow Button, rebuilt in-house (owner override 2026-10-29, docs/DESIGN.md "Primary Filled Button"):
 * Espresso face, 8px radius, a rainbow border and glow in the valley's own hues. Only the hero CTA
 * uses it (the navbar moved to ShinyButton, owner 2026-11-05). Renders next/link when href is given, else a <button>.
 */
export function RainbowButton(props: AsLink | AsButton) {
  const { size = "md", arrow, className, children, ...rest } = props;
  const cls = cn("kn-rainbow kn-press", `kn-rainbow--${size}`, className);
  const body = (
    <>
      {children}
      {arrow ? <ArrowRight aria-hidden="true" size={18} weight="light" className="kn-rainbow__arrow" /> : null}
    </>
  );
  if (rest.href !== undefined) {
    return (
      <Link className={cls} {...(rest as ComponentProps<typeof Link>)}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...(rest as ComponentProps<"button">)}>
      {body}
    </button>
  );
}
