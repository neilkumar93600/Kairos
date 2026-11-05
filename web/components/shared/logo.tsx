import Link from "next/link";
import { cn } from "@/lib/utils";

export interface LogoMarkProps {
  className?: string;
  fill?: string;
}

/**
 * Kairos mark: the door at the moment it opens. A frame standing on the ground line, the leaf swung inward on a
 * left hinge, and a shaft of light standing in the gap, ground to sky, that breaks up through a notch in the lintel (the signature: no stock
 * door or log-out icon has a broken lintel). One colour (currentColor, Ink by default). Never mirror it, and
 * never add a sill or a knob (docs/DESIGN.md > Logo). The viewBox hugs the drawn door with 1 unit of side margin.
 */
export function LogoMark({ className, fill }: LogoMarkProps) {
  return (
    <svg
      className={cn("h-5 w-auto aspect-[36/40] shrink-0 text-ink", className)}
      viewBox="0 0 36 40"
      fill={fill ?? "currentColor"}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M1 40V4A2 2 0 0 1 3 2H19.8V6H5.4L15 14.5V31.5L5.4 40Z" />
      <path d="M25.8 2H33A2 2 0 0 1 35 4V40H30.6V6H25.8Z" />
      <path d="M22.8 0L25.8 22L22.8 40L19.8 22Z" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 font-medium tracking-[-0.022em] text-ink transition-opacity hover:opacity-90",
        className
      )}
      aria-label="Kairos home"
    >
      <LogoMark />
      <span className="font-display font-medium leading-none tracking-[-0.02em]">Kairos</span>
    </Link>
  );
}
