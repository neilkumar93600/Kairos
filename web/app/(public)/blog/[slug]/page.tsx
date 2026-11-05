import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PostMeta } from "@/components/blog/post-card";
import { BlogSidebar } from "@/components/marketing/blog-sidebar/blog-sidebar";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs/breadcrumbs";
import { CtaBand, InlineCta } from "@/components/marketing/cta/cta";
import { marketingCopy } from "@/content/marketing-copy";
import { getPost, posts, type PostSection } from "@/lib/blog";
import { siteConfig } from "@/lib/site";
import "@/components/blog/blog.css";

const { blog: copy, breadcrumbs, cta } = marketingCopy;

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
    // Setting openGraph here replaces the root layout's whole object, so the share image has to be named again.
    openGraph: { type: "article", title: post.title, description: post.summary, publishedTime: post.date, images: [{ url: "/landing/og-kairos.png", width: 1200, height: 630, alt: post.title }] },
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
      {/* Outside the glass sheet: a backdrop-filter ancestor would trap position: fixed. */}
      <div aria-hidden="true" className="post__progress" />
      <div className="lp-wrap post__wrap">
        <Breadcrumbs items={[{ label: breadcrumbs.home, href: "/" }, { label: copy.meta.title, href: "/blog" }, { label: post.title }]} />
        <div className="post__grid">
          <div className="post__sheet glass-panel">
            <header className="post__head">
              <PostMeta post={post} />
              <h1 className="post__title" tabIndex={-1}>
                {post.title}
              </h1>
            </header>
            <div className="prose">
              {post.sections.map((section, s) => (
                <SectionBody key={s} {...section} />
              ))}
            </div>
            <p className="post__more">
              <InlineCta {...cta.blogPostEnd} />
            </p>
            {newer || older ? (
              <nav aria-label={copy.postNav.label} className="post__nav">
                {older ? (
                  <Link href={`/blog/${older.slug}`} rel="prev">
                    <span className="lp-micro">{copy.postNav.older}</span>
                    <span className="post__nav-title">{older.title}</span>
                  </Link>
                ) : null}
                {newer ? (
                  <Link href={`/blog/${newer.slug}`} rel="next" className="post__nav-next">
                    <span className="lp-micro">{copy.postNav.newer}</span>
                    <span className="post__nav-title">{newer.title}</span>
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </div>
          <BlogSidebar current={post} />
        </div>
      </div>
      {/* D8: the one dark band, blog posts only. No secondary: InlineCta above already goes to How it works. */}
      <CtaBand variant="dark" heading={cta.newsletterConfirmed.heading} body={cta.newsletterConfirmed.body} primary={cta.newsletterConfirmed.primary} />
    </article>
  );
}

/** Fragments, so headings, paragraphs and lists are direct children of .prose and share its spacing. Static text: index keys are stable. */
function SectionBody({ heading, body, list }: PostSection) {
  return (
    <>
      {heading ? <h2>{heading}</h2> : null}
      {body.map((para, p) => (
        <p key={p}>{para}</p>
      ))}
      {list ? (
        <ul>
          {list.map((item, l) => (
            <li key={l}>{item}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
