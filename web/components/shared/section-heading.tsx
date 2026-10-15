import { cn } from "@/lib/utils";

export function SectionHeading({ eyebrow, title, body, className }: { eyebrow?: string; title: string; body?: string; className?: string }) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-3", className)}>
      {eyebrow ? <p className="w-fit rounded-pill bg-sunk px-3 py-1 text-[13px] font-medium text-faint">{eyebrow}</p> : null}
      <h2 className="text-[32px] leading-[1.1] tracking-[-0.035em] md:text-[44px]">{title}</h2>
      {body ? <p className="max-w-[65ch] text-lg leading-relaxed text-body">{body}</p> : null}
    </div>
  );
}
