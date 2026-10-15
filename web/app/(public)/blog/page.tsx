import type { Metadata } from "next";
import { PostCard } from "@/components/blog/post-card";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { posts } from "@/lib/blog";

export const metadata: Metadata = { title: "Blog", description: "How Kairos works, and what we learn about job searching." };

export default function BlogPage() {
  return (
    <section className="py-16 md:py-20">
      <Container className="flex max-w-3xl flex-col gap-8">
        <SectionHeading eyebrow="Blog" title="Notes on applying well." />
        <div>
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      </Container>
    </section>
  );
}
