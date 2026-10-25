import type { Metadata } from "next";
import { FeaturedPost, PostRow } from "@/components/blog/post-card";
import { Entry10Start } from "@/components/landing/entries/entry-10-start";
import { PageHero } from "@/components/marketing/page-hero";
import { posts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description: "How Kairos works, and what we learn about applying to jobs well.",
  alternates: { canonical: "/blog" },
};

// Newest first; ties keep the order in lib/blog.ts.
const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));

export default function BlogPage() {
  const [latest, ...rest] = sorted;
  return (
    <>
      <PageHero
        titleId="blog-title"
        title="Notes on applying well"
        lead="How Kairos decides, drafts and sends, written plainly."
        art={{ src: "/landing/art/step-2-truth-lock.png", alt: "A writing desk by a window, a single sheet laid out on it." }}
      />
      <section aria-label="All posts" className="lp-wrap lp-wrap--main blog-list">
        {latest ? <FeaturedPost post={latest} /> : null}
        {rest.length ? (
          <div className="blog-rows glass-panel">
            {rest.map((p) => (
              <PostRow key={p.slug} post={p} />
            ))}
          </div>
        ) : null}
      </section>
      <Entry10Start />
    </>
  );
}
