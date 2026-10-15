"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "../shared/button";
import { Field, Input } from "../shared/field";
import { GoogleButton } from "./google-button";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    setPending(true);
    setError(null);
    const { error: err } = await authClient.signIn.email({ email, password: String(form.get("password")) });
    setPending(false);
    if (!err) return router.push(next);
    if (err.code === "EMAIL_NOT_VERIFIED") return router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
    setError(err.message ?? "Email or password is wrong.");
  }

  return (
    <div className="flex flex-col gap-6">
      {params.get("reset") ? <p className="rounded-[6px] border border-line bg-surface px-3 py-2 text-sm text-foreground">Password updated. Sign in with the new one.</p> : null}
      <GoogleButton next={next} />
      <div className="flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        {error ? <p role="alert" className="text-sm text-bad">{error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-body hover:text-foreground">
          Forgot password?
        </Link>
        <Link href="/sign-up" className="text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </div>
    </div>
  );
}
