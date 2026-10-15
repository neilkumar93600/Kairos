export interface Post {
  slug: string;
  title: string;
  summary: string;
  date: string;
  readingMinutes: number;
  body: string[];
}

/** Launch posts. Move to MDX or a CMS once there are more than a handful. */
export const posts: Post[] = [
  {
    slug: "why-we-cap-applications-per-company",
    title: "Why we cap applications per company",
    summary: "Sending five applications to one employer in a week reads as spam to the recruiter. So by default we send two per 30 days.",
    date: "2026-10-13",
    readingMinutes: 3,
    body: [
      "Most auto-apply tools count success in applications sent. Recruiters count it differently: they see the same name arrive for four roles in one week and stop reading.",
      "Kairos sends at most two applications to the same company in 30 days by default. You can raise it to five in Preferences if a company is hiring for several roles you genuinely fit.",
      "The cap works with the fit gate. Matches below your threshold never reach your queue, so the two slots go to the roles where you are strongest.",
    ],
  },
  {
    slug: "how-the-truth-lock-works",
    title: "How the truth lock works",
    summary: "Every tailored resume line has to point to a fact you confirmed. Lines that cite nothing are dropped before you see them.",
    date: "2026-10-13",
    readingMinutes: 4,
    body: [
      "When you upload a resume, we split it into facts: roles, projects, skills and numbers. You confirm each one during onboarding.",
      "When we tailor a resume for a job, the model must cite the facts each line uses. A line that cites a fact you do not have, or no fact at all, is removed before the draft reaches your queue.",
      "You can still edit any line yourself. Your edits go through the same check, so a tired late-night edit cannot slip in a skill you have never used.",
    ],
  },
];

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}
