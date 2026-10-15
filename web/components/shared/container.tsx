import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[calc(var(--c-wide)+4rem)] px-4 sm:px-6 lg:px-8", className)} {...props} />;
}
