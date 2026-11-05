import { postDrafts, type PostDraft } from "@/content/blog-posts";

export type { PostSection } from "@/content/blog-posts";

export interface Post extends PostDraft {
  readingMinutes: number;
  /** Written once on the server in UTC, so a post never reads a day early and a client list cannot mismatch on hydration. */
  dateLabel: string;
}

/** What a card needs: no article text, so the index's client list does not carry six articles. */
export type PostSummary = Omit<Post, "sections" | "pull">;

/** Reading time at about 220 words a minute, never less than one. Counts paragraphs and lists; headings are skimmed. */
function readingMinutes(post: PostDraft): number {
  const text = post.sections.flatMap((s) => [...s.body, ...(s.list ?? [])]).join(" ");
  return Math.max(1, Math.round(text.trim().split(/\s+/).length / 220));
}

function dateLabel(date: string): string {
  return new Date(date).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Newest first, as written in content/blog-meta.ts. */
export const posts: Post[] = postDrafts.map((p) => ({ ...p, readingMinutes: readingMinutes(p), dateLabel: dateLabel(p.date) }));

export const postSummaries: PostSummary[] = posts.map(({ slug, title, summary, date, category, image, readingMinutes, dateLabel }) => ({
  slug,
  title,
  summary,
  date,
  category,
  image,
  readingMinutes,
  dateLabel,
}));

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

/** Two others, same category first, then newest. */
export function relatedPosts(post: Post): PostSummary[] {
  const others = postSummaries.filter((p) => p.slug !== post.slug);
  return [...others.filter((p) => p.category === post.category), ...others.filter((p) => p.category !== post.category)].slice(0, 2);
}
