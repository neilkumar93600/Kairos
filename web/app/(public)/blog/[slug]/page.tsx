import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, Suspense } from "react";
import { PostCard, PostChip, PostMeta } from "@/components/blog/post-card";
import { ShareRow } from "@/components/blog/share-row";
import { BlogSidebar } from "@/components/marketing/blog-sidebar/blog-sidebar";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs/breadcrumbs";
import { CtaBand, InlineCta } from "@/components/marketing/cta/cta";
import { LogoMark } from "@/components/shared/logo";
import { marketingCopy } from "@/content/marketing-copy";
import { getPost, posts, relatedPosts, type PostSection } from "@/lib/blog";
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

  const url = `${siteConfig.url}/blog/${post.slug}`;

  // Static first-party data only; "<" is escaped so the JSON cannot close the script tag.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    image: `${siteConfig.url}${post.image.src}`,
    mainEntityOfPage: url,
    author: { "@type": "Organization", name: siteConfig.company },
    publisher: { "@type": "Organization", name: siteConfig.name },
  }).replace(/</g, "\\u003c");

  return (
    <div className="post-page">
      <article className="post">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <div aria-hidden="true" className="post__progress" />
        <header className="lp-wrap lp-wrap--main post__head">
          <Breadcrumbs items={[{ label: breadcrumbs.home, href: "/" }, { label: copy.meta.title, href: "/blog" }, { label: post.title }]} />
          <h1 className="post__title" tabIndex={-1}>
            {post.title}
          </h1>
          <div className="post__meta">
            <PostChip post={post} />
            <PostMeta post={post} />
          </div>
        </header>
        <div className="lp-wrap lp-wrap--main post__grid">
          {/* From 1200 only; below that the "Written by" box after the article links to /about instead. */}
          <aside aria-labelledby="post-about" className="post__about">
            <div className="post__about-inner">
              <h2 id="post-about" className="post__side-h">
                {copy.about.heading}
              </h2>
              <div className="post__about-art">
                <Image src="/landing/art/closing-dusk-door.png" alt="" fill sizes="216px" style={{ objectPosition: "50% 70%" }} />
              </div>
              <p className="lp-body-sm">{copy.about.body}</p>
              <InlineCta {...copy.about.link} />
            </div>
          </aside>
          <div className="post__main">
            <div className="post__hero">
              <Image
                src={post.image.src}
                alt={post.image.alt}
                fill
                preload
                sizes="(min-width: 1200px) 600px, (min-width: 900px) 62vw, 100vw"
                style={{ objectPosition: post.image.position }}
              />
            </div>
            <div className="prose">
              {post.sections.map((section, s) => (
                <Fragment key={s}>
                  <SectionBody {...section} />
                  {/* Repeats a sentence from the article, so a screen reader does not hear it twice. */}
                  {post.pull.after === s ? (
                    <p aria-hidden="true" className="post__pull">
                      {post.pull.text}
                    </p>
                  ) : null}
                </Fragment>
              ))}
            </div>
            <ShareRow url={url} title={post.title} />
            <div className="post-author">
              <span className="post-author__mark">
                <LogoMark className="h-8" />
              </span>
              <div>
                <p className="post-author__title">
                  <Link href={copy.author.link.href} className="blog-link">
                    {copy.author.title}
                  </Link>
                </p>
                <p className="lp-body-sm">{copy.author.body.replace("{company}", siteConfig.company)}</p>
              </div>
            </div>
            <section aria-labelledby="post-related" className="post-related">
              <h2 id="post-related" className="lp-h4">
                {copy.related}
              </h2>
              <div className="post-related__grid">
                {relatedPosts(post).map((p) => (
                  <PostCard key={p.slug} post={p} compact sizes="(min-width: 1200px) 290px, (min-width: 480px) 45vw, 100vw" />
                ))}
              </div>
            </section>
          </div>
          <div className="post__side">
            <BlogSidebar current={post} />
          </div>
        </div>
      </article>
      {/* D8: the one dark band, blog posts only. */}
      <CtaBand
        variant="dark"
        heading={cta.newsletterConfirmed.heading}
        body={cta.newsletterConfirmed.body}
        primary={cta.newsletterConfirmed.primary}
        secondary={cta.newsletterConfirmed.secondary}
      />
    </div>
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
