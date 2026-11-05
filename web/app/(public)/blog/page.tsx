import type { Metadata } from "next";
import { FeaturedPost, PostRow } from "@/components/blog/post-card";
import { Entry10Start } from "@/components/landing/entries/entry-10-start";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs/breadcrumbs";
import { NewsletterForm } from "@/components/marketing/newsletter/newsletter-form";
import { PageHero } from "@/components/marketing/page-hero";
import { marketingCopy } from "@/content/marketing-copy";
import { posts } from "@/lib/blog";

const { blog: copy, breadcrumbs } = marketingCopy;

export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
  const [latest, ...rest] = posts;
  return (
    <>
      <PageHero
        titleId="blog-title"
        crumbs={<Breadcrumbs items={[{ label: breadcrumbs.home, href: "/" }, { label: copy.meta.title }]} />}
        title={copy.hero.title}
        lead={copy.hero.lead}
        art={{ src: "/landing/art/step-2-truth-lock.png", alt: copy.hero.artAlt }}
      />
      <section aria-label={copy.listLabel} className="lp-wrap lp-wrap--main blog-list">
        <FeaturedPost post={latest} />
        <div className="blog-rows glass-panel">
          {rest.map((p) => (
            <PostRow key={p.slug} post={p} />
          ))}
        </div>
        <div className="blog-news">
          <NewsletterForm variant="card" source="blog-index" />
        </div>
      </section>
      <Entry10Start />
    </>
  );
}
