"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Plus, Trash, WarningCircle, X } from "@phosphor-icons/react";
import type { FactKind } from "@auto-career/shared";
import { Field, Input, Textarea } from "@/components/shared/field";
import { useMe } from "@/hooks/use-me";
import { useFacts, useProfileActions, type Fact } from "@/hooks/use-profile";
import { ApiError } from "@/lib/api";
import { DRAFTS, draftKey } from "@/lib/onboarding/form-facts";
import { forgetPendingBase, readSession, writeSession } from "@/lib/onboarding/session";
import { ChipsInput } from "../chips-input";
import { failureOf } from "../steps/upload";

/** Shared by the fill-in form's sections (spec 5.3b): the section state hook, fact writing, and the field pieces. */

/** Messages keyed by control id, in page order: the first one gets focus when a save is refused. */
export type Errors = Record<string, string>;
/** What a save may change as each write lands (new ids), kept even when a later write fails. */
export type Track<T> = { value: T };
/** The step asks the shown section to save before it leaves it; false keeps the user there. */
export type Bind = (save: (() => Promise<boolean>) | null) => void;
export type SectionProps = { bind: Bind };

type Rec<T> = { value: T; dirty: boolean };

export function readRecord<T>(userId: string, name: string): Rec<T> | null {
  try {
    return JSON.parse(readSession(draftKey(userId, name)) ?? "null") as Rec<T> | null;
  } catch {
    return null;
  }
}

/** Drops form drafts that are not this user's (another account in this tab, or the old unscoped keys). */
export function forgetOtherUsers(userId: string) {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith(DRAFTS) && !k.startsWith(draftKey(userId, ""))) sessionStorage.removeItem(k);
  } catch {
    // no storage: nothing kept to forget
  }
}

/**
 * One section's value. Every change is kept in sessionStorage under the user's draftKey until the section saves, so a
 * reload keeps it; a section with nothing changed saves nothing. Errors show on blur, shrink as the user types, and
 * all show on save with focus on the first. `keep`: fact sections keep their value (with the fact ids each entry
 * wrote) after a save; the others refill from the server. A saved change also forgets a pending base resume, so a
 * retry after a failed /default builds from the edited facts.
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
  const user = useMe().data?.user.id ?? "";
  const [rec] = useState(() => readRecord<T>(user, name));
  const [value, setValue] = useState<T>(() => rec?.value ?? initial());
  const [dirty, setDirty] = useState(rec?.dirty ?? false);
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

  const store = (v: T, unsaved: boolean) => writeSession(draftKey(user, name), unsaved || keep ? JSON.stringify({ value: v, dirty: unsaved }) : null);

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
    const track: Track<T> = { value };
    let ok = false;
    try {
      await save(value, track);
      ok = true;
    } catch (e) {
      setAlert(failureOf(e, "Could not save this section. Check your connection and try again."));
    } finally {
      forgetPendingBase();
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

/** Deletes a fact. One the resume or an application cites stays (409): its message comes back to show, and the fact stays shown. */
async function removeFact(actions: ReturnType<typeof useProfileActions>, id: string): Promise<string | null> {
  try {
    await actions.deleteFact.mutateAsync(id);
    return null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return e.message;
    throw e;
  }
}

/** Refused removals fail the save with the server's message, after every other write has landed. */
const refuse = (messages: string[]) => {
  if (messages.length) throw new ApiError(409, "fact_cited", messages[0]);
};

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
 * Which fact an entry owns. `seeded`: a confirmed fact already in the profile, shown read-only (its text cannot be
 * split back into fields). `removed`: hidden until the save deletes its fact; a refused delete shows it again.
 */
type Owned = { key: string; factId?: string; saved?: string; seeded?: boolean; removed?: boolean };

/**
 * A repeatable section where each entry is one confirmed fact (education, projects, certifications). An entry only
 * ever writes its own fact: POST once, PATCH when its text changes, DELETE when it is removed or emptied. With no
 * draft (a new tab, setup run again) the section opens with the profile's confirmed facts of its kind, so re-typing
 * them is never needed and saving again never duplicates one.
 */
export function FactEntries<K extends string>({
  name,
  kind,
  bind,
  noun,
  fields,
  text,
}: SectionProps & { name: string; kind: FactKind; noun: string; fields: Spec<K>[]; text: (entry: Record<K, string>) => string }) {
  type E = Record<K, string> & Owned;
  const actions = useProfileActions();
  const facts = useFacts();
  const blankFields = () => Object.fromEntries(fields.map((f) => [f.key, ""])) as Record<K, string>;
  const blank = () => ({ key: newKey(), ...blankFields() }) as E;
  const empty = (e: E) => fields.every((f) => !e[f.key].trim());
  const id = (e: E, k: K) => `ob-${name}-${e.key}-${k}`;
  const Noun = noun[0].toUpperCase() + noun.slice(1);

  const s = useSection<E[]>({
    name,
    bind,
    keep: true,
    initial: () => {
      const own = (facts.data ?? []).filter((f) => f.kind === kind && f.confirmed);
      return own.length ? own.map((f) => ({ ...blankFields(), key: f.id, factId: f.id, saved: f.text, seeded: true }) as E) : [blank()];
    },
    validate: (list) => {
      const errors: Errors = {};
      for (const e of list) {
        if (e.seeded || e.removed || empty(e)) continue;
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
    save: async (list, track) => {
      const refused: string[] = [];
      for (const e of list) {
        const gone = e.removed || (!e.seeded && empty(e));
        if (!gone || !e.factId) continue;
        const msg = await removeFact(actions, e.factId);
        if (msg) refused.push(msg);
        track.value = msg
          ? edit(track.value, e.key, { removed: false, seeded: e.seeded || empty(e) } as Partial<E>) // emptied: show what stays
          : e.removed
            ? track.value.filter((x) => x.key !== e.key)
            : edit(track.value, e.key, { factId: undefined, saved: undefined } as Partial<E>);
      }
      for (const e of list) {
        if (e.seeded || e.removed || empty(e)) continue;
        const t = text(e);
        if (!e.factId) {
          const fact = await actions.addFact.mutateAsync({ kind, text: t, confirmed: true });
          track.value = edit(track.value, e.key, { factId: fact.id, saved: t } as Partial<E>);
        } else if (t !== e.saved) {
          await actions.updateFact.mutateAsync({ id: e.factId, text: t });
          track.value = edit(track.value, e.key, { saved: t } as Partial<E>);
        }
      }
      refuse(refused);
    },
  });

  const add = useRef<HTMLDivElement>(null);
  const shown = s.value.filter((e) => !e.removed);
  return (
    <>
      {shown.map((e, i) => (
        <Entry
          key={e.key}
          legend={`${Noun} ${i + 1}`}
          onRemove={() => {
            s.set(e.factId ? edit(s.value, e.key, { removed: true } as Partial<E>) : s.value.filter((x) => x.key !== e.key));
            add.current?.querySelector("button")?.focus();
          }}
        >
          {e.seeded ? (
            <div className="ob-wide">
              <p className="ob-saved">{e.saved}</p>
              <p className="ob-help">Already in your profile. To change it, remove it and add it again.</p>
            </div>
          ) : (
            fields.map((f) => {
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
            })
          )}
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
          {shown.length ? `Add another ${noun}` : `Add a ${noun}`}
        </AddButton>
      </div>
      <SectionAlert message={s.alert} />
    </>
  );
}

type Written = { id: string; text: string };
/** chips: typed here. groups: the facts they were written as, by group index. kept: facts already in the profile, read-only. */
export type ChipsValue = { chips: string[]; groups: Written[]; kept: Array<Written & { removed?: boolean }> };

/**
 * Skills and languages: chips written as skill facts. Group i of `texts(chips)` always writes group i's own fact
 * (POST once, PATCH when it changes, DELETE when it is gone). Facts already in the profile come in through `seed`.
 */
export function FactChips({
  name,
  bind,
  texts,
  seed,
  ...input
}: SectionProps & {
  name: string;
  texts: (chips: string[]) => string[];
  seed: (facts: Fact[]) => ChipsValue;
  label: string;
  placeholder: string;
  max: number;
  minLen: number;
  maxLen: number;
  help: string;
}) {
  const actions = useProfileActions();
  const facts = useFacts();
  const s = useSection<ChipsValue>({
    name,
    bind,
    keep: true,
    initial: () => seed((facts.data ?? []).filter((f) => f.kind === "skill" && f.confirmed)),
    validate: () => ({}),
    save: async (v, track) => {
      const refused: string[] = [];
      const put = (patch: Partial<ChipsValue>) => (track.value = { ...track.value, ...patch });
      for (const k of v.kept.filter((x) => x.removed)) {
        const msg = await removeFact(actions, k.id);
        if (msg) refused.push(msg);
        put({ kept: msg ? track.value.kept.map((x) => (x.id === k.id ? { ...x, removed: false } : x)) : track.value.kept.filter((x) => x.id !== k.id) });
      }
      const want = texts(v.chips);
      for (const [i, text] of want.entries()) {
        const g = track.value.groups[i];
        if (g?.text === text) continue;
        if (g) await actions.updateFact.mutateAsync({ id: g.id, text });
        const id = g?.id ?? (await actions.addFact.mutateAsync({ kind: "skill", text, confirmed: true })).id;
        put({ groups: [...track.value.groups.slice(0, i), { id, text }, ...track.value.groups.slice(i + 1)] });
      }
      for (const g of track.value.groups.slice(want.length)) {
        const msg = await removeFact(actions, g.id);
        if (msg) refused.push(msg);
        put({ groups: track.value.groups.filter((x) => x !== g), kept: msg ? [...track.value.kept, g] : track.value.kept });
      }
      refuse(refused);
    },
  });
  const kept = s.value.kept.filter((k) => !k.removed);
  return (
    <>
      <ChipsInput id={`ob-${name}`} {...input} values={s.value.chips} onChange={(chips) => s.set({ ...s.value, chips })} />
      {kept.length ? (
        <div className="ob-field">
          <p id={`ob-${name}-kept`} className="ob-label">
            Already in your profile
          </p>
          <div className="ob-chips" role="group" aria-labelledby={`ob-${name}-kept`}>
            {kept.map((k) => (
              <button
                key={k.id}
                type="button"
                className="ob-chip"
                aria-label={`Remove ${k.text}`}
                onClick={() => {
                  s.set({ ...s.value, kept: s.value.kept.map((x) => (x.id === k.id ? { ...x, removed: true } : x)) });
                  document.getElementById(`ob-${name}`)?.focus();
                }}
              >
                {k.text}
                <X size={14} aria-hidden />
              </button>
            ))}
          </div>
          <p className="ob-help">Remove any that are wrong. To change one, remove it and add it again above.</p>
        </div>
      ) : null}
      <SectionAlert message={s.alert} />
    </>
  );
}
