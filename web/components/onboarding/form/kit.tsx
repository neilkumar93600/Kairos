"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import type { FactKind } from "@auto-career/shared";
import { Field, Input, Textarea } from "@/components/shared/field";
import { useProfileActions } from "@/hooks/use-profile";
import { ApiError } from "@/lib/api";
import { draftKey } from "@/lib/onboarding/form-facts";
import { readSession, writeSession } from "@/lib/onboarding/session";
import { failureOf } from "../steps/upload";

/** Shared by the fill-in form's sections (spec 5.3b): the section state hook, fact syncing, and the field pieces. */

/** Messages keyed by control id, in page order: the first one gets focus when a save is refused. */
export type Errors = Record<string, string>;
export type SavedFact = { id: string; text: string };
/** What a save may change as each write lands, kept even when a later write fails: the value (new ids) and the facts it owns. */
export type Track<T> = { value: T; facts: SavedFact[] };
/** The step asks the shown section to save before it leaves it; false keeps the user there. */
export type Bind = (save: (() => Promise<boolean>) | null) => void;
export type SectionProps = { bind: Bind };

type Rec<T> = { value: T; dirty: boolean; facts: SavedFact[] };

export function readRecord<T>(name: string): Rec<T> | null {
  try {
    return JSON.parse(readSession(draftKey(name)) ?? "null") as Rec<T> | null;
  } catch {
    return null;
  }
}

/**
 * One section's value. Every change is kept in sessionStorage under draftKey(name) until the section saves, so a
 * reload keeps it; a section with nothing changed saves nothing. Errors show on blur, shrink as the user types, and
 * all show on save with focus on the first. `keep`: fact sections keep their value and the facts they wrote after a
 * save, since facts cannot refill the form; the others refill from the server.
 */
export function useSection<T>({
  name,
  bind,
  initial,
  validate,
  save,
  keep = false,
}: {
  name: string;
  bind: Bind;
  initial: () => T;
  validate: (value: T) => Errors;
  save: (value: T, track: Track<T>) => Promise<void>;
  keep?: boolean;
}) {
  const [rec] = useState(() => readRecord<T>(name));
  const [value, setValue] = useState<T>(() => rec?.value ?? initial());
  const [dirty, setDirty] = useState(rec?.dirty ?? false);
  const facts = useRef(rec?.facts ?? []);
  const [errors, setErrors] = useState<Errors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string } | null>(null);

  // The wizard (Continue) and the step (leaving a section) make the section inert while a save runs, and an inert field
  // takes no focus: it moves to the first invalid field once that save has ended.
  useEffect(() => {
    const el = focus && document.getElementById(focus.id);
    if (!el) return;
    const tryFocus = () => {
      if (el.closest("[inert]")) return false;
      el.focus();
      return true;
    };
    if (tryFocus()) return;
    const watch = new MutationObserver(() => {
      if (tryFocus()) watch.disconnect();
    });
    watch.observe(document.body, { subtree: true, attributeFilter: ["inert"] });
    return () => watch.disconnect();
  }, [focus]);

  const store = (v: T, unsaved: boolean) =>
    writeSession(draftKey(name), unsaved || keep ? JSON.stringify({ value: v, dirty: unsaved, facts: facts.current }) : null);

  const set = (v: T) => {
    setValue(v);
    setDirty(true);
    store(v, true);
    setErrors((e) => {
      const now = validate(v);
      return Object.fromEntries(Object.keys(e).flatMap((id) => (now[id] ? [[id, now[id]]] : [])));
    });
  };

  const blur = (id: string) =>
    setErrors((e) => {
      const next = { ...e };
      delete next[id];
      const msg = validate(value)[id];
      return msg ? { ...next, [id]: msg } : next;
    });

  const run = async () => {
    if (!dirty) return true;
    const all = validate(value);
    setErrors(all);
    const first = Object.keys(all)[0];
    if (first) {
      setFocus({ id: first });
      return false;
    }
    setAlert(null);
    const track: Track<T> = { value, facts: facts.current };
    let ok = false;
    try {
      await save(value, track);
      ok = true;
    } catch (e) {
      setAlert(failureOf(e, "Could not save this section. Check your connection and try again."));
    } finally {
      facts.current = track.facts;
      setValue(track.value);
      setDirty(!ok);
      store(track.value, !ok);
    }
    return ok;
  };

  // Re-bound every render, so the step always saves the current value.
  useEffect(() => {
    bind(run);
    return () => bind(null);
  });

  return { value, set, alert, field: (id: string) => ({ id, error: errors[id], onBlur: () => blur(id) }) };
}

/**
 * Makes the server's facts of one kind match `texts`: unchanged facts stay, a changed one is patched in place, extra
 * ones are deleted and new ones created confirmed (the user typed them). Saving twice never duplicates a fact.
 */
export async function syncFacts(kind: FactKind, texts: string[], track: Track<unknown>, actions: ReturnType<typeof useProfileActions>) {
  const want = [...new Set(texts)];
  const stale = track.facts.filter((f) => !want.includes(f.text));
  for (const text of want.filter((t) => !track.facts.some((f) => f.text === t))) {
    const old = stale.shift();
    if (old) await actions.updateFact.mutateAsync({ id: old.id, text });
    const id = old?.id ?? (await actions.addFact.mutateAsync({ kind, text, confirmed: true })).id;
    track.facts = [...track.facts.filter((f) => f !== old), { id, text }];
  }
  for (const old of stale) {
    try {
      await actions.deleteFact.mutateAsync(old.id);
    } catch (e) {
      // ponytail: a fact the base resume cites cannot be deleted (409); it stays in Profile and this form lets go of it
      if (!(e instanceof ApiError && e.status === 409)) throw e;
    }
    track.facts = track.facts.filter((f) => f !== old);
  }
}

/** Entry keys for React and for field ids; not sent anywhere. */
export const newKey = () => Math.random().toString(36).slice(2, 10);

export function edit<E extends { key: string }>(list: E[], key: string, patch: Partial<E>): E[] {
  return list.map((e) => (e.key === key ? { ...e, ...patch } : e));
}

type Own = { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; hint?: string; wide?: boolean };

export function TextField({ label, hint, error, onChange, wide, ...input }: Own & Omit<ComponentProps<"input">, keyof Own>) {
  return (
    <div className={wide ? "ob-wide" : undefined}>
      <Field label={label} htmlFor={input.id} hint={hint} error={error}>
        <Input {...input} onChange={(e) => onChange(e.target.value)} />
      </Field>
    </div>
  );
}

export function TextBox({ label, hint, error, onChange, wide = true, ...input }: Own & Omit<ComponentProps<"textarea">, keyof Own>) {
  return (
    <div className={wide ? "ob-wide" : undefined}>
      <Field label={label} htmlFor={input.id} hint={hint} error={error}>
        <Textarea {...input} onChange={(e) => onChange(e.target.value)} />
      </Field>
    </div>
  );
}

/** One repeatable entry (a job, a school): a card with its own legend and a Remove button. */
export function Entry({ legend, onRemove, children }: { legend: string; onRemove: () => void; children: ReactNode }) {
  return (
    <fieldset className="ob-entry">
      <legend className="ob-entry__legend">{legend}</legend>
      <button type="button" className="ob-entry__remove" onClick={onRemove}>
        <Trash size={16} aria-hidden />
        Remove<span className="sr-only"> {legend}</span>
      </button>
      {children}
    </fieldset>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="ob-add" onClick={onClick}>
      <Plus size={16} aria-hidden />
      {children}
    </button>
  );
}

/** A refused save from the server, shown in the section it belongs to. */
export function SectionAlert({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="ob-note__text ob-section-alert">
      <WarningCircle size={18} aria-hidden />
      {message}
    </p>
  ) : null;
}

/** Focuses the new entry's first field once it renders. */
export const focusSoon = (id: string) => setTimeout(() => document.getElementById(id)?.focus());

type Spec<K extends string> = {
  key: K;
  label: string;
  maxLength: number;
  /** The message when it is left empty; no message means optional. */
  required?: string;
  check?: (value: string) => string | undefined;
  multiline?: boolean;
  hint?: string;
} & Pick<ComponentProps<"input">, "autoComplete" | "inputMode" | "placeholder" | "type">;

/**
 * A repeatable section where each entry becomes one confirmed fact (education, projects, certifications). Blank
 * entries are ignored; the fact text must fit the server's 3 to 400 characters.
 */
export function FactEntries<K extends string>({
  name,
  kind,
  bind,
  noun,
  fields,
  text,
}: SectionProps & { name: string; kind: FactKind; noun: string; fields: Spec<K>[]; text: (entry: Record<K, string>) => string }) {
  type E = Record<K, string> & { key: string };
  const actions = useProfileActions();
  const blank = () => ({ key: newKey(), ...Object.fromEntries(fields.map((f) => [f.key, ""])) }) as E;
  const empty = (e: E) => fields.every((f) => !e[f.key].trim());
  const id = (e: E, k: K) => `ob-${name}-${e.key}-${k}`;
  const Noun = noun[0].toUpperCase() + noun.slice(1);

  const s = useSection<E[]>({
    name,
    bind,
    keep: true,
    initial: () => [blank()],
    validate: (list) => {
      const errors: Errors = {};
      for (const e of list) {
        if (empty(e)) continue;
        for (const f of fields) {
          const v = e[f.key].trim();
          const msg = v ? f.check?.(v) : f.required;
          if (msg) errors[id(e, f.key)] = msg;
        }
        const t = text(e);
        const long = fields.find((f) => f.multiline) ?? fields[0];
        if (t.length > 400) errors[id(e, long.key)] ??= `This is ${t.length - 400} characters too long for one fact. Shorten it.`;
        if (t.length < 3) errors[id(e, fields[0].key)] ??= "Write at least 3 characters.";
      }
      return errors;
    },
    save: (list, track) => syncFacts(kind, list.filter((e) => !empty(e)).map(text), track, actions),
  });

  const add = useRef<HTMLDivElement>(null);
  return (
    <>
      {s.value.map((e, i) => (
        <Entry
          key={e.key}
          legend={`${Noun} ${i + 1}`}
          onRemove={() => {
            s.set(s.value.filter((x) => x.key !== e.key));
            add.current?.querySelector("button")?.focus();
          }}
        >
          {fields.map((f) => {
            const props = {
              ...s.field(id(e, f.key)),
              label: f.label,
              hint: f.hint,
              maxLength: f.maxLength,
              value: e[f.key],
              "aria-required": !!f.required,
              onChange: (v: string) => s.set(edit(s.value, e.key, { [f.key]: v } as Partial<E>)),
            };
            const { autoComplete, inputMode, placeholder, type } = f;
            return f.multiline ? <TextBox key={f.key} {...props} /> : <TextField key={f.key} {...props} {...{ autoComplete, inputMode, placeholder, type }} />;
          })}
        </Entry>
      ))}
      <div ref={add}>
        <AddButton
          onClick={() => {
            const next = blank();
            s.set([...s.value, next]);
            focusSoon(id(next, fields[0].key));
          }}
        >
          {s.value.length ? `Add another ${noun}` : `Add a ${noun}`}
        </AddButton>
      </div>
      <SectionAlert message={s.alert} />
    </>
  );
}
