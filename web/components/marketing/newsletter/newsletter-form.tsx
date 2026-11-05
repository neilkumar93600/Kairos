"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { Input } from "@/components/shared/field";
import { marketingCopy } from "@/content/marketing-copy";
import { subscribeNewsletter, type NewsletterSource, type SubscribeResult } from "@/lib/newsletter";
import { cn } from "@/lib/utils";
import { SUBSCRIBED_KEY, writeKey } from "../popup/gate";
import "./newsletter-form.css";

const { newsletter } = marketingCopy;
const { states } = newsletter;
const errors: Partial<Record<string, string>> = {
  invalid: states.invalid,
  "rate-limited": states.rateLimited,
  network: states.networkError,
};

export interface NewsletterFormProps {
  source: NewsletterSource;
  /** card: its own glass surface and heading. inline: own heading, no surface. compact: no heading, no surface. Without a surface, it must sit on strong glass. */
  variant: "card" | "inline" | "compact";
  onSubscribed?: () => void;
}

/**
 * The one newsletter form (design direction 3.6). The field block and the sent block share a grid cell, so sending
 * does not change the height. No spinner; the button stays focusable while submitting. data-nl-form is how the popup
 * knows a form is on screen.
 */
export function NewsletterForm({ source, variant, onSubscribed }: NewsletterFormProps) {
  // The popup is compact in layout but reads the inline strings (its form asks in full: "Email me new posts").
  const fields = source === "popup" ? newsletter.inline : newsletter[variant];
  const [state, setState] = useState<"idle" | "submitting" | SubscribeResult>("idle");
  const [sentTo, setSentTo] = useState("");
  const ids = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const sentRef = useRef<HTMLDivElement>(null);
  const submitting = state === "submitting";
  const sent = state === "sent";
  const message = errors[state];

  useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "");
    setState("submitting");
    const result = await subscribeNewsletter({ email, source, website: String(data.get("website") ?? "") || undefined });
    if (result === "sent") {
      setSentTo(email.trim());
      writeKey(SUBSCRIBED_KEY, "1");
      onSubscribed?.();
    }
    setState(result);
    if (result === "invalid") inputRef.current?.focus();
  }

  function retry() {
    inputRef.current?.form?.reset();
    flushSync(() => setState("idle")); // the input is inert until this commits
    // Next frame: under reduced motion the fields' visibility is still mid-transition now, and a hidden input cannot take focus.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div
      data-nl-form=""
      id={variant === "card" ? "newsletter" : undefined}
      className={cn("nl", `nl--${variant}`, variant === "card" && "glass-panel")}
    >
      {variant === "compact" ? null : (
        <div className="nl-intro">
          {variant === "card" ? <h2 className="lp-h3">{fields.heading}</h2> : <h3 className="lp-h4">{fields.heading}</h3>}
          <p className="lp-body-sm">{fields.body}</p>
        </div>
      )}
      <form noValidate aria-busy={submitting || undefined} className="nl-stack" onSubmit={submit}>
        <div className="nl-fields" inert={sent}>
          <label htmlFor={`${ids}-email`} className="nl-label">
            {fields.label}
          </label>
          <div className="nl-row">
            <Input
              ref={inputRef}
              id={`${ids}-email`}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={254}
              placeholder={fields.placeholder}
              aria-invalid={state === "invalid" || undefined}
              aria-describedby={state === "invalid" ? `${ids}-msg` : undefined}
              onChange={() => {
                if (message) setState("idle");
              }}
            />
            <button type="submit" className="lp-btn nl-btn" aria-disabled={submitting || undefined}>
              {/* Both labels share one cell, so the pill is always as wide as the longer one. */}
              <span className="nl-btn-label">
                <span data-on={!submitting || undefined}>{fields.button}</span>
                <span data-on={submitting || undefined}>{states.submitting}</span>
              </span>
            </button>
          </div>
          <div aria-hidden="true" className="nl-hp">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <p className="lp-caption nl-caption">
            {newsletter.privacy.text}{" "}
            <Link href={newsletter.privacy.link.href} className="lp-link">
              {newsletter.privacy.link.label}
            </Link>
          </p>
          <p id={`${ids}-msg`} aria-live="polite" className="nl-msg">
            {message}
          </p>
        </div>
        {sent ? (
          <div ref={sentRef} role="status" tabIndex={-1} className="nl-sent">
            {/* A hollow square, not lime: a double opt-in is not finished until the visitor clicks the mail. */}
            <p className="nl-sent__line">
              <span className="lp-square-open" aria-hidden="true" />
              {variant === "compact" ? states.sent.short : states.sent.title}
            </p>
            <p className="lp-caption">{states.sent.body.replace("{email}", sentTo)}</p>
            <button type="button" className="lp-link nl-retry" onClick={retry}>
              {states.sent.retry}
            </button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
