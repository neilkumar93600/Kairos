import Image from "next/image";
import Link from "next/link";
import { marketingCopy } from "@/content/marketing-copy";
import type { PostSummary } from "@/lib/blog";
import { cn } from "@/lib/utils";
import "./blog.css";

const href = (post: PostSummary) => `/blog/${post.slug}`;

/** Date and reading time. */
export function PostMeta({ post }: { post: PostSummary }) {
  return (
    <p className="lp-caption blog-meta">
      <time dateTime={post.date}>{post.dateLabel}</time>
      <span aria-hidden="true"> · </span>
      {marketingCopy.blog.minRead.replace("{n}", String(post.readingMinutes))}
    </p>
  );
}

export function PostChip({ post }: { post: PostSummary }) {
  return (
    <p className="blog-chip">
      <span aria-hidden="true" className="blog-chip__dot" />
      {post.category}
    </p>
  );
}

/** Newest post as a large painted card. The text carries its own scrim (blog.css), so contrast does not depend on the crop. */
export function CoverPost({ post }: { post: PostSummary }) {
  return (
    <article className="blog-cover">
      <Image
        src={post.image.src}
        alt={post.image.alt}
        fill
        preload
        sizes="(min-width: 1280px) 860px, (min-width: 1024px) 62vw, 100vw"
        style={{ objectPosition: post.image.position }}
      />
      <div aria-hidden="true" className="blog-cover__blur" />
      <div className="blog-cover__body">
        <PostChip post={post} />
        <h2 className="blog-cover__title">
          <Link href={href(post)} className="blog-link">
            {post.title}
          </Link>
        </h2>
        <PostMeta post={post} />
      </div>
    </article>
  );
}

/** The "Latest" list row: thumbnail, title, meta. The title already names the link, so the painting has an empty alt. */
export function LatestRow({ post }: { post: PostSummary }) {
  return (
    <li className="blog-row">
      <div className="blog-row__art">
        <Image src={post.image.src} alt="" fill sizes="164px" style={{ objectPosition: post.image.position, transformOrigin: post.image.position }} />
      </div>
      <div className="blog-row__text">
        <h3 className="blog-row__title">
          <Link href={href(post)} className="blog-link">
            {post.title}
          </Link>
        </h3>
        <PostMeta post={post} />
      </div>
    </li>
  );
}

export interface PostCardProps {
  post: PostSummary;
  sizes: string;
  /** Related posts: no summary, because the card is half an article column wide. */
  compact?: boolean;
}

/** Image card. The whole card is the target; the lift is .lp-lift and the zoom is blog.css, both off under reduced motion. */
export function PostCard({ post, sizes, compact }: PostCardProps) {
  return (
    <article className={cn("blog-card glass-panel lp-lift", compact && "blog-card--compact")}>
      <div className="blog-card__art">
        <Image src={post.image.src} alt="" fill sizes={sizes} style={{ objectPosition: post.image.position }} />
      </div>
      <div className="blog-card__body">
        <PostChip post={post} />
        <h3 className="lp-h4 blog-card__title">
          <Link href={href(post)} className="blog-link">
            {post.title}
          </Link>
        </h3>
        {compact ? null : <p className="lp-body-sm blog-card__summary">{post.summary}</p>}
        <PostMeta post={post} />
      </div>
    </article>
  );
}
