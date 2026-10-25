"use client";

import { BILLING_INTERVALS, PLANS, type BillingInterval } from "@auto-career/shared";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "../shared/button";
import { Field, Input } from "../shared/field";
import { EMAIL_RE, FormError, INPUT, OrDivider, PasswordInput, useFieldErrors } from "./fields";
import { GoogleButton } from "./google-button";

const INTERVAL_WORD: Record<BillingInterval, string> = { week: "weekly", month: "monthly", quarter: "quarterly" };

/**
 * ?plan=&interval= from /pricing (docs/03-app-flow.md), kept only when it names a paid plan sold at that interval.
 * Free and anything unknown return null.
 */
function chosenPlan(params: { get(name: string): string | null }) {
  const plan = PLANS.find((p) => p.id === params.get("plan"));
  const interval = BILLING_INTERVALS.find((i) => i === params.get("interval"));
  return plan && interval && plan.priceUsd[interval] ? { plan, interval } : null;
}

/** Every new account starts on Free (PRD AC 1); paid plans are bought later from /billing (Stripe Checkout). */
function PlanNote() {
  const chosen = chosenPlan(useSearchParams());
  if (!chosen) return null;
  const { plan, interval } = chosen;
  return (
    <p className="text-sm text-body">
      <span className="font-medium text-ink">
        You picked {plan.name}, billed {INTERVAL_WORD[interval]}.
      </span>{" "}
      Accounts start on Free; pay for {plan.name} from Billing when you are ready.
    </p>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const { errors, check, clear } = useFieldErrors();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name"));
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setError(null);
    const ok = check(e.currentTarget, {
      name: name.trim() ? undefined : "Enter your full name.",
      email: !email ? "Enter your email." : EMAIL_RE.test(email) ? undefined : "Enter an email like name@example.com.",
      password: password.length < 10 ? "Use at least 10 characters for your password." : undefined,
    });
    if (!ok) return;
    setPending(true);
    const { error: err } = await authClient.signUp.email({ name, email, password });
    setPending(false);
    if (err) return setError(err.message ?? "Could not create the account.");
    // Read here rather than with the hook, so only the note waits on Suspense and the form itself prerenders.
    const chosen = chosenPlan(new URLSearchParams(window.location.search));
    const carry = chosen ? `&plan=${chosen.plan.id}&interval=${chosen.interval}` : "";
    router.push(`/verify-otp?email=${encodeURIComponent(email)}${carry}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <Suspense>
        <PlanNote />
      </Suspense>
      <GoogleButton next="/onboarding" />
      <OrDivider />
      <form noValidate onSubmit={onSubmit} onInput={clear} className="flex flex-col gap-4">
        <Field label="Full name" htmlFor="name" hint="As it should appear on applications." error={errors.name}>
          <Input id="name" name="name" autoComplete="name" required aria-invalid={Boolean(errors.name) || undefined} className={INPUT} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(errors.email) || undefined} className={INPUT} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 10 characters." error={errors.password}>
          <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} aria-invalid={Boolean(errors.password) || undefined} />
        </Field>
        <FormError>{error}</FormError>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating account…" : "Create account"}
        </Button>
        <p className="text-sm text-faint">
          By creating an account you agree to the{" "}
          <Link href="/terms" className="lp-link">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="lp-link">
            privacy policy
          </Link>
          .
        </p>
      </form>
      <p className="auth__switch">
        Already have an account?{" "}
        <Link href="/login" className="auth-link">
          Sign in
        </Link>
      </p>
    </div>
  );
}
