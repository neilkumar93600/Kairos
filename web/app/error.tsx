"use client";

import { Button } from "@/components/shared/button";
import { Container } from "@/components/shared/container";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="flex min-h-[60dvh] flex-col justify-center gap-4 py-24">
      <h1 className="text-3xl tracking-tight">Something broke on this page.</h1>
      <p className="max-w-[60ch] text-body">We logged it. Try again, and if it keeps happening, contact support.</p>
      <div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </Container>
  );
}
