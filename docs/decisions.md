# Decisions log

Short, dated entries recording a choice that was deliberately made — and why —
so it doesn't get re-litigated from scratch later. Not a design doc; each
entry is a paragraph or two.

---

## 2026-09-08 — Snyk for dependency scanning: not adopted

**Considered:** Adding Snyk (Open Source scanning) on top of the two scanners
already in place — the `audit` job in `.github/workflows/ci.yml`
(`npm audit --audit-level=high`, gated through
`.github/scripts/check-npm-audit.mjs`'s documented exception list) and
GitHub's native Dependabot (`.github/dependabot.yml` weekly update PRs, plus
Dependabot security alerts enabled on the repo).

**Decided:** Not now. Snyk's marginal value over the current setup is real but
small here: its vulnerability database is broader and often faster to publish
than npm's advisory feed, and its remediation suggestions (targeted patches,
not just "bump to latest") are more precise than a Dependabot PR. But this app
has no container or IaC surface for Snyk's other scanners to cover, license
scanning isn't a current need, and Dependabot's weekly PRs already deliver
working remediation (an open PR with the fixed version) for the CVEs most
likely to matter. Against that, Snyk adds a third account to maintain, a
`SNYK_TOKEN` secret to provision and rotate, and a second exception list to
keep in sync with the one `check-npm-audit.mjs` already maintains — real
ongoing cost for a solo-maintained, free-tier project. The two scanners
already in CI catch the CVEs that matter and fail the build on anything new
and unaccepted; that's the bar this task needs to clear, not "every possible
signal."

**Revisit if:** the dependency tree grows a container/IaC component Snyk
would meaningfully cover, license-compliance scanning becomes a requirement,
or the current `npm audit` + Dependabot combination visibly misses a CVE that
Snyk would have caught.
