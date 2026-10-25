"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";
import { Button } from "../shared/button";
import { Field, Input } from "../shared/field";
import { EMAIL_RE, FormError, FormNotice, INPUT, OrDivider, PasswordInput, useFieldErrors } from "./fields";
import { GoogleButton } from "./google-button";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Same-site paths only, so ?next= cannot send someone to another site after signing in.
  const next = safeNext(params.get("next"));
  const { errors, check, clear } = useFieldErrors();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setError(null);
    const ok = check(e.currentTarget, {
      email: !email ? "Enter your email." : EMAIL_RE.test(email) ? undefined : "Enter an email like name@example.com.",
      password: password ? undefined : "Enter your password.",
    });
    if (!ok) return;
    setPending(true);
    const { error: err } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (!err) return router.push(next);
    if (err.code === "EMAIL_NOT_VERIFIED") return router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
    setError(err.message ?? "Email or password is wrong.");
  }

  return (
    <div className="flex flex-col gap-5">
      {params.get("reset") ? <FormNotice>Password updated. Sign in with the new one.</FormNotice> : null}
      <GoogleButton next={next} />
      <OrDivider />
      <form noValidate onSubmit={onSubmit} onInput={clear} className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(errors.email) || undefined} className={INPUT} />
        </Field>
        <div className="flex flex-col">
          <Field label="Password" htmlFor="password" error={errors.password}>
            <PasswordInput id="password" name="password" autoComplete="current-password" required aria-invalid={Boolean(errors.password) || undefined} />
          </Field>
          <Link href="/forgot-password" className="auth-link mt-3 self-end text-sm">
            Forgot password?
          </Link>
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="auth__switch">
        New to Kairos?{" "}
        <Link href="/sign-up" className="auth-link">
          Create an account
        </Link>
      </p>
    </div>
  );
}
