import Link from "next/link";
import { marketingCopy } from "@/content/marketing-copy";
import type { Post } from "@/lib/blog";
import { formatDate } from "@/lib/utils";
import "./blog.css";

/** Date and reading time. Also used on the post page. */
export function PostMeta({ post }: { post: Post }) {
  return (
    <p className="lp-caption blog-meta">
      <time dateTime={post.date}>{formatDate(post.date)}</time>
      <span aria-hidden="true"> · </span>
      {marketingCopy.blog.minRead.replace("{n}", String(post.readingMinutes))}
    </p>
  );
}

/** Newest post: title at h2 scale, excerpt, date and reading time, resting on the lower edge of the desk painting. */
export function FeaturedPost({ post }: { post: Post }) {
  return (
    <article className="blog-featured glass-panel lp-reveal">
      <PostMeta post={post} />
      <h2 className="lp-h2 blog-featured__title">
        <Link href={`/blog/${post.slug}`} className="blog-link">
          {post.title}
        </Link>
      </h2>
      <p className="lp-lead">{post.summary}</p>
    </article>
  );
}

/** Index row: date column and title column share a grid. Rows sit transparent inside one glass panel and do not animate. */
export function PostRow({ post }: { post: Post }) {
  return (
    <article className="blog-row">
      <PostMeta post={post} />
      <div>
        <h3 className="lp-h4">
          <Link href={`/blog/${post.slug}`} className="blog-link">
            {post.title}
          </Link>
        </h3>
        <p className="lp-body-sm blog-row__summary">{post.summary}</p>
      </div>
    </article>
  );
}
