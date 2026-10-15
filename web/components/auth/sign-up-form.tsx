"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "../shared/button";
import { Field, Input } from "../shared/field";
import { GoogleButton } from "./google-button";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    if (password.length < 10) return setError("Use at least 10 characters for your password.");
    setPending(true);
    setError(null);
    const { error: err } = await authClient.signUp.email({ name: String(form.get("name")), email, password });
    setPending(false);
    if (err) return setError(err.message ?? "Could not create the account.");
    router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <GoogleButton next="/onboarding" />
      <div className="flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Full name" htmlFor="name" hint="As it should appear on applications.">
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 10 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
        </Field>
        {error ? <p role="alert" className="text-sm text-bad">{error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="text-xs text-body">
        By creating an account you agree to the{" "}
        <Link href="/terms" className="underline underline-offset-2">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          privacy policy
        </Link>
        .
      </p>
      <p className="text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
