import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Kompresja odpowiedzi (gzip) — bez niej ~640 KiB JS/CSS idzie surowo,
  // co na łączu telefonu przez Tailscale odczuwalnie zwalnia pierwszy
  // load. Lokalnie: najcięższy chunk 229 KiB → ~72 KiB.
  compress: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
