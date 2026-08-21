# Review guidelines

These apply to every pull request into `main`. CodeRabbit reads this file
(see `.coderabbit.yaml` → `knowledge_base.code_guidelines`), and human
reviewers should work through the same list.

## Tenant isolation (highest priority)

The app is multi-tenant: every record belongs to a farm. A query that forgets
its scope silently exposes one farm's data to another, and neither TypeScript
nor ESLint can catch it.

- Every Prisma query in `src/lib/services/**` filters on `farmId`.
- Any id that arrives from the client is confirmed to belong to the caller's
  farm before it is read, updated or deleted.

## API route contract

`src/app/api/**/route.ts` follows one shape — see
[expenses/route.ts](src/app/api/expenses/route.ts) as the reference:

1. `await requireActiveFarmApi()` (or the equivalent session guard) first.
2. Validate the body with a zod schema from `src/lib/validation/*` via
   `safeParse`; return 400 on failure.
3. Delegate data access to `src/lib/services/*` — no `prisma` import in a
   route handler.
4. Wrap the body in `try/catch` returning `handleApiError(err)`.

## Types

- No explicit `any`.
- Prefer types inferred from the zod schemas in `src/lib/validation` over
  hand-written duplicates.

## Async and error handling

- No unhandled promise rejections.
- A failure the user can see surfaces a message — never a silent no-op.

## Data model

- No change to `prisma/schema.prisma` without a matching migration in
  `prisma/migrations`.
- New models are farm-scoped unless there is a stated reason not to be.

## Out of scope

Don't review: `prisma/migrations/`, `src/generated/`, `package-lock.json`,
and the standalone `.html` mockups at the repo root.

## What is automated vs. not

CI (`.github/workflows/ci.yml`) enforces formatting, ESLint, TypeScript and
tests only. Everything above — especially tenant isolation — is checked by
CodeRabbit and by human judgment.
