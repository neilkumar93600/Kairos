"use client";

import Link from "next/link";
import { motion, type MotionProps } from "motion/react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { useMotionAllowed } from "@/components/landing/motion/use-motion-allowed";
import { cn } from "@/lib/utils";

const MotionLink = motion.create(Link);

/** Magic UI's Shiny Button, adapted: a link, in Kairos type, and still when motion is off. */
const sweep: MotionProps = {
  initial: { "--x": "100%" } as MotionProps["initial"],
  animate: { "--x": "-100%" } as MotionProps["animate"],
  whileTap: { scale: 0.95 },
  transition: { repeat: Infinity, repeatType: "loop", repeatDelay: 1, type: "spring", stiffness: 20, damping: 15, mass: 2, scale: { type: "spring", stiffness: 200, damping: 5, mass: 0.5 } },
};

// The label never drops below 55 percent, so it stays readable while the shine passes.
const labelMask = "linear-gradient(-75deg, #000 calc(var(--x, 100%) + 20%), rgb(0 0 0 / 0.55) calc(var(--x, 100%) + 30%), #000 calc(var(--x, 100%) + 100%))";
const ringMask = "linear-gradient(#000, #000) content-box exclude, linear-gradient(#000, #000)";
const ringShine = "linear-gradient(-75deg, color-mix(in srgb, var(--primary) 14%, transparent) calc(var(--x, 100%) + 20%), color-mix(in srgb, var(--primary) 70%, transparent) calc(var(--x, 100%) + 25%), color-mix(in srgb, var(--primary) 14%, transparent) calc(var(--x, 100%) + 100%))";

type Props = { children: ReactNode; className?: string; href: ComponentProps<typeof Link>["href"] };

export function ShinyButton({ children, className, href }: Props) {
  const allowed = useMotionAllowed();
  return (
    <MotionLink
      href={href}
      className={cn(
        "kn-shiny relative inline-flex min-h-11 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg px-5 text-[15px] font-medium text-ink backdrop-blur-xl transition-shadow duration-300 ease-in-out hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid",
        className,
      )}
      {...(allowed ? sweep : {})}
    >
      <span className="relative block" style={{ maskImage: labelMask, WebkitMaskImage: labelMask } as CSSProperties}>
        {children}
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 block rounded-[inherit] p-px" style={{ mask: ringMask, WebkitMask: ringMask, backgroundImage: ringShine } as CSSProperties} />
    </MotionLink>
  );
}
