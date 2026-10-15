import type { MetadataRoute } from "next";
import { posts } from "@/lib/blog";
import { siteConfig } from "@/lib/site";

const PUBLIC_PATHS = ["", "/pricing", "/how-it-works", "/about", "/blog", "/careers", "/contact", "/terms", "/privacy", "/cookies", "/refunds"];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PUBLIC_PATHS.map((path) => ({ url: `${siteConfig.url}${path}` })),
    ...posts.map((p) => ({ url: `${siteConfig.url}/blog/${p.slug}`, lastModified: p.date })),
  ];
}
