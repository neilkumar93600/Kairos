import { postDrafts, type PostDraft } from "@/content/blog-posts";

export type { PostSection } from "@/content/blog-posts";

export interface Post extends PostDraft {
  readingMinutes: number;
}

/** Reading time at about 220 words a minute, never less than one. Counts paragraphs and lists; headings are skimmed. */
function readingMinutes(post: PostDraft): number {
  const text = post.sections.flatMap((s) => [...s.body, ...(s.list ?? [])]).join(" ");
  return Math.max(1, Math.round(text.trim().split(/\s+/).length / 220));
}

/** Newest first, as written in content/blog-posts.ts. */
export const posts: Post[] = postDrafts.map((p) => ({ ...p, readingMinutes: readingMinutes(p) }));

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}
