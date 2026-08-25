import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

/**
 * The released version, taken from package.json at build time.
 *
 * Injected as an env var rather than imported into the bundle: the release
 * workflow needs to read this back from a running deployment to prove that the
 * version it published is the one actually being served, and a value baked in
 * at build is the only thing that can answer that honestly.
 *
 * Next loads this config with the project root as the working directory. The
 * fallback covers a build invoked some other way; npm sets npm_package_version
 * for every `npm run` script, including `vercel-build`.
 */
function appVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version?: string };
    if (pkg.version) return pkg.version;
  } catch {
    // fall through
  }
  return process.env.npm_package_version ?? "0.0.0";
}

const nextConfig: NextConfig = {
  // Available on both sides as process.env.APP_VERSION, inlined at build.
  env: { APP_VERSION: appVersion() },

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
