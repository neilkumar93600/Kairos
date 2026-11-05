import Link from "next/link";
import { marketingCopy } from "@/content/marketing-copy";
import { posts, type Post } from "@/lib/blog";
import { formatDate } from "@/lib/utils";
import { InlineCta } from "../cta/cta";
import { NewsletterForm } from "../newsletter/newsletter-form";
import "./blog-sidebar.css";

const { blogSidebar: copy, newsletter, blog } = marketingCopy;

/**
 * The blog post's aside (design direction 3.8): recent posts on the landing's rail and pins, the compact newsletter, one
 * quiet link to sign-up. Sticky from 1024 where it fits; below the article on phones, without the link (the dark band follows).
 * The post page owns the grid. Moving sticky glass re-blurs every frame, so nothing here animates.
 */
export function BlogSidebar({ current }: { current?: Post }) {
  const recent = posts.filter((p) => p.slug !== current?.slug).slice(0, 3);
  return (
    <aside aria-label={copy.label} className="bs glass-panel">
      {recent.length > 0 ? (
        <section className="bs-block">
          <h2 className="bs-h">{copy.recent}</h2>
          <ul className="bs-list">
            {recent.map((p) => (
              <li key={p.slug} className="bs-row">
                <span aria-hidden="true" className="lp-pin bs-pin" />
                <Link href={`/blog/${p.slug}`} className="bs-link">
                  {p.title}
                </Link>
                <p className="lp-caption">
                  <time dateTime={p.date}>{formatDate(p.date)}</time> · {blog.minRead.replace("{n}", String(p.readingMinutes))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="bs-block">
        <h2 className="bs-h">{newsletter.compact.heading}</h2>
        <p className="lp-body-sm bs-lead">{newsletter.compact.body}</p>
        <NewsletterForm variant="compact" source={current ? "blog-post" : "blog-index"} />
      </section>
      <section className="bs-block bs-block--cta">
        <h2 className="bs-h">{copy.cta.heading}</h2>
        <p className="bs-note">{copy.cta.body}</p>
        <InlineCta {...copy.cta.primary} />
      </section>
    </aside>
  );
}
