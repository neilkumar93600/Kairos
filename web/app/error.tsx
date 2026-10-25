"use client";

import Link from "next/link";
import { Logo } from "@/components/shared/logo";

/** Error boundary: self-contained, no shell, no painting; one glass panel on the site haze. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-16">
      <div className="glass-panel flex flex-col items-start gap-5 rounded-media px-6 py-8 md:px-10 md:py-10">
        <Logo />
        <h1 className="font-display text-4xl font-normal tracking-tight text-ink">Something broke on this page.</h1>
        <p className="text-lg text-body">We logged it. Try again, and if it keeps happening, contact support.</p>
        <div className="flex flex-wrap items-center gap-x-6">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center rounded-full bg-[#160f0c] px-6 font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink active:opacity-80"
          >
            Try again
          </button>
          <Link href="/" className="inline-flex min-h-11 items-center text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink">
            Back to the home page
          </Link>
        </div>
        {error.digest ? <p className="text-sm text-faint">Error reference {error.digest}</p> : null}
      </div>
    </main>
  );
}
