# Evaluation results

ATP portal evaluation reports for ChickensFarm. Each report is stored twice: the original
generated `.html` (self-contained, open it in a browser) and a `.md` duplicate of the same
content for reading and diffing in the repo.

| Report              | Generated  | HTML                                                                                                     | Markdown                                                                                             |
| ------------------- | ---------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Product Risk Report | 2026-09-07 | [chickensfarm-risks-report-2026-09-07T17-09-12.html](chickensfarm-risks-report-2026-09-07T17-09-12.html) | [chickensfarm-risks-report-2026-09-07T17-09-12.md](chickensfarm-risks-report-2026-09-07T17-09-12.md) |
| Team Report         | 2026-09-07 | [chickensfarm-team-report-2026-09-07T17-11-39.html](chickensfarm-team-report-2026-09-07T17-11-39.html)   | [chickensfarm-team-report-2026-09-07T17-11-39.md](chickensfarm-team-report-2026-09-07T17-11-39.md)   |

## Headline findings (2026-09-07)

- Overall product risk: **LOW** (low confidence). Highest focus score is 16.0 — no dependency
  vulnerability scanning in CI.
- Overall team score: **9** (low confidence). Strongest area is CI/CD & Deployment Pipeline (+75);
  weakest is Monitoring & Observability (−20).
- Recurring themes across both reports: add `npm audit --audit-level=high` to CI, add error
  monitoring, and add integration tests covering multi-tenant `farmId` isolation.

## Conventions

- Filenames keep the generator's timestamp, so new runs are added alongside rather than
  overwriting previous ones.
- The `.html` files are generated artifacts and are excluded from Prettier via `.prettierignore`
  (same treatment as the other generated HTML at the repo root). The `.md` duplicates are
  Prettier-formatted like any other doc.
