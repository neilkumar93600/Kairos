import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Duna (09 3, 6): Espresso is the only filled-button colour. Secondary is a ghost pill with a Stone border.
const variants = {
  primary: "bg-action text-on-action hover:bg-action-hover active:bg-action",
  // Solid Paper White: glass only goes over art (DESIGN.md Ghost Button), and app surfaces are flat Linen.
  secondary: "border border-rule bg-surface text-ink hover:bg-sunk active:bg-sunk/70",
  ghost: "text-ink hover:bg-sunk active:bg-sunk/70",
  danger: "bg-danger-fill text-white hover:brightness-110 active:brightness-95",
} as const;

// sm is the 36px dense app-row pill; md is the 44px nav and inline pill; lg is the 56px hero and closing pill.
// Pressed states change colour only (primary returns from its hover fill to Espresso); nothing moves.
const sizes = { sm: "h-9 px-4 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-14 px-7 text-base" } as const;

type Common = { variant?: keyof typeof variants; size?: keyof typeof sizes };

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-pill font-medium transition-colors duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-50";

export function Button({ variant = "primary", size = "md", className, ...props }: Common & ComponentProps<"button">) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: Common & ComponentProps<typeof Link>) {
  return <Link className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
