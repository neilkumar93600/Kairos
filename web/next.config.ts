import type { NextConfig } from "next";

/** The Express API on Railway. The browser only ever talks to this app; /api/* is proxied server-side. */
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@auto-career/shared"],
  // Read by the landing colophon ("Built {date}"); fixed per build so the page stays prerendered.
  env: { BUILD_DATE: new Date().toISOString().slice(0, 10) },
  turbopack: {
    rules: {
      // Tailwind for plain stylesheets only: matching *.module.css too would re-type it as global CSS
      // and drop CSS-module hashing (styles.x came back undefined).
      "*.css": {
        condition: { not: { path: "*.module.css" } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
