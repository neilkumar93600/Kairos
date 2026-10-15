import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
import { getPost, posts } from "@/lib/blog";
import { formatDate } from "@/lib/utils";

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = getPost((await props.params).slug);
  return post ? { title: post.title, description: post.summary } : {};
}

export default async function BlogPostPage(props: PageProps<"/blog/[slug]">) {
  const post = getPost((await props.params).slug);
  if (!post) notFound();
  return (
    <article className="py-16 md:py-20">
      <Container className="flex max-w-2xl flex-col gap-6">
        <p className="text-sm text-body">
          {formatDate(post.date)} · {post.readingMinutes} min read
        </p>
        <h1 className="text-4xl leading-tight tracking-tight">{post.title}</h1>
        {post.body.map((para) => (
          <p key={para.slice(0, 32)} className="text-lg leading-relaxed text-body">
            {para}
          </p>
        ))}
      </Container>
    </article>
  );
}
