#!/usr/bin/env node
// Fails if `npm audit --json` reports a high/critical advisory that isn't in
// the accepted-exceptions list. See the ACCEPTED entries below for why each
// one is currently unreachable rather than fixed.
//
// Usage: node check-npm-audit.mjs <audit.json path>

import { readFileSync } from "node:fs";

const ACCEPTED = [
  {
    id: "GHSA-ggr8-5vv4-36mx", // deepmerge-ts
    reason:
      "Bundled inside prisma's own @prisma/config -> deepmerge-ts chain, " +
      "used only by prisma's internal MySQL-provider and `prisma dev` " +
      "local-database tooling. This app uses Postgres via " +
      "@prisma/adapter-neon only and never invokes that code path.",
  },
  {
    id: "GHSA-3f6p-5ww8-9rcr", // mysql2
    reason: "Same @prisma/config -> mysql2 chain as above; unreachable.",
  },
  {
    id: "GHSA-rgwj-5xj2-c3m3", // mysql2
    reason: "Same @prisma/config -> mysql2 chain as above; unreachable.",
  },
  // The only upstream fix for the three above is either downgrading
  // prisma 7.10.0 -> 6.19.3 (a major regression) or upgrading to Prisma 8,
  // which is still a release candidate as of 2026-09-08 — both worse than
  // accepting this until Prisma ships a stable fix. Revisit by removing the
  // relevant entry once it does.
];

const auditPath = process.argv[2];
if (!auditPath) {
  console.error("Usage: node check-npm-audit.mjs <audit.json path>");
  process.exit(2);
}

const data = JSON.parse(readFileSync(auditPath, "utf8"));

const found = new Set();
for (const advisory of Object.values(data.vulnerabilities || {})) {
  for (const via of advisory.via || []) {
    if (typeof via === "object" && via.url) found.add(via.url);
  }
}

const unaccepted = [...found].filter((url) => !ACCEPTED.some((a) => url.includes(a.id)));

if (found.size > 0) {
  console.log("Advisories found:");
  for (const url of found) {
    const accepted = ACCEPTED.find((a) => url.includes(a.id));
    console.log(`  ${accepted ? "[accepted]" : "[NOT ACCEPTED]"} ${url}`);
    if (accepted) console.log(`    -> ${accepted.reason}`);
  }
} else {
  console.log("No high/critical advisories found.");
}

if (unaccepted.length > 0) {
  console.error(
    `\n${unaccepted.length} advisory(ies) outside the accepted exception list. Failing.`,
  );
  process.exit(1);
}

console.log("\nAll advisories are covered by the accepted exception list.");
