"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Briefcase, Certificate, ChartLineUp, FolderSimple, GraduationCap, ListChecks, Plus, Wrench, type Icon } from "@phosphor-icons/react";
import { FACT_KINDS, type FactKind } from "@auto-career/shared";
import { useFacts, useProfileActions, type Fact } from "@/hooks/use-profile";
import { ApiError } from "@/lib/api";
import { Button } from "../../shared/button";
import { EmptyEm, EmptyState } from "../../shared/empty-state";
import { ErrorNote } from "../../shared/error-note";
import { Field, Select, Textarea } from "../../shared/field";
import { Panel } from "../../shared/panel";
import { Skeleton } from "../../shared/skeleton";
import { StatusWord } from "../../shared/status";

const KIND: Record<FactKind, { label: string; icon: Icon }> = {
  role: { label: "Role", icon: Briefcase },
  project: { label: "Project", icon: FolderSimple },
  skill: { label: "Skills", icon: Wrench },
  metric: { label: "Metric", icon: ChartLineUp },
  education: { label: "Education", icon: GraduationCap },
  certification: { label: "Certification", icon: Certificate },
};

/** 36px dense-row pills keep a 44px hit area. */
export const HIT = "relative after:absolute after:inset-x-0 after:-inset-y-1";

/** Details grid columns follow the panel's width (container queries), so the grid also fits narrower hosts such as onboarding. */
export const GRID = "grid gap-x-8 px-6 @2xl:grid-cols-2 @5xl:grid-cols-3";

/** Inline error with a retry, used wherever a query or a mutation fails. */
export function RetryNote({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <ErrorNote error={error} />
      <Button size="sm" variant="secondary" className={HIT} onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/**
 * The truth-lock chip (DESIGN.md Reference layer, "Details grid"): "Confirmed" with the lime dot only when the user
 * confirmed the fact; anything else needs a fact before a tailored line may cite it.
 */
export function TruthChip({ confirmed }: { confirmed: boolean }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-pill bg-sunk px-2.5 text-xs font-medium whitespace-nowrap text-ink">
      {confirmed ? (
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-lime shadow-[0_0_0_1px_var(--ink)]" />
      ) : (
        <span aria-hidden className="size-2 shrink-0 border border-ink" />
      )}
      {confirmed ? "Confirmed" : "Needs a fact"}
    </span>
  );
}

/** One details-grid cell: icon, Deep Ash label (and chip), ink value, optional actions. A hairline-topped block, never a card. */
export function Detail({ icon: IconComponent, label, chip, actions, children }: { icon: Icon; label: string; chip?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] content-start gap-x-3 border-t border-line py-4">
      <IconComponent size={20} weight="light" aria-hidden className="mt-0.5 text-icon" />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-sm text-faint">{label}</span>
          {chip}
        </div>
        {children}
      </div>
      {actions ? <div className="col-start-2 mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null}
    </li>
  );
}

const byKind = (a: Fact, b: Fact) => FACT_KINDS.indexOf(a.kind) - FACT_KINDS.indexOf(b.kind);

/**
 * Facts parsed from the resume or typed by the user, as a details grid. Only confirmed facts can be cited by tailored
 * lines; the chip on every cell says which ones.
 */
export function FactList({ emptyAction }: { emptyAction?: ReactNode }) {
  const { data, isLoading, error, refetch } = useFacts();
  const { updateFact, deleteFact } = useProfileActions();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  if (isLoading) return <FactListSkeleton />;
  if (error || !data)
    return (
      <Panel title="Facts">
        <ErrorNote error={error} onRetry={() => refetch()} />
      </Panel>
    );

  const unconfirmed = data.filter((f) => !f.confirmed);
  const failed = updateFact.error ?? deleteFact.error;
  function retry() {
    if (updateFact.isError && updateFact.variables) updateFact.mutate(updateFact.variables);
    else if (deleteFact.variables) deleteFact.mutate(deleteFact.variables);
  }
  const addForm = <AddFact onDone={() => setAdding(false)} />;

  return (
    <Panel
      flush
      title="Facts"
      description={
        data.length
          ? `${data.length - unconfirmed.length} of ${data.length} confirmed. Tailored lines can only cite confirmed facts.`
          : "Tailored lines can only cite facts you confirmed here."
      }
      action={
        unconfirmed.length ? (
          <Button
            size="sm"
            variant="secondary"
            className={HIT}
            disabled={updateFact.isPending}
            onClick={() => unconfirmed.forEach((f) => updateFact.mutate({ id: f.id, confirmed: true }))}
          >
            {updateFact.isPending ? "Confirming…" : `Confirm all ${unconfirmed.length}`}
          </Button>
        ) : data.length ? (
          <StatusWord tone="positive" className="h-9">
            All confirmed
          </StatusWord>
        ) : null
      }
    >
      {failed ? (
        <div className="px-6 pb-4">
          <ErrorNote error={failed} onRetry={retry} />
        </div>
      ) : null}
      {data.length ? (
        <div className="@container">
          <ul className={GRID}>
            {[...data].sort(byKind).map((f) => (
              <FactCell
                key={f.id}
                fact={f}
                editing={editing === f.id}
                saving={updateFact.isPending && updateFact.variables?.id === f.id && updateFact.variables.text !== undefined}
                confirming={updateFact.isPending && updateFact.variables?.id === f.id && updateFact.variables.confirmed === true}
                removing={deleteFact.isPending && deleteFact.variables === f.id}
                onConfirm={() => updateFact.mutate({ id: f.id, confirmed: true })}
                onRemove={() => deleteFact.mutate(f.id)}
                onEdit={() => setEditing(f.id)}
                onCancel={() => setEditing(null)}
                // Editing never changes `confirmed`: the server keeps the flag, so a confirmed fact stays confirmed in the user's own words.
                onSave={(text) => updateFact.mutate({ id: f.id, text }, { onSuccess: () => setEditing(null) })}
              />
            ))}
            <li className="border-t border-line py-4">
              {adding ? (
                addForm
              ) : (
                <Button size="sm" variant="ghost" className={`${HIT} -ml-4`} onClick={() => setAdding(true)}>
                  <Plus size={16} weight="light" aria-hidden />
                  Add a fact
                </Button>
              )}
            </li>
          </ul>
        </div>
      ) : (
        <div className="mx-6 border-t border-line py-8">
          {adding ? (
            <div className="max-w-xl">{addForm}</div>
          ) : (
            <EmptyState
              flat
              icon={ListChecks}
              title={<>No <EmptyEm>facts</EmptyEm> yet</>}
              body="Paste your resume and Kairos reads it into short facts for you to check. You can also type a fact yourself."
              action={
                <>
                  {emptyAction}
                  <Button size="sm" variant="ghost" className={HIT} onClick={() => setAdding(true)}>
                    Add a fact
                  </Button>
                </>
              }
            />
          )}
        </div>
      )}
      <div className="h-2" />
    </Panel>
  );
}

function FactCell({
  fact,
  editing,
  saving,
  confirming,
  removing,
  onConfirm,
  onRemove,
  onEdit,
  onCancel,
  onSave,
}: {
  fact: Fact;
  editing: boolean;
  saving: boolean;
  confirming: boolean;
  removing: boolean;
  onConfirm: () => void;
  onRemove: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (text: string) => void;
}) {
  const { label, icon } = KIND[fact.kind];
  const textId = `fact-${fact.id}`;
  const busy = confirming || removing || saving;
  const chip = <TruthChip confirmed={fact.confirmed} />;

  if (editing)
    return (
      <Detail icon={icon} label={label} chip={chip}>
        <EditFact fact={fact} saving={saving} onSave={onSave} onCancel={onCancel} />
      </Detail>
    );

  return (
    <Detail
      icon={icon}
      label={label}
      chip={chip}
      actions={
        <>
          {fact.confirmed ? null : (
            <Button size="sm" variant="secondary" className={HIT} disabled={busy} aria-describedby={textId} onClick={onConfirm}>
              {confirming ? "Confirming…" : "Confirm"}
            </Button>
          )}
          {/* A ghost pill that starts the row pulls back so its label lines up with the text above. */}
          <Button size="sm" variant="ghost" className={`${HIT} first:-ml-4`} disabled={busy} aria-describedby={textId} onClick={onEdit}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" className={HIT} disabled={busy} aria-describedby={textId} onClick={onRemove}>
            {removing ? "Removing…" : "Remove"}
          </Button>
        </>
      }
    >
      <p id={textId} className="text-base text-pretty text-ink">
        {fact.text}
      </p>
      {fact.sourceSpan ? <p className="text-sm text-faint">From your resume: “{fact.sourceSpan}”</p> : null}
    </Detail>
  );
}

function EditFact({ fact, saving, onSave, onCancel }: { fact: Fact; saving: boolean; onSave: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(fact.text);
  const ok = text.trim().length >= 3;
  const id = `edit-${fact.id}`;
  return (
    <form
      className="mt-1 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSave(text.trim());
      }}
    >
      <label htmlFor={id} className="sr-only">
        Edit this fact
      </label>
      <Textarea
        id={id}
        // The user asked to edit this fact, so the field takes focus.
        autoFocus
        value={text}
        maxLength={400}
        onChange={(e) => setText(e.currentTarget.value)}
        onKeyDown={(e) => (e.key === "Escape" ? onCancel() : undefined)}
        className="min-h-24"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" variant="secondary" className={HIT} disabled={!ok || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className={HIT} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** A fact the user types. They wrote it, so it is sent confirmed and tailored lines may cite it at once. */
function AddFact({ onDone }: { onDone: () => void }) {
  const { addFact } = useProfileActions();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = String(form.get("text")).trim();
    if (text.length < 3) return setError("Write the fact in at least 3 characters.");
    setError(null);
    addFact.mutate(
      { kind: String(form.get("kind")) as FactKind, text, confirmed: true },
      { onSuccess: onDone, onError: (err) => setError(err instanceof ApiError ? err.message : "Could not add the fact. Try again.") },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Kind" htmlFor="new-fact-kind">
        <Select id="new-fact-kind" name="kind" defaultValue="skill">
          {FACT_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND[k].label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Fact" htmlFor="new-fact-text" hint="Facts you type count as confirmed." error={error ?? undefined}>
        <Textarea id="new-fact-text" name="text" autoFocus maxLength={400} className="min-h-24" />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" variant="secondary" className={HIT} disabled={addFact.isPending}>
          {addFact.isPending ? "Adding…" : "Add fact"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className={HIT} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Same frame as the loaded grid: panel header, then six cells of icon, label and chip, two text lines and actions. */
export function FactListSkeleton() {
  return (
    <div aria-busy="true" className="glass-panel rounded-card">
      <span role="status" className="sr-only">
        Loading facts
      </span>
      <div aria-hidden className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-pill" />
      </div>
      <div aria-hidden className="@container">
        <div className={GRID}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 border-t border-line py-4">
              <Skeleton className="size-5 rounded-pill" />
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-24 rounded-pill" />
                </div>
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-9 w-44 rounded-pill" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="h-2" />
    </div>
  );
}
