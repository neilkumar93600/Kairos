import { describe, expect, it } from "vitest";
import { postFans, postMeta } from "../content/blog-meta";
import { getPost, posts, relatedPosts } from "../lib/blog";
import { matchesPost } from "../lib/blog-search";

const post = { title: "How the truth lock works", summary: "Every line must cite a fact you confirmed.", category: "How it works" };

describe("blog search", () => {
  it("matches title, summary and category, ignoring case", () => {
    expect(matchesPost(post, "TRUTH")).toBe(true);
    expect(matchesPost(post, "confirmed")).toBe(true);
    expect(matchesPost(post, "how it")).toBe(true);
  });

  it("needs every word, and an empty query matches", () => {
    expect(matchesPost(post, "truth visas")).toBe(false);
    expect(matchesPost(post, "   ")).toBe(true);
  });
});

describe("blog content", () => {
  it("gives each post its own painting and a body", () => {
    expect(new Set(postMeta.map((p) => p.image.src)).size).toBe(postMeta.length);
    for (const p of posts) expect(p.sections.length).toBeGreaterThan(0);
  });

  it("quotes only words that are in the article, after a section that exists", () => {
    for (const p of posts) {
      const body = p.sections.flatMap((s) => s.body).join(" ");
      expect(body).toContain(p.pull.text);
      expect(p.sections[p.pull.after]).toBeDefined();
    }
  });

  it("links empty states only to posts that exist", () => {
    for (const fan of Object.values(postFans)) expect(fan.posts).toHaveLength(3);
  });

  it("relates two other posts, same category first", () => {
    const truth = getPost("how-the-truth-lock-works")!;
    const related = relatedPosts(truth);
    expect(related).toHaveLength(2);
    expect(related.map((p) => p.slug)).not.toContain(truth.slug);
    expect(related.every((p) => p.category === truth.category)).toBe(true);
  });
});
