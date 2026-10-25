import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPost, posts } from "@/lib/blog";
import { siteConfig } from "@/lib/site";
import { formatDate } from "@/lib/utils";
import "@/components/blog/blog.css";

// Editorial pages: the whole route is static output. Every slug comes from generateStaticParams, and the part that
// reads params sits inside Suspense, so the App Shell never waits on URL data (Next guide: keeping pages static).
export const ensureStatic = "navigation";

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = getPost((await props.params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.summary, publishedTime: post.date },
  };
}

export default function BlogPostPage(props: PageProps<"/blog/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Post params={props.params} />
    </Suspense>
  );
}

async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  if (!post) notFound();

  const i = posts.findIndex((p) => p.slug === post.slug);
  const newer = posts[i - 1];
  const older = posts[i + 1];

  // Static first-party data only; "<" is escaped so the JSON cannot close the script tag.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    mainEntityOfPage: `${siteConfig.url}/blog/${post.slug}`,
    author: { "@type": "Organization", name: siteConfig.company },
    publisher: { "@type": "Organization", name: siteConfig.name },
  }).replace(/</g, "\\u003c");

  return (
    <article className="post">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <div className="lp-wrap lp-wrap--copy">
        <Link href="/blog" className="lp-link post__back">
          Back to blog
        </Link>
        <div className="post__sheet glass-panel">
        <header className="post__head">
          <p className="lp-caption">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden="true"> · </span>
            {post.readingMinutes} min read
          </p>
          <h1 className="post__title" tabIndex={-1}>
            {post.title}
          </h1>
        </header>
        <div className="prose">
          {post.body.map((para) => (
            <p key={para.slice(0, 32)}>{para}</p>
          ))}
        </div>
        {newer || older ? (
          <nav aria-label="More posts" className="post__nav">
            {older ? (
              <Link href={`/blog/${older.slug}`} rel="prev">
                <span className="lp-micro">Older</span>
                <span className="post__nav-title">{older.title}</span>
              </Link>
            ) : null}
            {newer ? (
              <Link href={`/blog/${newer.slug}`} rel="next" className="post__nav-next">
                <span className="lp-micro">Newer</span>
                <span className="post__nav-title">{newer.title}</span>
              </Link>
            ) : null}
          </nav>
        ) : null}
        </div>
      </div>
    </article>
  );
}
