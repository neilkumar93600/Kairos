import Link from "next/link";
import { Container } from "@/components/shared/container";

export default function NotFound() {
  return (
    <Container className="flex min-h-[60dvh] flex-col justify-center gap-4 py-24">
      <p className="tabular-nums text-sm text-body">404</p>
      <h1 className="text-3xl tracking-tight">This page is not here.</h1>
      <p className="max-w-[60ch] text-body">The link may be old, or the page moved.</p>
      <Link href="/" className="text-foreground underline underline-offset-4">
        Back to the home page
      </Link>
    </Container>
  );
}
