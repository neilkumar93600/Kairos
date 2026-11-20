"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "../shared/button";
import { CODE_ERRORS, CodeInput, FormError } from "./fields";

/** Seconds before another code can be asked for. The API also caps code emails per address and per hour. */
const RESEND_AFTER = 30;

type Purpose = "email-verification" | "forget-password";
type ApiError = { code?: string; message?: string; status?: number } | null;

/**
 * Only the API's own verdict on the code says the code is wrong. USER_NOT_FOUND reads as a wrong code, so this step never
 * tells anyone whether an account exists. Anything else (the API down, a 500, rate limits) is said as what it is.
 */
function codeMessage(err: NonNullable<ApiError>) {
  if (err.code === "USER_NOT_FOUND") return CODE_ERRORS.INVALID_OTP!;
  if (err.code && CODE_ERRORS[err.code]) return CODE_ERRORS[err.code]!;
  if (err.status === 429) return "Too many tries for now. Wait a minute, then try again.";
  return "Could not check the code right now. Try again in a moment.";
}

/**
 * The email-code step, shared by sign-up (verify the address) and forgot password (prove the address before choosing a
 * new password). It names the address the code went to, centres the six boxes in two groups of three, and offers a new
 * code after 30 seconds. `verify` returns the API's error, or null when the code is right.
 */
export function CodeStep({
  email,
  purpose,
  verify,
  onVerified,
  submitLabel,
  changeHref,
}: {
  email: string;
  purpose: Purpose;
  verify: (otp: string) => Promise<ApiError>;
  onVerified: (otp: string) => void;
  submitLabel: string;
  changeHref: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const otp = String(new FormData(e.currentTarget).get("otp")).trim();
    if (otp.length !== 6) return setError("Enter the 6-digit code from the email.");
    setError(null);
    setPending(true);
    const err = await verify(otp);
    setPending(false);
    if (err) return setError(codeMessage(err));
    onVerified(otp);
  }

  return (
    <div className="flex flex-col gap-6">
      <p id="otp-sent" className="text-body">
        We sent a 6-digit code to <span className="font-medium text-ink wrap-anywhere">{email}</span>. It expires in 10 minutes.{" "}
        <Link href={changeHref} className="auth-link">
          Change email
        </Link>
      </p>
      <form noValidate onSubmit={onSubmit} onInput={() => setError(null)} className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3">
          <label htmlFor="otp" className="sr-only">
            6-digit code
          </label>
          {/* No auto-submit: the code is checked only when Verify (or Enter) is pressed. */}
          <CodeInput invalid={Boolean(error)} aria-describedby={error ? "otp-error otp-sent" : "otp-sent"} />
          {error ? (
            <p id="otp-error" role="alert" className="text-center text-sm text-bad">
              {error}
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Checking…" : submitLabel}
        </Button>
      </form>
      <Resend email={email} purpose={purpose} />
    </div>
  );
}

/** "Resend in 30 s" counting down, then a real button; sending a code starts the count again. */
function Resend({ email, purpose }: { email: string; purpose: Purpose }) {
  const [left, setLeft] = useState(RESEND_AFTER);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function resend() {
    setNotice(null);
    setError(null);
    setSending(true);
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email, type: purpose });
    setSending(false);
    if (err) return setError(err.status === 429 ? "Too many codes for now. Wait a little, then try again." : (err.message ?? "Could not send a new code."));
    setNotice("A new code is on its way.");
    setLeft(RESEND_AFTER);
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="auth__switch">
        Did not get it?{" "}
        {left > 0 ? (
          // The count is shown, not announced each second; the button that replaces it is reachable by Tab.
          <span className="text-faint tabular-nums">Resend in {left} s</span>
        ) : (
          <button type="button" onClick={resend} disabled={sending} className="auth-link">
            {sending ? "Sending…" : "Resend code"}
          </button>
        )}
      </p>
      <p role="status" className="text-sm text-ink">
        {notice}
      </p>
      <FormError>{error}</FormError>
    </div>
  );
}
