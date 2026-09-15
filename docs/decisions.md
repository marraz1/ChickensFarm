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

---

## 2026-09-15 — Occasional human co-reviewer for high-risk changes: proposed

**Status:** Proposed. Merging the PR that adds this entry accepts it; change
this line to "Accepted" at that point.

**Context:** All knowledge of the codebase sits with one maintainer. Review
today is CI gates plus the maintainer's own pass over `REVIEW.md`, sometimes
with an AI assistant (a CodeRabbit config existed but the app was never
installed, and it was removed because it has no free plan). The
2026-09-07 risk evaluation rates "Solo Maintainer Knowledge Concentration" as
the top maintainability risk (focus 12.0) and notes there is no human peer
review at all. AI review is good at pattern violations it has been told about
(a missing guard, a query without `farmId`); it is weaker at the questions a
person who knows the domain asks — "is this the number a farmer expects?",
"what happens to existing rows?", "why is this route public?".

**Considered:**

1. _Self-review plus ad-hoc AI review (status quo)._ Zero cost, never blocks. Leaves the blind
   spots above, and nobody else ever sees the riskiest code.
2. _An occasional human co-reviewer for flagged high-risk changes only._ One
   friend or colleague, asked asynchronously when a PR touches auth, tenant
   scoping, money, migrations, secrets/outbound I/O, CI/release, or a major
   dependency upgrade. A few requests a month at most; never blocking.
3. _Mandatory human review for every PR (branch protection)._ The strongest
   signal, but it makes a solo project's velocity depend on a volunteer's free
   time and would block urgent fixes. Disproportionate here.

**Proposed:** Option 2, as written up in
[`review-process.md`](review-process.md): a path-based definition of
high-risk, a `needs-human-review` label plus a PR-template checkbox, a
~3-day turnaround, and — when nobody is available — merge anyway with a note
in the PR and a self-review checklist. Branch protection is not changed.

**Consequences:** The riskiest changes get a second pair of human eyes
without slowing everything else down, and a second person gradually gains
some familiarity with the code. Costs: finding and keeping one willing
reviewer, a little extra PR-description writing, and the discipline to
actually flag PRs (the template checkbox is the reminder). Nothing is
enforced, so the process only works if it is used; unreviewed high-risk
merges stay visible through the label.

**Revisit if:** no reviewer is found within a couple of months (fall back to
option 1 and drop the label), the project gains a second regular contributor
(move toward option 3), or a high-risk PR that skipped co-review causes an
incident.
