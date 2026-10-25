"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, ButtonLink } from "../shared/button";
import { Field } from "../shared/field";
import { CODE_ERRORS, CodeInput, FormError, useFieldErrors } from "./fields";

export function VerifyOtpForm() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const { errors, setErrors, check, clear } = useFieldErrors();
  const [notice, setNotice] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const otp = String(new FormData(formEl).get("otp")).trim();
    if (!check(formEl, { otp: otp.length === 6 ? undefined : "Enter the 6-digit code from the email." })) return;
    setPending(true);
    const { error: err } = await authClient.emailOtp.verifyEmail({ email, otp });
    setPending(false);
    if (err) {
      check(formEl, { otp: CODE_ERRORS[err.code ?? ""] ?? err.message ?? CODE_ERRORS.INVALID_OTP });
      return;
    }
    router.push("/onboarding");
  }

  async function resend() {
    setErrors({});
    setNotice(null);
    setResendError(null);
    setResending(true);
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
    setResending(false);
    if (err) setResendError(err.message ?? "Could not send a new code.");
    else setNotice("A new code is on its way.");
  }

  if (!email) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-body">This page needs the email you signed up with. Sign up again and we will send a new code.</p>
        <ButtonLink href="/sign-up" className="w-full">
          Sign up
        </ButtonLink>
        <p className="auth__switch">
          Already verified?{" "}
          <Link href="/login" className="auth-link">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form noValidate onSubmit={onSubmit} onInput={clear} className="flex flex-col gap-5">
        <p className="text-body">
          We sent a 6-digit code to <span className="break-all font-medium text-ink">{email}</span>. It expires in 10 minutes.
        </p>
        <Field label="Code" htmlFor="otp" error={errors.otp}>
          <CodeInput autoSubmit invalid={Boolean(errors.otp)} />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Checking…" : "Verify email"}
        </Button>
      </form>
      <div className="flex flex-col items-start gap-5">
        <div>
          <p className="auth__switch">
            No code yet?{" "}
            <button type="button" onClick={resend} disabled={resending} className="auth-link">
              {resending ? "Sending…" : "Send a new code"}
            </button>
          </p>
          <p role="status" className="text-sm text-ink">
            {notice}
          </p>
          <FormError>{resendError}</FormError>
        </div>
        <p className="auth__switch">
          Wrong email?{" "}
          <Link href="/sign-up" className="auth-link">
            Sign up again
          </Link>
        </p>
      </div>
    </div>
  );
}
