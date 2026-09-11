# Compliance

Tracks GDPR Data Processing Agreement (DPA) status for the third-party
processors that handle personal data on behalf of this app. Personal data
here includes things like user emails, names, and account details processed
by these vendors while they provide their service to ChickensFarm.

This table exists because there was no central record of which processors
have signed DPAs (ATP Risk Report — Compliance and Regulatory —
_Undocumented Data Processor Agreements_, Focus 9.0). Actually reviewing and
signing each DPA is a human/legal action, not something an agent can do —
that work is tracked separately in issues #62 and #64.

| Processor                    | Service Used                 | Data Processed                                                            | DPA Available                                     | DPA Signed Date                                                                               |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Resend](https://resend.com) | Transactional email delivery | User email addresses, email content (e.g. notifications, password resets) | Yes — Resend offers a GDPR DPA                    | Not yet signed — see issue #62/#64                                                            |
| [Neon](https://neon.tech)    | Postgres database hosting    | All application data at rest, including user account and personal data    | Yes, pre-signed by Neon — countersigning optional | Incorporated by reference 2026-09-11; formal countersigned copy not yet done (see note below) |
| [Vercel](https://vercel.com) | Application hosting          | Request data in transit, logs, environment variables                      | N/A — no separate signature flow                  | Auto-incorporated 2026-09-11 (see note below)                                                 |

**Vercel note:** Vercel doesn't offer a DPA you separately sign — by agreeing
to [Vercel's Terms of Service](https://vercel.com/legal/terms), a customer is
deemed to have signed both the DPA and the Standard Contractual Clauses;
there's no dashboard signature flow. A downloadable copy for records is
available at [vercel.com/legal/dpa](https://vercel.com/legal/dpa). Vercel's
in-dashboard Settings → Compliance tab (account-specific downloadable copies)
only appears on Pro/Enterprise plans — this team is currently on Hobby, so it
404s; that tab isn't required for compliance, since the DPA already applies
regardless of plan.

**Neon note:** using Neon's platform already legally incorporates its DPA by
reference into Neon's terms — no action is required for that baseline
coverage. Neon also offers a standalone, pre-signed PDF
([neon.com/dpa](https://neon.com/dpa), mirrored at
[neon.com/pdf/DPA.pdf](https://neon.com/pdf/DPA.pdf)) with a blank "For
Controller" signature block, for customers who want a formally
countersigned copy for their own audit records. This is optional, not a
compliance requirement. Neon's console has no self-serve DPA signing flow
or listed return address for a countersigned copy — the most likely contact
points are security@neon.tech or [neon.com/contact-sales](https://neon.com/contact-sales).
Countersigning has not been done as of this writing.

## Keeping this up to date

Vercel is fully resolved (no action needed — see note above). Neon has
baseline coverage already (incorporated by reference) but a formal
countersigned copy is still outstanding if wanted for records. Once Resend
has actually been reviewed and signed, and/or the Neon PDF countersigned
(issues #62 and #64), update the corresponding "DPA Signed Date" cells above
with the real date. If a new processor starts handling personal data on
behalf of this app, add a row for it here as part of that change.
