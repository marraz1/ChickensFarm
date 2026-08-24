import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // web-push is CommonJS and reaches for node:crypto and node:https directly.
  // The build succeeds without this, but a local build cannot prove the bundled
  // form works at runtime on Vercel — and a dynamic require inside its asn1
  // dependency would fail there, not here. Marking it external sidesteps the
  // whole class of problem at no cost: on the Node runtime Vercel traces
  // node_modules into the lambda either way.
  serverExternalPackages: ["web-push"],

  async headers() {
    return [
      {
        // The worker must never be served stale — a cached copy would pin an old
        // push handler. `updateViaCache: "none"` on the registration covers the
        // update check; this covers the first fetch and any intermediary.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
