"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { FactList } from "@/components/dashboard/profile/fact-list";
import { useMe } from "@/hooks/use-me";
import { useOnboarding, usePollImport } from "@/hooks/use-onboarding";
import { useFacts } from "@/hooks/use-profile";
import { ApiError } from "@/lib/api";
import { nextAction } from "@/lib/onboarding/flow";
import { phaseLabel } from "@/lib/onboarding/upload-phase";
import { cn } from "@/lib/utils";
import { useWizard, type StepProps } from "../wizard";

const MAX_BYTES = 5 * 1024 * 1024; // the server's IMPORT_MAX_BYTES
const TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const ACCEPT = [".pdf", ".docx", ...TYPES].join(",");

// sessionStorage, so a reload or a retry picks up where it was. Storage can throw (blocked, private mode); then it starts over.
const IMPORT = "kairos.onboarding.importId"; // the import being read
const MADE = "kairos.onboarding.resumeId"; // { resumeId, from }: a base made whose /default failed; a retry from the same basis only repeats /default
function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // no storage: nothing to pick up after a reload
  }
}
export const storedImport = () => read(IMPORT);
export const storeImport = (id: string | null) => write(IMPORT, id);

// A pending base is reused only for what it was built from (the same import and target roles); anything else makes a new one.
const basis = (importId: string | null, roles: string[]) => JSON.stringify([importId, roles]);
function pendingBase(from: string): string | undefined {
  try {
    const p = JSON.parse(read(MADE) ?? "null") as { resumeId: string; from: string } | null;
    return p?.from === from ? p.resumeId : undefined;
  } catch {
    return undefined;
  }
}
/** A new import, another file, or a lost import: a base pending from before must not become the default. */
export const forgetPendingBase = () => write(MADE, null);

export const failureOf = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/**
 * Shared by upload and paste. Polls the import, puts its progress in words, and once it is parsed reports ready and
 * makes Continue build the base resume from it. A base made earlier in this run is reused (Back, then Continue again).
 * `earlier`: facts from a parse that finished before this visit (spec 7, `confirm-facts` in a new tab), checked here
 * with no import to poll; Continue then builds the base from the confirmed facts.
 */
export function useImportCheck(importId: string | null, onReady: StepProps["onReady"], earlier = false) {
  const { state, setBaseResumeId, onNext } = useWizard();
  const { createBase } = useOnboarding();
  const qc = useQueryClient();
  const poll = usePollImport(importId);
  // A stale or foreign id: polling stops (usePollImport), the id is forgotten and the drop zone comes back.
  const gone = !!importId && poll.error instanceof ApiError && poll.error.status === 404;
  const live = gone ? null : importId;
  const data = live ? poll.data : undefined;
  const parsed = data?.parseStatus === "parsed";
  // Back from a later step: the stored import was cleared when the base resume was made.
  const saved = !live && state.baseResumeId !== null;
  const old = !live && !saved && earlier;
  const failed =
    data?.parseStatus === "failed"
      ? data.failureCode === "no_text_layer"
        ? "This PDF is a scanned image. Paste the text instead."
        : "Kairos could not read this resume. Try another file or paste the text."
      : live && poll.error
        ? "Kairos could not check on this resume. Try again or paste the text."
        : gone && !saved && !old
          ? "Kairos could not find that upload. Choose the file again or paste the text."
          : null;

  useEffect(() => {
    if (!gone) return;
    storeImport(null);
    forgetPendingBase();
  }, [gone]);

  useEffect(() => {
    onReady(parsed || saved || old);
  }, [parsed, saved, old, onReady]);

  // The fact list reads /profile/facts, which holds the new facts only once the parse is done.
  useEffect(() => {
    if (parsed) void qc.invalidateQueries({ queryKey: ["facts"] });
  }, [parsed, qc]);

  // Re-registered every render so Continue always sees the current targets and base resume.
  useEffect(() => {
    if (!(parsed && live) && !old) return;
    onNext(async () => {
      if (nextAction(state) === "create") {
        const name = (old ? null : data?.fileName?.replace(/\.[^.]+$/, "").trim().slice(0, 80)) || "Main resume";
        const from = basis(live, state.targetRoles);
        const { id } = await createBase.mutateAsync({
          name,
          targetRoles: state.targetRoles,
          importId: live ?? undefined,
          resumeId: pendingBase(from),
          onCreated: (resumeId) => write(MADE, JSON.stringify({ resumeId, from })),
        });
        setBaseResumeId(id);
      }
      // A base resume exists now, so a later visit must not reopen this import or reuse that id.
      write(MADE, null);
      storeImport(null);
    });
    return () => onNext(null);
  });

  const n = data?.facts.length ?? 0;
  // dataUpdatedAt changes on every poll, even when the body does not, so reading it re-renders the slow note in time.
  const polls = poll.dataUpdatedAt ? (qc.getQueryState(["import", importId])?.dataUpdateCount ?? 0) : 0;
  const phase = saved
    ? "Your resume is saved. Check its facts below."
    : old
      ? "Kairos read your resume earlier. Check its facts below."
      : parsed
        ? n
          ? `${n} ${n === 1 ? "fact" : "facts"} found. Check each one.`
          : "No facts found. Add them below or paste the text instead."
        : phaseLabel(data?.progressText ?? null, polls);
  return { showing: saved || old || (!!live && !failed), done: parsed || saved || old, old, failed, phase, fileName: data?.fileName ?? null };
}

/** Progress in words, then the found facts with Confirm, Edit and Remove. */
export function Reading({ phase, done, line, action }: { phase: string; done: boolean; line?: string | null; action?: ReactNode }) {
  return (
    <>
      <div className="ob-reading">
        <p className="ob-phase" role="status">
          <span aria-hidden className={cn("ob-dot", !done && "ob-dot--live")} />
          {phase}
        </p>
        {line ? <p className="ob-reading__line">{line}</p> : null}
        {action}
      </div>
      {done ? (
        <div className="ob-facts">
          <FactList />
        </div>
      ) : null}
    </>
  );
}

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Spec 5.3a: drop or choose a PDF or DOCX (checked for size here first), watch it read, check the facts it found. */
export function UploadStep({ onReady }: StepProps) {
  const { switchTo } = useWizard();
  const { startImport } = useOnboarding();
  const me = useMe();
  const facts = useFacts();
  const [importId, setImportId] = useState(storedImport);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [another, setAnother] = useState(false); // "Upload a different file" over facts read earlier
  const input = useRef<HTMLInputElement>(null);
  const note = useRef<HTMLDivElement>(null);
  const earlier = !another && me.data?.onboardingStep === "confirm-facts" && !!facts.data?.length;
  const check = useImportCheck(importId, onReady, earlier);
  const message = error ?? check.failed;

  // The way out of an error must not sit under the sticky footer on a phone (.ob-note keeps a scroll margin for it).
  useEffect(() => {
    if (message) note.current?.scrollIntoView({ block: "nearest" });
  }, [message]);

  const send = (f: File | undefined) => {
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name) && !TYPES.includes(f.type)) return setError("Upload a PDF or DOCX, or paste the text.");
    if (f.size > MAX_BYTES) return setError("This file is over 5 MB. Upload a smaller one or paste the text.");
    setError(null);
    setFile({ name: f.name, size: f.size });
    forgetPendingBase();
    startImport.mutate(
      { file: f, name: f.name },
      {
        onSuccess: ({ importId: id }) => {
          storeImport(id);
          setImportId(id);
        },
        onError: (e) => setError(failureOf(e, "Could not upload the file. Check your connection and try again.")),
      },
    );
  };

  return (
    <>
      <h1 tabIndex={-1} className="ob-h1">
        Upload your resume
      </h1>
      <p className="ob-sub">A LinkedIn “Save to PDF” works too. Scanned images do not; paste the text for those.</p>
      {startImport.isPending || check.showing ? (
        <Reading
          phase={startImport.isPending ? "Uploading your file" : check.phase}
          done={check.done}
          line={file ? `${file.name}, ${kb(file.size)}` : check.fileName}
          action={
            check.old ? (
              <button
                type="button"
                className="ob-link"
                onClick={() => {
                  forgetPendingBase();
                  setAnother(true);
                }}
              >
                Upload a different file
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            hidden
            tabIndex={-1}
            onChange={(e) => {
              send(e.currentTarget.files?.[0]);
              e.currentTarget.value = ""; // choosing the same file again still fires
            }}
          />
          <button
            type="button"
            className="ob-drop"
            data-over={over || undefined}
            aria-describedby={message ? "ob-drop-error" : undefined}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              send(e.dataTransfer.files[0]);
            }}
          >
            <UploadSimple size={28} aria-hidden />
            <span className="ob-drop__title">Drop your file here or choose one</span>
            <span className="ob-drop__line">PDF or DOCX, up to 5 MB</span>
          </button>
          {message ? (
            <div ref={note} className="ob-note">
              <p id="ob-drop-error" role="alert" className="ob-note__text">
                <WarningCircle size={18} aria-hidden />
                {message}
              </p>
              <button
                type="button"
                className="ob-link"
                onClick={() => {
                  storeImport(null);
                  switchTo("paste");
                }}
              >
                Paste the text instead
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
