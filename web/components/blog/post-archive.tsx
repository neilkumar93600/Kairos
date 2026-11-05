"use client";

import { MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/shared/button";
import { EmptyEm, EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/shared/field";
import { marketingCopy } from "@/content/marketing-copy";
import type { PostSummary } from "@/lib/blog";
import { matchesPost } from "@/lib/blog-search";
import { PostCard } from "./post-card";

const { all, empty } = marketingCopy.blog;

/** "All posts": a search that filters as you type, then the card grid. Every card is in the prerendered HTML; the query only hides. */
export function PostArchive({ posts }: { posts: PostSummary[] }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const term = query.trim();
  const shown = posts.filter((post) => matchesPost(post, term));
  const count = term
    ? all.matches.replace("{n}", String(shown.length)).replace("{total}", String(posts.length))
    : all.count.replace("{n}", String(posts.length));

  function clear() {
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <section aria-labelledby={`${id}-h`} className="lp-wrap lp-wrap--main blog-all">
      <div className="blog-all__head">
        <div className="blog-all__title">
          <h2 id={`${id}-h`} className="lp-h3">
            {all.heading}
          </h2>
          <p role="status" className="lp-caption blog-meta">
            {count}
          </p>
        </div>
        <div className="blog-all__search">
          <label htmlFor={`${id}-q`} className="sr-only">
            {all.searchLabel}
          </label>
          <MagnifyingGlass aria-hidden="true" size={18} weight="light" className="blog-all__icon" />
          <Input
            ref={inputRef}
            id={`${id}-q`}
            type="search"
            autoComplete="off"
            placeholder={all.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      {shown.length > 0 ? (
        <div className="blog-grid">
          {shown.map((post) => (
            <PostCard key={post.slug} post={post} sizes="(min-width: 1280px) 400px, (min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw" />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            <>
              {empty.title} <EmptyEm>“{term}”</EmptyEm>
            </>
          }
          body={empty.body}
          action={<Button onClick={clear}>{empty.clear}</Button>}
          fan={{ caption: empty.fanCaption, posts: posts.slice(0, 3) }}
        />
      )}
    </section>
  );
}
