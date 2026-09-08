---
name: atp-board-sync
description: >
  Repo-specific to marraz1/ChickensFarm. Reads the latest ATP risk report and
  ATP team report from docs/evaluations/ and creates/updates a GitHub
  Projects v2 Epic -> Story -> Task/Bug issue hierarchy on the
  "Chickens_Farm" board (project #3, https://github.com/users/marraz1/projects/3),
  linked via native GitHub sub-issues. Use when the user asks to sync,
  publish, turn into issues/tickets, or push ATP report findings and
  recommendations onto the GitHub project board. Not for general issue
  triage unrelated to ATP reports.
---

# ATP report -> GitHub board sync

Turns the findings in ChickensFarm's ATP evaluation reports into a real
Epic -> Story -> Task/Bug hierarchy on the "Chickens_Farm" GitHub Projects v2
board. Always presents the full plan and waits for confirmation before
writing anything, unless the user's request explicitly says to skip
confirmation (e.g. "just do it", "no need to confirm").

## 0. Inputs

- No file named by the user -> auto-discover: glob `docs/evaluations/*-risks-report-*.md`
  and `docs/evaluations/*-team-report-*.md`, parse the ISO timestamp segment
  out of each filename (`chickensfarm-<type>-report-<timestamp>.md`), and use
  the newest of each type.
- User names an explicit report file (or files) -> use those instead.
- If only one of the two report types is found, proceed with just that one
  and say so in the final summary.

## 1. Report structure (how to parse)

Both reports are Markdown with this shape:

- **Risk report**: H2 = risk **Category** (e.g. "Security", "Compliance and
  Regulatory"). Each H2 contains one or more H3 = a specific named risk,
  heading pattern `### <Name> — Focus <N.N>`. Each H3 has an italic summary
  line (confidence, focus, risk score, QA maturity), an `**Indicators**`
  bullet list (evidence — never turn these into tasks), and a
  `**Mitigation actions**` bullet list (2-3 bullets — these become Tasks).
- **Team report**: H2 = **Pillar** (Product, Code & System, Teamwork,
  Culture). Each H2 contains H3 = a **criterion**, heading pattern
  `### <Name> — <score>` (score uses a real Unicode minus `−` when negative).
  Each H3 has a summary line, `**Positive/Negative signals**` bullets
  (evidence only), `**In-person checks**` (human-only questions — never
  turn these into tasks), and a `**Suggested actions**` bullet list (these
  become Tasks).

**Story-worthy detection is structural, not topic-based.** Only create a
Story for an H3 section if it actually contains a `**Mitigation actions**`
or `**Suggested actions**` heading followed by >=1 bullet. Some criteria
(e.g. "Team Empowerment", "Psychological Safety", "Trust over Control") have
no such block in the current report and must be skipped entirely — no Story,
no issue. Do not hardcode which topics to skip; detect it fresh from
whichever report is actually being read, since this changes between runs.

## 2. Hierarchy mapping

- **Epic** = one per H2 (Category or Pillar) that has at least one
  story-worthy H3 underneath it.
- **Story** = one per story-worthy H3, linked as a sub-issue of its Epic.
- **Task** (rarely **Bug**) = one per mitigation-action / suggested-action
  bullet, linked as a sub-issue of its Story. Default label `task`. Use
  `bug` only if the bullet's language describes fixing an existing
  confirmed defect (matches something like `fix|bug|broken|incorrect
  behavior|failing|regression`) rather than adding a preventive or
  gap-filling control — this will be rare; default to `task` when unsure.

## 3. GitHub representation constraints (read this before calling any tool)

`marraz1` is a personal GitHub account, not an org. GitHub's native **Issue
Types** feature and the **Issue Fields** feature (`issue_fields` param on
`mcp__github__issue_write`, and `mcp__github__list_issue_fields`) are
org-only and return null/empty here — do not use `issue_fields`. Instead:

- Epic/Story/Task/Bug are represented as **labels**: `epic`, `story`,
  `task`, `bug` (the last already exists in the repo).
- Hierarchy (Epic contains Story contains Task) uses GitHub's native
  **sub-issues**: pass `parent_issue_number` (and `parent_owner`/
  `parent_repo` if ever needed, but they default to the current repo) on
  `mcp__github__issue_write` with `method: "create"`. This creates the
  issue AND links it as a sub-issue in one call.
- Placing an issue onto the Projects v2 board and setting Status/
  Priority/Size/Estimate has **no MCP tool** — use raw `gh api graphql`
  via Bash, authenticated with the same token already used for the
  `github` MCP server:
  `GH_TOKEN="$GITHUB_MCP_TOKEN" gh api graphql -f query='...'`
- The board's **Parent issue** / **Sub-issues progress** fields are
  read-only and auto-populate from the sub-issue links above — never try
  to set them directly.

### Hardcoded board IDs (Chickens_Farm, project #3, owner marraz1)

```
Project ID:        PVT_kwHOAejg084BiuNn

Status field:       PVTSSF_lAHOAejg084BiuNnzhhlKBI
  Backlog            f75ad846
  Ready               61e4505c
  In progress         47fc9ee4
  In review           df73e18b
  Done                98236657

Priority field:     PVTSSF_lAHOAejg084BiuNnzhhlKYA
  P0                 79628723
  P1                 0a877460
  P2                 da944a9c

Size field:         PVTSSF_lAHOAejg084BiuNnzhhlKYE
  XS                 6c6483d2
  S                  f784b110
  M                  7515a9f1
  L                  817d0097
  XL                 db339eb2

Estimate field (NUMBER): PVTF_lAHOAejg084BiuNnzhhlKYI
```

If any `gh api graphql` call referencing these IDs fails with a
"could not resolve" style error, the board has changed — stop and tell the
user rather than guessing new IDs silently.

### Adding an issue to the project and setting fields

```bash
# 1. Add (contentId is the issue's GraphQL node id, i.e. the REST node_id
#    field returned when the issue was created)
GH_TOKEN="$GITHUB_MCP_TOKEN" gh api graphql -f query='
mutation {
  addProjectV2ItemById(input: {
    projectId: "PVT_kwHOAejg084BiuNn",
    contentId: "<issue node id>"
  }) { item { id } }
}'
# -> capture the returned item.id (the PROJECT ITEM id, distinct from the issue node id)

# 2. Set a single-select field (Status/Priority/Size)
GH_TOKEN="$GITHUB_MCP_TOKEN" gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_kwHOAejg084BiuNn",
    itemId: "<project item id>",
    fieldId: "<field id>",
    value: { singleSelectOptionId: "<option id>" }
  }) { projectV2Item { id } }
}'

# 3. Set the numeric Estimate field
GH_TOKEN="$GITHUB_MCP_TOKEN" gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_kwHOAejg084BiuNn",
    itemId: "<project item id>",
    fieldId: "PVTF_lAHOAejg084BiuNnzhhlKYI",
    value: { number: <n> }
  }) { projectV2Item { id } }
}'
```

`addProjectV2ItemById` is safe to call again for an item already on the
board — it returns the existing item id rather than erroring, so it's fine
to call unconditionally even when re-using a previously-created issue.

## 4. Idempotency

Every issue this skill creates (Epic, Story, or Task/Bug) gets an HTML
comment as the very first line of its body:

```
<!-- atp-sync:v1 id=<stable-id> report=<type>:<filename> -->
```

Stable-id grammar (`slug()` = lowercase, strip accents, non-alnum -> `-`):

- Epic: `epic/<report-type>/<slug(category-or-pillar)>`
- Story: `story/<report-type>/<slug(category-or-pillar)>/<slug(risk-or-criterion)>`
- Task: `<story stable-id>/task-<n>` where n is the 1-based position of that
  bullet within its section's action list

`report-type` is `risk` or `team`.

**Before creating anything at a given level**, call
`mcp__github__list_issues(owner:"marraz1", repo:"ChickensFarm",
labels:["epic"|"story"|"task"], fields:["number","title","body"],
perPage:100)`, paginate via the cursor if `hasNextPage`, and scan the
returned `body` strings for the exact marker substring `id=<stable-id>`.

- Match found -> reuse that issue's number. Skip the create call, but still
  run the project-add and field-set steps (safe to repeat).
- No match -> create.

Do **not** use `mcp__github__search_issues` for this — it does
natural-language semantic matching, not exact-string lookup, and will miss
or misfire on an exact marker.

Keep an in-memory ledger (`stable-id -> issue number`) for the duration of
one run so children can find their just-created parent without re-querying
GitHub. Only the very first `list_issues` pass per level needs to look for
issues from *prior* runs.

If a matched existing issue's current report text has drifted materially
from what's now in the report (e.g. the mitigation action wording changed),
do not overwrite it — call `mcp__github__add_issue_comment` on the existing
issue quoting old vs. new text, and leave it to the human to reconcile.

## 5. Priority mapping

Reuse each report's own stated severity legend — do not invent new
thresholds:

- **Risk-sourced** Story/Task: Focus >=15 -> P0, Focus 8-14 -> P1, Focus <8
  -> P2 (matches the risk report's own Red/Yellow/Green focus legend).
- **Team-sourced** Story/Task: score < −33 -> P0, −33..33 -> P1, score >33
  -> P2 (matches the team report's own Red/Yellow/Green legend).
- Task inherits its parent Story's Priority unchanged — never re-derive
  Priority per bullet.
- Epics: leave Priority unset.

## 6. Estimation (Size + Estimate fields, or a comment fallback)

Match the bullet's text against these cue groups, case-insensitive, first
match wins. Set both `Size` and the numeric `Estimate` together from the
same row:

| Size | Estimate | Cues |
|---|---|---|
| XS | 1 | "one-line", "one-package install", "pin `...`", "(free, automatic)" |
| S | 2 | "single page", "one-page(r)", "brief", "wire ... to", "add a step" |
| M | 5 | "test suite", "integration test", "structured ... logging", "analytics", "runbook" |
| L | 8 | "review and sign" + multiple named vendors, "recruit", "cross-browser", "DPIA" |
| XL | 13 | large migration / org-wide process language (rare; keep for future reports) |

If nothing matches, or two conflicting tiers both match with no clear
winner: leave Size and Estimate unset on the issue, and instead post a
comment via `mcp__github__add_issue_comment`:

```
**Estimate:** Not confidently derivable from the report text alone.
Suggested default while triaging: **S**. Please refine after review.
```

## 7. Label setup (run once, idempotent, before creating any issues)

```bash
GH_TOKEN="$GITHUB_MCP_TOKEN" gh label create epic  --color 5319E7 --description "Broad initiative from an ATP report category/pillar" --repo marraz1/ChickensFarm --force
GH_TOKEN="$GITHUB_MCP_TOKEN" gh label create story --color 0E8A16 --description "A specific ATP-identified risk or criterion; groups actionable Tasks" --repo marraz1/ChickensFarm --force
GH_TOKEN="$GITHUB_MCP_TOKEN" gh label create task  --color FBCA04 --description "A single actionable mitigation/suggested-action item from an ATP report" --repo marraz1/ChickensFarm --force
```

`--force` updates the label in place if it already exists — safe to run
every time. `bug` already exists in the repo; do not recreate it.

## 8. Issue body templates

**Epic body:**

```markdown
<!-- atp-sync:v1 id=epic/risk/security report=risk:<filename> -->

One-line description of what this category/pillar covers, plus a link
back to the report section, e.g.:

Source: [ATP Risk Report -> Security](../../docs/evaluations/<filename>#security)
```

**Story body:**

```markdown
<!-- atp-sync:v1 id=story/risk/security/no-dependency-vulnerability-scanning report=risk:<filename> -->

<the H3 section's descriptive prose, verbatim>

_<confidence> confidence · Focus <N> · Risk score <N> (Impact <N> x Likelihood <N>) · QA maturity <N>%_
(or for team report: _<confidence> confidence · <N positive> positive · <N negative> negative_)

Source: [ATP Risk Report -> Security](../../docs/evaluations/<filename>#security) -> *No Dependency Vulnerability Scanning*
```

**Task/Bug body:**

```markdown
<!-- atp-sync:v1 id=story/risk/security/no-dependency-vulnerability-scanning/task-1 report=risk:<filename> -->

**Source:** ATP Risk Report -> [Security](../../docs/evaluations/<filename>#security) -> *No Dependency Vulnerability Scanning* (Focus 16.0 — Red, Risk score 16, QA maturity 0%)

**Why:** <one-line rationale drawn from the H3 section's prose>

**Do:**
<the mitigation/suggested-action bullet text, verbatim or lightly trimmed>

**Context from report indicators:**
- <only indicator/signal bullets that name a concrete file/path — omit this section entirely if none do>

**Acceptance criteria:**
- [ ] <the action described above is done>
- [ ] CI / tests still pass
- [ ] <one concrete verifiable condition drawn from the action text>

---
_Auto-generated from the ATP <risk|team> report by the `atp-board-sync` skill. The marker comment above prevents duplicate issues on re-sync — do not remove it._
```

Team-report-sourced tasks use the same shape with
`**Source:** ATP Team Report -> <Pillar> -> *<Criterion>* (score <score>)`.

## 9. Execution order

1. Parse both reports (or whichever are available) fully, in memory, before
   touching GitHub. Build the complete planned tree: Epics -> Stories ->
   Tasks/Bugs, each with computed stable-id, label, Priority, Size/Estimate
   (or "needs comment fallback").
2. Check GitHub for existing issues (per §4) to classify each planned item
   as create vs. already-exists, WITHOUT creating anything yet.
3. **Present the full plan to the user**: a table of every planned Epic /
   Story / Task with title, label, priority, size, and create-vs-skip
   status, plus counts. Wait for explicit confirmation before proceeding —
   unless the user's original request already said to skip confirmation.
4. On confirmation, execute in order: labels (§7) -> Epics -> Stories ->
   Tasks/Bugs. For each level: create-or-reuse -> add to project ->
   set Status (all levels) -> set Priority (Story/Task only) -> set
   Size/Estimate or fallback comment (Task/Bug only).
5. **Stop immediately and report clearly** if an issue-create call fails
   (e.g. `403 Resource not accessible by personal access token` — a known
   possible state if the connected token lacks Issues-write permission).
   Do not continue creating children of a level that just failed; report
   exactly what succeeded before the failure so nothing is left half-built
   silently.

## 10. Final output

A Markdown summary table:

| Level | Title | Issue | Action | Priority | Size |
|---|---|---|---|---|---|
| Epic | Epic: Security | #12 | created | — | — |
| Story | Story: No Dependency Vulnerability Scanning | #13 | created | P0 | — |
| Task | Task: Add npm audit --audit-level=high to ci.yml | #14 | created | P0 | XS |
| Task | Task: Enable Dependabot security alerts | #15 | skipped (already exists) | P0 | S |

Followed by a short prose summary: counts by level and action
(created/skipped/updated), which Stories were skipped for having zero
actionable bullets, which items got an estimate fallback comment instead of
a Size (with links), and any failures.
