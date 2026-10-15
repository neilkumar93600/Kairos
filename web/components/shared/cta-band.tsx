import { ButtonLink } from "./button";
import { Container } from "./container";

export function CtaBand({ title = "Try it on 25 real applications.", body = "No card. Every application waits for your approval." }: { title?: string; body?: string }) {
  return (
    <section className="border-t border-line py-20">
      <Container className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="flex flex-col gap-2">
          <h2 className="text-[32px] leading-[1.1] tracking-[-0.035em]">{title}</h2>
          <p className="text-body">{body}</p>
        </div>
        <ButtonLink href="/sign-up" size="lg">
          Start free
        </ButtonLink>
      </Container>
    </section>
  );
}
