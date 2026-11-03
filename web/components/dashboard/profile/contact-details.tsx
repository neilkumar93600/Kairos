"use client";

import { LinkSimple, MapPin, Phone, type Icon } from "@phosphor-icons/react";
import { useProfile } from "@/hooks/use-profile";
import { ErrorNote } from "../../shared/error-note";
import { Panel } from "../../shared/panel";
import { Skeleton } from "../../shared/skeleton";
import { Detail, GRID } from "./fact-list";

const TITLE = "Contact";
const BODY = "Application forms are filled from these. Change them in your resume's contact section.";

/** Only http(s) values become links; anything else stays text. */
const isWeb = (v: string) => /^https?:\/\//i.test(v);
const pretty = (v: string) => v.replace(/^https?:\/\//i, "").replace(/\/$/, "");

/**
 * Contact fields as details-grid cells. They have no confirmed flag (the user typed them on the resume), so they carry
 * no truth chip; an empty one says so instead of hiding.
 */
export function ContactDetails() {
  const { data, error, refetch } = useProfile();
  if (error)
    return (
      <Panel title={TITLE} description={BODY}>
        <ErrorNote error={error} onRetry={() => refetch()} />
      </Panel>
    );

  const rows: { icon: Icon; label: string; value: string | null | undefined; link?: boolean }[] = [
    { icon: Phone, label: "Phone", value: data?.phone },
    { icon: MapPin, label: "Location", value: data ? [data.city, data.country].filter(Boolean).join(", ") || null : undefined },
    { icon: LinkSimple, label: "LinkedIn", value: data?.linkedinUrl, link: true },
    { icon: LinkSimple, label: "GitHub", value: data?.githubUrl, link: true },
    { icon: LinkSimple, label: "Portfolio", value: data?.portfolioUrl, link: true },
  ];

  return (
    <Panel flush title={TITLE} description={BODY} aria-busy={data ? undefined : true}>
      {data ? null : (
        <span role="status" className="sr-only">
          Loading contact details
        </span>
      )}
      <div className="@container">
        <ul className={GRID}>
          {rows.map((r) => (
            <Detail key={r.label} icon={r.icon} label={r.label}>
              {!data ? (
                <Skeleton className="mt-1 h-5 w-40 max-w-full" />
              ) : !r.value ? (
                <p className="text-base text-faint">Not added</p>
              ) : r.link && isWeb(r.value) ? (
                <a
                  href={r.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative self-start text-base text-ink underline decoration-1 underline-offset-3 wrap-anywhere after:absolute after:inset-x-0 after:-inset-y-3 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink"
                >
                  {pretty(r.value)}
                </a>
              ) : (
                <p className="text-base text-ink wrap-anywhere">{r.value}</p>
              )}
            </Detail>
          ))}
        </ul>
      </div>
      <div className="h-2" />
    </Panel>
  );
}
