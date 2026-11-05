"use client";

import Link from "next/link";
import { motion, type MotionProps } from "motion/react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { useMotionAllowed } from "@/components/landing/motion/use-motion-allowed";
import { cn } from "@/lib/utils";

const MotionLink = motion.create(Link);

/** Magic UI's Shiny Button, adapted: a link, in Kairos type, and still when motion is off. */
const sweep: MotionProps = {
  initial: { "--x": "100%", scale: 0.8 } as MotionProps["initial"],
  animate: { "--x": "-100%", scale: 1 } as MotionProps["animate"],
  whileTap: { scale: 0.95 },
  transition: { repeat: Infinity, repeatType: "loop", repeatDelay: 1, type: "spring", stiffness: 20, damping: 15, mass: 2, scale: { type: "spring", stiffness: 200, damping: 5, mass: 0.5 } },
};

// Same stops as the reference. The 100% fallback is the still frame: every stop sits past the edge, so the label is solid.
const labelMask = "linear-gradient(-75deg, #000 calc(var(--x, 100%) + 20%), transparent calc(var(--x, 100%) + 30%), #000 calc(var(--x, 100%) + 100%))";
const ringMask = "linear-gradient(#000, #000) content-box exclude, linear-gradient(#000, #000)";
// The reference's 10, 50, 10 stops, white on the Espresso face: a dark shine would disappear.
const ringShine = "linear-gradient(-75deg, rgb(255 255 255 / 0.1) calc(var(--x, 100%) + 20%), rgb(255 255 255 / 0.5) calc(var(--x, 100%) + 25%), rgb(255 255 255 / 0.1) calc(var(--x, 100%) + 100%))";

type Props = { children: ReactNode; className?: string; href: ComponentProps<typeof Link>["href"] };

export function ShinyButton({ children, className, href }: Props) {
  const allowed = useMotionAllowed();
  return (
    <MotionLink
      // useMotionAllowed is false on the hydration render and Motion reads `initial` only on mount, so remount when it
      // flips. Without this the sweep starts at 0% instead of 100% and half of it is lost.
      key={allowed ? "sweep" : "still"}
      href={href}
      className={cn(
        "kn-shiny relative inline-flex min-h-11 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg bg-action px-5 text-[15px] font-medium text-white transition-[background-color,box-shadow] duration-300 ease-in-out hover:bg-action-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-solid",
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
