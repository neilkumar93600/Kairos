"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { FactList } from "@/components/dashboard/profile/fact-list";
import { useOnboarding, usePollImport } from "@/hooks/use-onboarding";
import { ApiError } from "@/lib/api";
import { nextAction } from "@/lib/onboarding/flow";
import { phaseLabel } from "@/lib/onboarding/upload-phase";
import { cn } from "@/lib/utils";
import { useWizard, type StepProps } from "../wizard";

const KEY = "kairos.onboarding.importId";
const MAX_BYTES = 5 * 1024 * 1024; // the server's IMPORT_MAX_BYTES
const TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const ACCEPT = [".pdf", ".docx", ...TYPES].join(",");

/** The import being read sits in sessionStorage so a reload resumes it. Storage can throw (blocked, private mode); then a reload starts over. */
export function storedImport(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function storeImport(id: string | null) {
  try {
    if (id) sessionStorage.setItem(KEY, id);
    else sessionStorage.removeItem(KEY);
  } catch {
    // no storage: nothing to resume after a reload
  }
}

export const failureOf = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/**
 * Shared by upload and paste. Polls the import, puts its progress in words, and once it is parsed reports ready and
 * makes Continue build the base resume from it. A base made earlier in this run is reused (Back, then Continue again).
 */
export function useImportCheck(importId: string | null, onReady: StepProps["onReady"]) {
  const { state, setBaseResumeId, onNext } = useWizard();
  const { createBase } = useOnboarding();
  const qc = useQueryClient();
  const poll = usePollImport(importId);
  const data = importId ? poll.data : undefined;
  const parsed = data?.parseStatus === "parsed";
  // Back from a later step: the stored import was cleared when the base resume was made.
  const saved = !importId && state.baseResumeId !== null;
  const failed =
    data?.parseStatus === "failed"
      ? data.failureCode === "no_text_layer"
        ? "This PDF is a scanned image. Paste the text instead."
        : "Kairos could not read this resume. Try another file or paste the text."
      : importId && poll.error
        ? "Kairos could not check on this resume. Try again or paste the text."
        : null;

  useEffect(() => {
    onReady(parsed || saved);
  }, [parsed, saved, onReady]);

  // The fact list reads /profile/facts, which holds the new facts only once the parse is done.
  useEffect(() => {
    if (parsed) void qc.invalidateQueries({ queryKey: ["facts"] });
  }, [parsed, qc]);

  // Re-registered every render so Continue always sees the current targets and base resume.
  useEffect(() => {
    if (!parsed || !importId) return;
    onNext(async () => {
      if (nextAction(state) === "create") {
        const name = data?.fileName?.replace(/\.[^.]+$/, "").trim().slice(0, 80) || "Main resume";
        const { id } = await createBase.mutateAsync({ name, targetRoles: state.targetRoles, importId });
        setBaseResumeId(id);
      }
      storeImport(null); // a base resume exists now, so a later visit must not reopen this import
    });
    return () => onNext(null);
  });

  const n = data?.facts.length ?? 0;
  // dataUpdatedAt changes on every poll, even when the body does not, so reading it re-renders the slow note in time.
  const polls = poll.dataUpdatedAt ? (qc.getQueryState(["import", importId])?.dataUpdateCount ?? 0) : 0;
  const phase = saved
    ? "Your resume is saved. Check its facts below."
    : parsed
      ? n
        ? `${n} ${n === 1 ? "fact" : "facts"} found. Check each one.`
        : "No facts found. Add them below or paste the text instead."
      : phaseLabel(data?.progressText ?? null, polls);
  return { showing: saved || (!!importId && !failed), done: parsed || saved, failed, phase, fileName: data?.fileName ?? null };
}

/** Progress in words, then the found facts with Confirm, Edit and Remove. */
export function Reading({ phase, done, line }: { phase: string; done: boolean; line?: string | null }) {
  return (
    <>
      <div className="ob-reading">
        <p className="ob-phase" role="status">
          <span aria-hidden className={cn("ob-dot", !done && "ob-dot--live")} />
          {phase}
        </p>
        {line ? <p className="ob-reading__line">{line}</p> : null}
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
  const [importId, setImportId] = useState(storedImport);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const check = useImportCheck(importId, onReady);

  const send = (f: File | undefined) => {
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name) && !TYPES.includes(f.type)) return setError("Upload a PDF or DOCX, or paste the text.");
    if (f.size > MAX_BYTES) return setError("This file is over 5 MB. Upload a smaller one or paste the text.");
    setError(null);
    setFile({ name: f.name, size: f.size });
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

  const message = error ?? check.failed;
  return (
    <>
      <h1 tabIndex={-1} className="ob-h1">
        Upload your resume
      </h1>
      <p className="ob-sub">A LinkedIn “Save to PDF” works too. Scanned images do not; paste the text for those.</p>
      {startImport.isPending || check.showing ? (
        <Reading phase={startImport.isPending ? "Uploading your file" : check.phase} done={check.done} line={file ? `${file.name}, ${kb(file.size)}` : check.fileName} />
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
            <div className="ob-note">
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
