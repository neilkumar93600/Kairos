"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "../shared/button";
import { Field, Input } from "../shared/field";

export function VerifyOtpForm() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const otp = String(new FormData(e.currentTarget).get("otp")).trim();
    setPending(true);
    setError(null);
    const { error: err } = await authClient.emailOtp.verifyEmail({ email, otp });
    setPending(false);
    if (err) return setError(err.message ?? "That code did not work. Check it or send a new one.");
    router.push("/onboarding");
  }

  async function resend() {
    setError(null);
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
    setNotice(err ? null : "A new code is on its way.");
    if (err) setError(err.message ?? "Could not send a new code.");
  }

  if (!email) return <p className="text-sm text-body">Open the link from the sign-up page, or sign up again.</p>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-body">
        We sent a 6-digit code to <span className=" text-foreground">{email}</span>. It expires in 10 minutes.
      </p>
      <Field label="Code" htmlFor="otp">
        <Input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="tabular-nums tracking-[0.4em]" />
      </Field>
      {error ? <p role="alert" className="text-sm text-bad">{error}</p> : null}
      {notice ? <p className="text-sm text-foreground">{notice}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Verify email"}
      </Button>
      <button type="button" onClick={resend} className="text-sm text-body hover:text-foreground">
        Send a new code
      </button>
    </form>
  );
}
