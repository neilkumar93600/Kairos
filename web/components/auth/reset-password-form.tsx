"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "../shared/button";
import { Field, Input } from "../shared/field";

export function ResetPasswordForm() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 10) return setError("Use at least 10 characters.");
    setPending(true);
    setError(null);
    const { error: err } = await authClient.emailOtp.resetPassword({ email, otp: String(form.get("otp")).trim(), password });
    setPending(false);
    if (err) return setError(err.message ?? "That code did not work.");
    router.push("/login?reset=1");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" defaultValue={email} readOnly={Boolean(email)} required />
      </Field>
      <Field label="Code from the email" htmlFor="otp">
        <Input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="tabular-nums tracking-[0.4em]" />
      </Field>
      <Field label="New password" htmlFor="password" hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      {error ? <p role="alert" className="text-sm text-bad">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
