"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "../shared/button";
import { Field, Input } from "../shared/field";
import { EMAIL_RE, INPUT, useFieldErrors } from "./fields";

export function ForgotPasswordForm() {
  const router = useRouter();
  const { errors, check, clear } = useFieldErrors();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    const ok = check(e.currentTarget, {
      email: !email ? "Enter your email." : EMAIL_RE.test(email) ? undefined : "Enter an email like name@example.com.",
    });
    if (!ok) return;
    setPending(true);
    // Same response whether or not the account exists, so this form cannot be used to probe emails.
    await authClient.emailOtp.sendVerificationOtp({ email, type: "forget-password" });
    router.push(`/reset-password?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <form noValidate onSubmit={onSubmit} onInput={clear} className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email" hint="We will send a 6-digit code if an account exists." error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(errors.email) || undefined} className={INPUT} />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Sending…" : "Send reset code"}
        </Button>
      </form>
      <p className="auth__switch">
        Remembered it?{" "}
        <Link href="/login" className="auth-link">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
