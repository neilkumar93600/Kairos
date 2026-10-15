import Link from "next/link";
import type { Post } from "@/lib/blog";
import { formatDate } from "@/lib/utils";

export function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group flex flex-col gap-2 border-t border-line py-8">
      <p className="text-sm text-body">
        {formatDate(post.date)} · {post.readingMinutes} min read
      </p>
      <h2 className="text-2xl tracking-tight group-hover:underline group-hover:underline-offset-4">{post.title}</h2>
      <p className="max-w-[65ch] leading-relaxed text-body">{post.summary}</p>
    </Link>
  );
}
