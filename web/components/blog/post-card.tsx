import Link from "next/link";
import type { Post } from "@/lib/blog";
import { formatDate } from "@/lib/utils";
import "./blog.css";

function Meta({ post }: { post: Post }) {
  return (
    <p className="lp-caption blog-meta">
      <time dateTime={post.date}>{formatDate(post.date)}</time>
      <span aria-hidden="true"> · </span>
      {post.readingMinutes} min read
    </p>
  );
}

/** Newest post: title at h2 scale, excerpt, date and reading time, on its own glass card. */
export function FeaturedPost({ post }: { post: Post }) {
  return (
    <article className="blog-featured glass-panel">
      <Meta post={post} />
      <h2 className="lp-h2 blog-featured__title">
        <Link href={`/blog/${post.slug}`} className="blog-link">
          {post.title}
        </Link>
      </h2>
      <p className="lp-lead">{post.summary}</p>
    </article>
  );
}

/** Index row: date column and title column share a grid. Rows sit transparent inside one glass panel. */
export function PostRow({ post }: { post: Post }) {
  return (
    <article className="blog-row">
      <Meta post={post} />
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
