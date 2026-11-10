"use client";

import { useRef } from "react";
import { employmentInputSchema, type EmploymentInput } from "@auto-career/shared";
import { useOnboarding, type Employment } from "@/hooks/use-onboarding";
import { AddButton, edit, Entry, focusSoon, newKey, SectionAlert, TextBox, TextField, useSection, type Errors, type SectionProps } from "./kit";

type Job = { key: string; id?: string; title: string; company: string; location: string; start: string; end: string; current: boolean; results: string };

const blank = (): Job => ({ key: newKey(), title: "", company: "", location: "", start: "", end: "", current: false, results: "" });
const empty = (j: Job) => !j.current && [j.title, j.company, j.location, j.start, j.end, j.results].every((v) => !v.trim());
const fromServer = (e: Employment): Job => ({
  key: e.id,
  id: e.id,
  title: e.title,
  company: e.company,
  location: e.location ?? "",
  start: e.startMonth ?? "",
  end: e.endMonth ?? "",
  current: e.isCurrent,
  results: e.results.map((r) => r.text).join("\n"),
});
const toInput = (j: Job): EmploymentInput => ({
  title: j.title.trim(),
  company: j.company.trim(),
  location: j.location.trim() || null,
  startMonth: j.start.trim() || null,
  endMonth: j.current ? null : j.end.trim() || null,
  isCurrent: j.current,
  results: j.results
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean),
});

const FIELDS = ["title", "company", "location", "startMonth", "endMonth", "results"] as const;
const ID: Record<(typeof FIELDS)[number], string> = { title: "title", company: "company", location: "location", startMonth: "start", endMonth: "end", results: "results" };
const MONTH = "Use a month like 2022-05.";
const MESSAGE: Record<(typeof FIELDS)[number], (custom: boolean, line?: number) => string> = {
  title: () => "Enter the job title.",
  company: () => "Enter the company.",
  location: () => "Keep the location under 120 characters.",
  startMonth: (custom) => (custom ? "The start is after the end." : MONTH),
  endMonth: () => MONTH,
  results: (_, line) => (line === undefined ? "Keep it to 20 results, one per line." : `Line ${line + 1}: write 3 to 400 characters.`),
};

/**
 * Spec 5.3b: one confirmed employment per job through /profile/employments, which writes its role fact and one metric
 * fact per results line. Never loose facts: the builder puts bullets under a job only through an employment.
 */
export function ExperienceSection({ bind }: SectionProps) {
  const { employments, addEmployment, updateEmployment, removeEmployment } = useOnboarding();
  const id = (j: Job, field: string) => `ob-job-${j.key}-${field}`;
  const add = useRef<HTMLDivElement>(null);

  const s = useSection<Job[]>({
    name: "experience",
    bind,
    initial: () => (employments.data?.length ? employments.data.map(fromServer) : [blank()]),
    validate: (jobs) => {
      const errors: Errors = {};
      for (const j of jobs) {
        if (empty(j)) continue;
        const issues = employmentInputSchema.safeParse(toInput(j)).error?.issues ?? [];
        for (const f of FIELDS) {
          const issue = issues.find((i) => i.path[0] === f);
          if (issue) errors[id(j, ID[f])] = MESSAGE[f](issue.code === "custom", typeof issue.path[1] === "number" ? issue.path[1] : undefined);
        }
      }
      return errors;
    },
    save: async (jobs, track) => {
      const server = employments.data ?? [];
      const kept = jobs.filter((j) => !empty(j));
      for (const e of server) if (!kept.some((j) => j.id === e.id)) await removeEmployment.mutateAsync(e.id);
      for (const j of kept) {
        const input = toInput(j);
        const was = server.find((e) => e.id === j.id);
        if (!was) {
          const made = await addEmployment.mutateAsync(input);
          track.value = edit(track.value, j.key, { id: made.id });
        } else if (JSON.stringify(input) !== JSON.stringify(toInput(fromServer(was)))) {
          await updateEmployment.mutateAsync({ id: was.id, ...input });
        }
      }
    },
  });

  const change = (j: Job, patch: Partial<Job>) => s.set(edit(s.value, j.key, patch));
  return (
    <>
      {s.value.map((j, i) => (
        <Entry
          key={j.key}
          legend={`Job ${i + 1}`}
          onRemove={() => {
            s.set(s.value.filter((x) => x.key !== j.key));
            add.current?.querySelector("button")?.focus();
          }}
        >
          <TextField {...s.field(id(j, "title"))} label="Job title" autoComplete="organization-title" maxLength={200} aria-required value={j.title} onChange={(title) => change(j, { title })} />
          <TextField {...s.field(id(j, "company"))} label="Company" autoComplete="organization" maxLength={200} aria-required value={j.company} onChange={(company) => change(j, { company })} />
          <TextField {...s.field(id(j, "location"))} wide label="Location (optional)" autoComplete="off" maxLength={120} placeholder="City, or Remote" value={j.location} onChange={(location) => change(j, { location })} />
          <TextField {...s.field(id(j, "start"))} label="Start month" type="month" placeholder="2022-05" value={j.start} onChange={(start) => change(j, { start })} />
          <TextField
            {...s.field(id(j, "end"))}
            label="End month"
            type="month"
            placeholder="2024-01"
            disabled={j.current}
            value={j.current ? "" : j.end}
            onChange={(end) => change(j, { end })}
          />
          <label className="ob-check ob-wide">
            <input type="checkbox" checked={j.current} onChange={(e) => change(j, { current: e.target.checked, end: "" })} />I work here now
          </label>
          <TextBox
            {...s.field(id(j, "results"))}
            label="What you did, one result per line"
            hint="Each line becomes a bullet. Numbers help, for example Cut page load time from 3 s to 1 s."
            rows={4}
            value={j.results}
            onChange={(results) => change(j, { results })}
          />
        </Entry>
      ))}
      <div ref={add}>
        <AddButton
          onClick={() => {
            const next = blank();
            s.set([...s.value, next]);
            focusSoon(id(next, "title"));
          }}
        >
          {s.value.length ? "Add another job" : "Add a job"}
        </AddButton>
      </div>
      <SectionAlert message={s.alert} />
    </>
  );
}
