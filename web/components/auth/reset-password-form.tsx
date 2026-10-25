"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "../shared/button";
import { Field, Input } from "../shared/field";
import { CODE_ERRORS, CodeInput, EMAIL_RE, FormError, INPUT, PasswordInput, useFieldErrors } from "./fields";

export function ResetPasswordForm() {
  const router = useRouter();
  const presetEmail = useSearchParams().get("email") ?? "";
  const { errors, check, clear } = useFieldErrors();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    // The field is read-only and prefilled when ?email= is present, so this is that value; without it, what was typed.
    const email = String(form.get("email"));
    const otp = String(form.get("otp")).trim();
    const password = String(form.get("password"));
    setError(null);
    const ok = check(e.currentTarget, {
      email: !email ? "Enter your email." : EMAIL_RE.test(email) ? undefined : "Enter an email like name@example.com.",
      otp: otp.length === 6 ? undefined : "Enter the 6-digit code from the email.",
      password: password.length < 10 ? "Use at least 10 characters." : undefined,
    });
    if (!ok) return;
    setPending(true);
    const formEl = e.currentTarget;
    const { error: err } = await authClient.emailOtp.resetPassword({ email, otp, password });
    setPending(false);
    const codeError = err?.code ? CODE_ERRORS[err.code] : undefined;
    if (codeError) return void check(formEl, { otp: codeError });
    if (err) return setError(err.message ?? "That code did not work.");
    router.push("/login?reset=1");
  }

  return (
    <div className="flex flex-col gap-5">
      <form noValidate onSubmit={onSubmit} onInput={clear} className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={presetEmail}
            readOnly={Boolean(presetEmail)}
            required
            aria-invalid={Boolean(errors.email) || undefined}
            className={cn(INPUT, "read-only:border-rule read-only:bg-transparent read-only:text-body")}
          />
        </Field>
        <Field label="Code from the email" htmlFor="otp" error={errors.otp}>
          <CodeInput invalid={Boolean(errors.otp)} />
        </Field>
        <Field label="New password" htmlFor="password" hint="At least 10 characters." error={errors.password}>
          <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} aria-invalid={Boolean(errors.password) || undefined} />
        </Field>
        <FormError>{error}</FormError>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Set new password"}
        </Button>
      </form>
      <div className="flex flex-col items-start gap-5">
        <p className="auth__switch">
          Code expired?{" "}
          <Link href="/forgot-password" className="auth-link">
            Send a new one
          </Link>
        </p>
        <p className="auth__switch">
          <Link href="/login" className="auth-link">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
