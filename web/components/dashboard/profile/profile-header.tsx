"use client";

import Image from "next/image";
import { EnvelopeSimple, PencilSimple } from "@phosphor-icons/react";
import { useApplications } from "@/hooks/use-applications";
import { useMe } from "@/hooks/use-me";
import { useFacts } from "@/hooks/use-profile";
import { ButtonLink } from "../../shared/button";
import { ErrorNote } from "../../shared/error-note";
import { Skeleton } from "../../shared/skeleton";
import { HIT } from "./fact-list";

/** GET /api/applications returns at most 200 rows, so a full page reads "200+" rather than a false exact count. */
const LIST_CAP = 200;

/** App page title, --t-h3 (as PageTitle). */
const TITLE = "font-display text-[26px] leading-[1.2] tracking-[-0.025em] text-balance text-ink md:text-[28px] lg:text-[30px] xl:text-[32px]";

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * Profile header (DESIGN.md Reference layer, "Profile header"): the app's one art panel, a Scene A crop that dissolves
 * into the panel; an 88px initials disc over its lower edge; name, email and one quiet Edit (contact details live on the
 * resume and are written back to the profile on save). Then real counts only. There is no list endpoint for resume
 * profiles, so the resumes stat is left out rather than guessed.
 */
export function ProfileHeader() {
  const me = useMe();
  const facts = useFacts();
  const sent = useApplications("submitted");
  const user = me.data?.user;
  const name = user ? user.name.trim() || user.email : null;
  const countsError = facts.error ?? sent.error;

  const confirmed = facts.data?.filter((f) => f.confirmed).length;
  const stats = [
    { label: "Facts confirmed", value: confirmed },
    { label: "Facts waiting", value: facts.data && confirmed !== undefined ? facts.data.length - confirmed : undefined },
    { label: "Applications sent", value: sent.data ? (sent.data.length >= LIST_CAP ? `${LIST_CAP}+` : sent.data.length) : undefined },
  ];

  return (
    <section aria-labelledby="profile-title" className="glass-panel overflow-hidden rounded-card">
      {/* Art layer: the placeholder gradient uses the painting's own hues until the file decodes. */}
      <div
        className="relative h-30 mask-[linear-gradient(to_bottom,#000_45%,transparent)] md:h-42"
        style={{ background: "linear-gradient(180deg, var(--art-sky), var(--art-haze) 60%, var(--art-ridge))" }}
      >
        <Image
          src="/landing/art/scene-a-dawn-valley.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1440px) 1100px, (min-width: 1024px) calc(100vw - 340px), 100vw"
          className="object-cover object-[50%_56%]"
        />
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 px-6 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div
          aria-hidden
          className="relative col-start-1 row-start-1 -mt-11 flex size-22 items-center justify-center rounded-pill bg-surface text-[32px] font-medium tracking-[-0.02em] text-ink shadow-edge ring-4 ring-canvas"
        >
          {name ? initials(name) : me.error ? null : <Skeleton className="size-full rounded-pill" />}
        </div>

        <ButtonLink
          href="/resume"
          variant="ghost"
          size="sm"
          title="Contact details live on your resume"
          className={`${HIT} col-start-2 row-start-1 mt-3 justify-self-end sm:col-start-3`}
        >
          <PencilSimple size={16} weight="light" aria-hidden />
          Edit<span className="sr-only"> contact details on your resume</span>
        </ButtonLink>

        <div className="col-span-2 row-start-2 mt-3 flex min-w-0 flex-col gap-1 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:mt-4">
          {me.error ? (
            <>
              <h1 id="profile-title" className={TITLE}>
                Profile
              </h1>
              <div className="mt-2">
                <ErrorNote error={me.error} onRetry={() => me.refetch()} />
              </div>
            </>
          ) : user ? (
            <>
              <h1 id="profile-title" className={TITLE}>
                {name}
              </h1>
              <p className="flex items-center gap-2 text-sm text-body">
                <EnvelopeSimple size={16} weight="light" aria-hidden className="shrink-0 text-icon" />
                <span className="min-w-0 wrap-anywhere">{user.email}</span>
              </p>
            </>
          ) : (
            <>
              <h1 id="profile-title" className="sr-only">
                Profile
              </h1>
              <Skeleton className="h-8 w-56 max-w-full" />
              <Skeleton className="h-4 w-44 max-w-full" />
            </>
          )}
        </div>
      </div>

      <div className="px-6 pt-6 pb-6">
        {countsError ? (
          <ErrorNote
            error={countsError}
            onRetry={() => {
              void facts.refetch();
              void sent.refetch();
            }}
          />
        ) : (
          <dl className="grid grid-cols-3 border-t border-line pt-5">
            {stats.map((s) => (
              <div key={s.label} className="flex min-w-0 flex-col-reverse justify-end gap-1.5 border-l border-line px-3 first:border-l-0 first:pl-0 sm:px-6">
                <dt className="text-sm text-faint">{s.label}</dt>
                <dd className="text-[32px] leading-none tracking-[-0.03em] text-ink tabular-nums md:text-[40px] md:font-light">
                  {s.value ?? <Skeleton className="h-8 w-12 md:h-10" />}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
