"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/shared/button";
import { ErrorNote } from "@/components/shared/error-note";
import { Field, Select } from "@/components/shared/field";
import { ListSkeleton } from "@/components/shared/skeleton";
import type { Me } from "@/hooks/use-me";
import { useMe } from "@/hooks/use-me";
import { useOnboarding, type Employment } from "@/hooks/use-onboarding";
import { useProfile, type Fact } from "@/hooks/use-profile";
import { nextAction } from "@/lib/onboarding/flow";
import { draftKey } from "@/lib/onboarding/form-facts";
import { basis, forgetPendingBase, keepPendingBase, pendingBase, readSession, writeSession } from "@/lib/onboarding/session";
import { CertificationsSection } from "../form/certifications";
import { ContactSection } from "../form/contact";
import { DetailsSection } from "../form/details";
import { EducationSection } from "../form/education";
import { ExperienceSection } from "../form/experience";
import { readRecord, type SectionProps } from "../form/kit";
import { LanguagesSection } from "../form/languages";
import { LinksSection } from "../form/links";
import { ProjectsSection } from "../form/projects";
import { SkillsSection } from "../form/skills";
import { WorkAuthSection } from "../form/work-auth";
import { StepError, useWizard, type StepProps } from "../wizard";

// Spec 5.3b's table order (no Headline: a resume headline must cite confirmed facts, and none holds a typed one).
const SECTIONS: Array<{ id: string; title: string; Body: ComponentType<SectionProps> }> = [
  { id: "contact", title: "Contact", Body: ContactSection },
  { id: "links", title: "Links", Body: LinksSection },
  { id: "work-auth", title: "Work authorization", Body: WorkAuthSection },
  { id: "experience", title: "Experience", Body: ExperienceSection },
  { id: "education", title: "Education", Body: EducationSection },
  { id: "skills", title: "Skills", Body: SkillsSection },
  { id: "projects", title: "Projects", Body: ProjectsSection },
  { id: "certifications", title: "Certifications", Body: CertificationsSection },
  { id: "languages", title: "Languages", Body: LanguagesSection },
  { id: "details", title: "Application details", Body: DetailsSection },
];

const AT = draftKey("section"); // the section on screen, so a reload reopens it
/** A reload while the form is open reopens the form (the server step alone would reopen the source step). */
export const formInProgress = () => readSession(AT) !== null;

/**
 * Spec 5.3b: one section at a time, a rail beside it on desktop and a select above it on phones. A section saves when
 * the user leaves it (rail, select, Next section, Continue). Continue then needs a full name and one job or school,
 * and makes the base resume from the confirmed facts.
 */
export function FormStep({ onReady }: StepProps) {
  const { state, onNext, setBaseResumeId } = useWizard();
  const me = useMe();
  const profile = useProfile();
  const { employments, createBase } = useOnboarding();
  const qc = useQueryClient();
  const [at, setAt] = useState(() => SECTIONS.find((s) => s.id === readSession(AT))?.id ?? "contact");
  const [busy, setBusy] = useState(false);
  const saver = useRef<(() => Promise<boolean>) | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const loaded = !!(me.data && profile.data && employments.data);
  const index = SECTIONS.findIndex((s) => s.id === at);
  const { title, Body } = SECTIONS[index];
  const next = SECTIONS[index + 1];

  useEffect(() => {
    onReady(loaded);
  }, [loaded, onReady]);

  useEffect(() => {
    writeSession(AT, at);
    if (moved.current) heading.current?.focus();
  }, [at]);
  // Leaving the step (Back, or Continue done) is not a reload: the source step opens next time.
  useEffect(() => () => writeSession(AT, null), []);

  const save = async () => (await saver.current?.()) ?? true;
  const go = async (to: string) => {
    if (busy || to === at) return;
    setBusy(true);
    try {
      if (await save()) {
        moved.current = true;
        setAt(to);
      }
    } finally {
      setBusy(false);
    }
  };

  // Re-registered every render so Continue sees the current section, targets and base resume.
  useEffect(() => {
    onNext(async () => {
      if (!(await save())) throw new StepError("Fix this section before you continue.");
      if (!qc.getQueryData<Me>(["me"])?.user.name.trim()) {
        moved.current = true;
        setAt("contact");
        throw new StepError("Add your full name before you continue.");
      }
      const jobs = qc.getQueryData<Employment[]>(["employments"])?.length ?? 0;
      const schools =
        (readRecord("education")?.facts.length ?? 0) + (qc.getQueryData<Fact[]>(["facts"])?.filter((f) => f.kind === "education" && f.confirmed).length ?? 0);
      if (!jobs && !schools) {
        moved.current = true;
        setAt("experience");
        throw new StepError("Add at least one job or school before you continue.");
      }
      if (nextAction(state) === "create") {
        const from = basis("form", state.targetRoles);
        const { id } = await createBase.mutateAsync({
          name: "Main resume",
          targetRoles: state.targetRoles,
          resumeId: pendingBase(from),
          onCreated: (resumeId) => keepPendingBase(resumeId, from),
        });
        setBaseResumeId(id);
      }
      forgetPendingBase();
    });
    return () => onNext(null);
  });

  const error = me.error ?? profile.error ?? employments.error;
  return (
    <>
      <h1 tabIndex={-1} className="ob-h1">
        Fill in your resume
      </h1>
      <p className="ob-sub">Kept as you type and saved when you move to another section. Only your name and one job or school are required.</p>
      {!loaded ? (
        error ? (
          <ErrorNote
            error={error}
            onRetry={() => {
              void me.refetch();
              void profile.refetch();
              void employments.refetch();
            }}
          />
        ) : (
          <ListSkeleton rows={4} />
        )
      ) : (
        <div className="ob-form">
          <nav className="ob-rail" aria-label="Form sections">
            <ol>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <button type="button" aria-current={s.id === at ? "step" : undefined} onClick={() => void go(s.id)}>
                    {s.title}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <div className="ob-pick">
            <Field label="Section" htmlFor="ob-section" hint={`${index + 1} of ${SECTIONS.length}`}>
              <Select id="ob-section" value={at} onChange={(e) => void go(e.target.value)}>
                {SECTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <section className="ob-section" aria-labelledby="ob-section-title" inert={busy}>
            <h2 ref={heading} id="ob-section-title" tabIndex={-1} className="ob-h2">
              {title}
            </h2>
            <Body key={at} bind={(fn) => (saver.current = fn)} />
            {next ? (
              <Button variant="secondary" className="ob-next-section h-12 px-6 text-base" disabled={busy} onClick={() => void go(next.id)}>
                Next section
                <ArrowRight size={18} aria-hidden />
              </Button>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}
