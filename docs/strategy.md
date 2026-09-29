# Strategy (one-pager)

A short note on who ChickensFarm is for, what it solves, and where it is heading.
It is a small, solo-maintained project, so this is not a roadmap with dates and it
has no sprint goals or OKRs. Statements marked _(inferred)_ are read from the repo
and the issue history rather than stated by the owner. Check them before relying on
them.

_Last reviewed: 2026-09-29 (v0.1.13)._

## Who it is for

- **Small poultry farms.** The requirements spec is written for "smulkiems ir
  vidutiniams paukštininkystės ūkiams" (small and medium poultry farms), and the
  README describes the app as poultry farm management for small farms
  ([`Paukstininkyste_reikalavimu_specifikacija.md`](../Paukstininkyste_reikalavimu_specifikacija.md)
  §1, [`README.md`](../README.md)).
- **Lithuanian speakers.** The whole UI is in Lithuanian (e.g. _Profilis →
  Pranešimai_, _Siųsti atsiliepimą_).
- **People entering data on a phone next to the birds.** The spec says farm workers
  will usually enter data standing by the pens with a phone. That is why the app is
  mobile-first and installable as a PWA.
- **Mixed flocks.** The schema covers hens, ducks, geese and turkeys, kept for
  eggs and for meat
  ([#157](https://github.com/marraz1/ChickensFarm/issues/157)).
- **One person per farm today.** Registration is public. The schema models several
  members per farm, but the app has no way to add them yet
  ([`compliance/gdpr-applicability.md`](compliance/gdpr-applicability.md),
  [`architecture.md`](architecture.md#known-gaps)).
- _(inferred)_ The repo does not show how many people outside the owner use the app.
  Hobby keepers and small family farms look like the realistic audience, not
  commercial operations.

## The problem it solves

A small farm's records live in one place, entered in seconds from a phone:

- the flock (groups, breeds, sex, quantities, and how each group changed),
- eggs collected, sold and eaten at home,
- incubation cycles and broody hens,
- losses by reason, and birds used for meat,
- expenses and income, so the owner can see whether the flock pays for itself.

A daily reminder (email or push) is sent only on days when no eggs have been logged,
so the records stay complete without extra effort.

_(inferred)_ The alternative is paper, a spreadsheet or memory. With any of those,
it is hard to answer questions like "are my hens laying less than last month?" or
"did egg sales cover feed costs?".

## Near-term direction (next few months) _(inferred)_

No feature work is open on the board. The only open items are this document and its
parent Product and Teamwork epics
([#54](https://github.com/marraz1/ChickensFarm/issues/54),
[#38](https://github.com/marraz1/ChickensFarm/issues/38),
[#40](https://github.com/marraz1/ChickensFarm/issues/40)). The direction below comes
from recent merged work, not from a plan:

1. **Let real feedback set priorities.** The in-app feedback form
   ([PR #165](https://github.com/marraz1/ChickensFarm/pull/165)) stores messages in
   the `feedback` table. The next step is to read them and turn anything actionable
   into tickets. New features should come from this feedback, not from a backlog
   written in advance.
2. **Keep daily logging reliable on phones.** Recent work went into reminders and
   push ([PR #29](https://github.com/marraz1/ChickensFarm/pull/29),
   [PR #164](https://github.com/marraz1/ChickensFarm/pull/164)), mobile testing
   ([#66](https://github.com/marraz1/ChickensFarm/issues/66)) and a production
   smoke test after every release
   ([PR #167](https://github.com/marraz1/ChickensFarm/pull/167)).
3. **Fill gaps in the farm model as they come up.** Recording birds used for meat
   ([#157](https://github.com/marraz1/ChickensFarm/issues/157)) is the recent
   example.
4. **Keep the engineering baseline without growing it.** Tests, monitoring,
   security and GDPR work followed the 2026-09-07 evaluations
   ([`evaluations/`](evaluations/)). Items from the
   [known gaps](architecture.md#known-gaps) list get fixed when they cause a
   problem.

Candidates that are **not** committed: the spec's later-phase features that have not
been built. These are farm members and a worker role, a profit-and-loss report,
charts, and export
([`implementation-plan.md`](implementation-plan.md) §7). Feedback should decide
whether any of them is worth building.

## What we're not doing (for now)

| Item                                                                                                                                                       | Why                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Product analytics ([#85](https://github.com/marraz1/ChickensFarm/issues/85))                                                                               | Not a priority yet. Direct in-app feedback covers the need. Revisit if the user base grows.                |
| Feature flags ([#84](https://github.com/marraz1/ChickensFarm/issues/84))                                                                                   | Risky changes go through the review process and release checks. Revisit if a change needs gradual rollout. |
| GitHub CodeQL ([#81](https://github.com/marraz1/ChickensFarm/issues/81))                                                                                   | Free only for public repos, and this repo is private. See [`decisions.md`](decisions.md).                  |
| Sprint goals and quarterly outcomes ([#88](https://github.com/marraz1/ChickensFarm/issues/88), [#100](https://github.com/marraz1/ChickensFarm/issues/100)) | A solo project with no sprints or quarterly planning.                                                      |
