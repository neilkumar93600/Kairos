"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, ButtonLink } from "../shared/button";
import { Field } from "../shared/field";
import { CodeStep } from "./code-step";
import { CODE_ERRORS, FormError, FormNotice, PasswordInput, useFieldErrors } from "./fields";

/**
 * Forgot password, after /forgot-password sent the code. Step 1 checks the code (without using it up); step 2 asks for
 * the new password twice and spends the same code to set it. If the code expired in between, it goes back to step 1.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const [otp, setOtp] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  if (!email) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-body">This page needs the email the code went to. Ask for a code first.</p>
        <ButtonLink href="/forgot-password" className="w-full">
          Get a reset code
        </ButtonLink>
        <BackToSignIn />
      </div>
    );
  }

  if (!otp) {
    return (
      <div className="flex flex-col gap-6">
        {codeError ? <FormError>{codeError}</FormError> : null}
        <CodeStep
          email={email}
          purpose="forget-password"
          submitLabel="Continue"
          changeHref="/forgot-password"
          verify={async (code) => (await authClient.emailOtp.checkVerificationOtp({ email, type: "forget-password", otp: code })).error}
          onVerified={(code) => {
            setCodeError(null);
            setOtp(code);
          }}
        />
        <BackToSignIn />
      </div>
    );
  }

  return (
    <NewPassword
      email={email}
      otp={otp}
      onCodeRejected={(message) => {
        setCodeError(message);
        setOtp(null);
      }}
      onDone={() => router.push("/login?reset=1")}
    />
  );
}

function NewPassword({ email, otp, onCodeRejected, onDone }: { email: string; otp: string; onCodeRejected: (message: string) => void; onDone: () => void }) {
  const { errors, check, clear } = useFieldErrors();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    const confirm = String(form.get("confirm"));
    setError(null);
    const ok = check(e.currentTarget, {
      password: password.length < 10 ? "Use at least 10 characters." : undefined,
      confirm: !confirm ? "Type the password again." : confirm === password ? undefined : "The two passwords do not match.",
    });
    if (!ok) return;
    setPending(true);
    const { error: err } = await authClient.emailOtp.resetPassword({ email, otp, password });
    setPending(false);
    const codeError = err?.code ? CODE_ERRORS[err.code] : undefined;
    if (codeError) return onCodeRejected(codeError);
    if (err) return setError(err.message ?? "Could not set the new password. Try again.");
    onDone();
  }

  return (
    <div className="flex flex-col gap-5">
      <FormNotice>
        {/* One span: FormNotice is a flex row, and loose text plus an element would become three columns. */}
        <span>
          Code accepted for <span className="font-medium wrap-anywhere">{email}</span>. Now choose a new password.
        </span>
      </FormNotice>
      <form noValidate onSubmit={onSubmit} onInput={clear} className="flex flex-col gap-4">
        <Field label="Create password" htmlFor="password" hint="At least 10 characters." error={errors.password}>
          {/* Focus lands here when the step opens, so keyboard and screen reader users start in the right place. */}
          <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} autoFocus aria-invalid={Boolean(errors.password) || undefined} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm}>
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required aria-invalid={Boolean(errors.confirm) || undefined} />
        </Field>
        <FormError>{error}</FormError>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Set new password"}
        </Button>
      </form>
      <BackToSignIn />
    </div>
  );
}

function BackToSignIn() {
  return (
    <p className="auth__switch">
      Remembered it?{" "}
      <Link href="/login" className="auth-link">
        Back to sign in
      </Link>
    </p>
  );
}
