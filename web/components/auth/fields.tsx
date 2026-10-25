"use client";

import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import { Input } from "../shared/field";

/** Auth inputs (DESIGN.md Input Field): 44px tall, 16px text so iOS does not zoom, Espresso border and ink ring on focus. */
export const INPUT = "h-11 text-base focus:border-action focus:outline-offset-3";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Better Auth's email-code errors in plain words (docs/03-app-flow.md: "That code did not work" + resend). */
export const CODE_ERRORS: Record<string, string> = {
  INVALID_OTP: "That code did not work. Check it or send a new one.",
  OTP_EXPIRED: "That code has expired. Send a new one.",
  TOO_MANY_ATTEMPTS: "Too many tries with this code. Send a new one.",
};

type Errors = Record<string, string | undefined>;

/**
 * Inline field errors. `check` shows them and focuses the first invalid field (keys in field order); typing in a
 * field clears its error (pass `clear` to the form's onInput).
 */
export function useFieldErrors() {
  const [errors, setErrors] = useState<Errors>({});
  function check(form: HTMLFormElement, next: Errors) {
    setErrors(next);
    const first = Object.keys(next).find((k) => next[k]);
    if (first) (form.elements.namedItem(first) as HTMLElement | null)?.focus();
    return !first;
  }
  function clear(e: FormEvent<HTMLFormElement>) {
    const name = (e.target as HTMLInputElement).name;
    setErrors((x) => (x[name] ? { ...x, [name]: undefined } : x));
  }
  return { errors, setErrors, check, clear };
}

/** Password with a show and hide toggle. The toggle is a 44px button inside the field's right edge. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  const Icon = shown ? EyeSlashIcon : EyeIcon;
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className={cn(INPUT, "pr-12", className)} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-input text-faint transition-colors duration-300 ease-out hover:text-ink"
      >
        <Icon size={20} weight="light" aria-hidden />
      </button>
    </div>
  );
}

const SLOT =
  "size-12 rounded-input border border-body bg-field text-xl text-ink first:rounded-l-input first:border-l last:rounded-r-input data-[active=true]:border-action data-[active=true]:ring-0 data-[active=true]:outline-2 data-[active=true]:outline-offset-2 data-[active=true]:outline-ink";

/**
 * The 6-digit email code as six boxes (shadcn InputOTP). One real input underneath, named "otp", so paste, the
 * one-time-code autofill and FormData all work. `autoSubmit` sends the form when the sixth digit lands.
 */
export function CodeInput({ invalid, autoSubmit }: { invalid?: boolean; autoSubmit?: boolean }) {
  return (
    <InputOTP
      id="otp"
      name="otp"
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      required
      aria-invalid={invalid || undefined}
      onComplete={autoSubmit ? () => (document.getElementById("otp") as HTMLInputElement | null)?.form?.requestSubmit() : undefined}
    >
      <InputOTPGroup className="gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <InputOTPSlot key={i} index={i} className={cn(SLOT, invalid && "border-bad")} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

/** A form-level error from the server, announced as it appears. */
export function FormError({ children }: { children: ReactNode }) {
  return children ? (
    <p role="alert" className="text-sm text-bad">
      {children}
    </p>
  ) : null;
}

/** A positive note (password updated): the word carries it, the lime dot only supports it. */
export function FormNotice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-3 rounded-card bg-sunk px-4 py-3 text-sm text-ink">
      <span className="lp-dot mt-1.25" aria-hidden />
      {children}
    </p>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-sm text-faint">
      <span className="h-px flex-1 bg-border" aria-hidden />
      or
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}
