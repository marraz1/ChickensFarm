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

| Processor                    | Service Used                 | Data Processed                                                            | DPA Available                  | DPA Signed Date                    |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------- | ------------------------------ | ---------------------------------- |
| [Resend](https://resend.com) | Transactional email delivery | User email addresses, email content (e.g. notifications, password resets) | Yes — Resend offers a GDPR DPA | Not yet signed — see issue #62/#64 |
| [Neon](https://neon.tech)    | Postgres database hosting    | All application data at rest, including user account and personal data    | Yes — Neon offers a GDPR DPA   | Not yet signed — see issue #62/#64 |
| [Vercel](https://vercel.com) | Application hosting          | Request data in transit, logs, environment variables                      | Yes — Vercel offers a GDPR DPA | Not yet signed — see issue #62/#64 |

## Keeping this up to date

Once each DPA has actually been reviewed and signed (issues #62 and #64),
update the corresponding "DPA Signed Date" cell above with the real date
instead of "Not yet signed." If a new processor starts handling personal
data on behalf of this app, add a row for it here as part of that change.
