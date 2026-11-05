"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { contactMessageSchema, type ContactMessage } from "@auto-career/shared";
import { marketingCopy } from "@/content/marketing-copy";
import { ApiError, post } from "@/lib/api";
import { Button } from "../shared/button";
import { Field, Input, Select, Textarea } from "../shared/field";
import "@/components/marketing/company/company.css";
import "./contact.css";

const { form: copy } = marketingCopy.contact;

type FieldName = keyof ContactMessage;
type Errors = Partial<Record<FieldName | "form", string>>;

// docs/DESIGN.md "Input Field": 44 px tall, 16 px text. The shared controls default to 40 / 14, so the size is
// passed in here rather than changed there.
const control = "h-11 text-base";

export function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [topicValue, setTopicValue] = useState<string>(copy.topics[0].value);
  const sentRef = useRef<HTMLDivElement>(null);
  const sent = state === "sent";
  const sending = state === "sending";
  const topic = copy.topics.find((t) => t.value === topicValue) ?? copy.topics[0];

  // The form turns inert once sent, so focus moves to the message instead of staying on a hidden button.
  useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const form = e.currentTarget;
    const parsed = contactMessageSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) {
      const names = parsed.error.issues.map((i) => i.path[0] as FieldName);
      setErrors(Object.fromEntries(names.map((name) => [name, copy.errors[name]])));
      (form.elements.namedItem(names[0]) as HTMLElement | null)?.focus();
      return;
    }
    setErrors({});
    setState("sending");
    try {
      await post("/contact", parsed.data);
      setState("sent");
    } catch (err) {
      setErrors({ form: err instanceof ApiError && err.status === 429 ? copy.errors.rateLimited : copy.errors.network });
      setState("idle");
    }
  }

  // Form and sent message share one grid cell (as the newsletter form), so the card keeps its height once sent.
  return (
    <div className="ct-stack">
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate inert={sent}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={copy.name} htmlFor="name" error={errors.name}>
            <Input id="name" name="name" autoComplete="name" className={control} aria-invalid={Boolean(errors.name)} />
          </Field>
          <Field label={copy.email} htmlFor="email" error={errors.email}>
            <Input id="email" name="email" type="email" autoComplete="email" className={control} aria-invalid={Boolean(errors.email)} />
          </Field>
        </div>
        <div className="flex flex-col gap-1">
          <Field label={copy.topic} htmlFor="topic" error={errors.topic} hint={topic.hint}>
            <Select id="topic" name="topic" value={topicValue} onChange={(e) => setTopicValue(e.target.value)} className={control}>
              {copy.topics.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          {"link" in topic ? (
            <p>
              <Link href={topic.link.href} className="lp-link ct-self">
                {topic.link.label}
              </Link>
            </p>
          ) : null}
        </div>
        <Field label={copy.message} htmlFor="message" error={errors.message} hint={copy.messageHint}>
          <Textarea id="message" name="message" className="min-h-36 text-base" aria-invalid={Boolean(errors.message)} />
        </Field>
        {errors.form ? (
          <p role="alert" className="text-sm text-bad">
            {errors.form}
          </p>
        ) : null}
        <div className="pt-1">
          <Button type="submit" size="lg" className="w-full sm:w-auto" aria-disabled={sending || undefined}>
            {sending ? copy.sending : copy.submit}
          </Button>
        </div>
      </form>
      {sent ? (
        <div ref={sentRef} role="status" tabIndex={-1} className="co-sent ct-sent">
          <p className="lp-h4 co-sent__title">
            <span className="lp-dot" aria-hidden="true" />
            {copy.sent.title}
          </p>
          <p className="lp-body-sm">{copy.sent.body}</p>
        </div>
      ) : null}
    </div>
  );
}
