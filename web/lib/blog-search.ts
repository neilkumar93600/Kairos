/** Fields the blog search reads. Separate from lib/blog.ts, which imports the article text and must stay out of client code. */
export interface Searchable {
  title: string;
  summary: string;
  category: string;
}

/** Every word typed must appear somewhere in the title, summary or category, ignoring case. An empty query matches all. */
export function matchesPost(post: Searchable, query: string): boolean {
  const haystack = `${post.title} ${post.summary} ${post.category}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
