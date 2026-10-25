"use client";

import { useState, type FormEvent } from "react";
import { contactMessageSchema } from "@auto-career/shared";
import { ApiError, post } from "@/lib/api";
import { Button } from "../shared/button";
import { Field, Input, Select, Textarea } from "../shared/field";
import "@/components/marketing/company/company.css";

type Errors = Partial<Record<"name" | "email" | "topic" | "message" | "form", string>>;

// docs/DESIGN.md "Input Field": 44 px tall, 16 px text. The shared controls default to 40 / 14, so the size is
// passed in here rather than changed there.
const control = "h-11 text-base";

export function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = contactMessageSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setState("sending");
    try {
      await post("/contact", parsed.data);
      setState("sent");
    } catch (err) {
      setErrors({ form: err instanceof ApiError && err.status === 429 ? "Too many messages. Try again in an hour." : "Could not send. Try again." });
      setState("idle");
    }
  }

  if (state === "sent")
    return (
      <div role="status" className="co-sent">
        <p className="lp-h4 co-sent__title">
          <span className="lp-dot" aria-hidden="true" />
          Sent
        </p>
        <p className="lp-body-sm">Thanks. We reply within two working days.</p>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={errors.name}>
          <Input id="name" name="name" autoComplete="name" className={control} aria-invalid={Boolean(errors.name)} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" className={control} aria-invalid={Boolean(errors.email)} />
        </Field>
      </div>
      <Field label="Topic" htmlFor="topic" error={errors.topic}>
        <Select id="topic" name="topic" defaultValue="support" className={control}>
          <option value="support">Support</option>
          <option value="billing">Billing</option>
          <option value="partnership">Partnership</option>
          <option value="press">Press</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Message" htmlFor="message" error={errors.message} hint="At least 10 characters.">
        <Textarea id="message" name="message" className="min-h-36 text-base" aria-invalid={Boolean(errors.message)} />
      </Field>
      {errors.form ? (
        <p role="alert" className="text-sm text-bad">
          {errors.form}
        </p>
      ) : null}
      <div className="pt-1">
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
