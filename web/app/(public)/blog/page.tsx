import type { Metadata } from "next";
import { PostArchive } from "@/components/blog/post-archive";
import { CoverPost, LatestRow } from "@/components/blog/post-card";
import { Entry10Start } from "@/components/landing/entries/entry-10-start";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs/breadcrumbs";
import { NewsletterForm } from "@/components/marketing/newsletter/newsletter-form";
import { marketingCopy } from "@/content/marketing-copy";
import { postSummaries } from "@/lib/blog";

const { blog: copy, breadcrumbs } = marketingCopy;

export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
  const [cover, ...rest] = postSummaries;
  return (
    <div className="blog-page">
      <header className="lp-wrap lp-wrap--main blog-head">
        <Breadcrumbs items={[{ label: breadcrumbs.home, href: "/" }, { label: copy.meta.title }]} />
        <div className="blog-head__row">
          <h1 className="blog-head__title" tabIndex={-1}>
            {copy.hero.title}
          </h1>
          <p className="lp-lead blog-head__lead">{copy.hero.lead}</p>
        </div>
      </header>
      <div className="lp-wrap lp-wrap--main blog-top">
        <CoverPost post={cover} />
        <section aria-labelledby="blog-latest" className="blog-latest">
          <h2 id="blog-latest" className="lp-h3">
            {copy.latest}
          </h2>
          <ul className="blog-latest__list">
            {rest.slice(0, 4).map((post) => (
              <LatestRow key={post.slug} post={post} />
            ))}
          </ul>
        </section>
      </div>
      <PostArchive posts={postSummaries} />
      <div className="lp-wrap lp-wrap--main blog-news">
        <NewsletterForm variant="card" source="blog-index" />
      </div>
      <Entry10Start />
    </div>
  );
}
