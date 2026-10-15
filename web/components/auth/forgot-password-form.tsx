"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "../shared/button";
import { Field, Input } from "../shared/field";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    setPending(true);
    // Same response whether or not the account exists, so this form cannot be used to probe emails.
    await authClient.emailOtp.sendVerificationOtp({ email, type: "forget-password" });
    router.push(`/reset-password?email=${encodeURIComponent(email)}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Email" htmlFor="email" hint="We will send a 6-digit code if an account exists.">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset code"}
      </Button>
      <Link href="/login" className="text-sm text-body hover:text-foreground">
        Back to sign in
      </Link>
    </form>
  );
}
