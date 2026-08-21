# Review guidelines

These apply to every pull request into `main`. CodeRabbit reads this file
(see `.coderabbit.yaml` → `knowledge_base.code_guidelines`), and human
reviewers should work through the same list.

## Tenant isolation (highest priority)

The app is multi-tenant: every farm-owned record belongs to a farm. A query
that loses its scope silently exposes one farm's data to another, and neither
TypeScript nor ESLint can catch it.

Two patterns are correct, and a query matching neither is a bug:

1. `farmId` appears directly in the `where` clause.
2. For a mutation addressed by id, the function first runs
   `findFirst({ where: { id, farmId } })` and throws when it returns null —
   see [expenses.ts](src/lib/services/expenses.ts). The following
   `update`/`delete` by id is then already proven to be in scope.

Child records (`MotherHenLog`, `IncubationGrowthLog`) are scoped through their
parent using pattern 2: verify the parent belongs to the farm, then write.

Exempt by design: `auth.ts` (`User`, `PasswordResetToken`) and
`listFarmsForUser` (scoped by `userId`) operate above the farm level.

## API route contract

`src/app/api/**/route.ts` follows one shape — see
[expenses/route.ts](src/app/api/expenses/route.ts) as the reference:

1. A guard from `src/lib/session` first. All three are valid depending on what
   the route addresses: `requireActiveFarmApi()` for the current farm,
   `requireFarmAccessApi(farmId)` for a specific farm, `requireUserApi()` for
   user-level routes.
2. Validate the body with a zod schema from `src/lib/validation/*` via
   `safeParse`; return 400 on failure.
3. Delegate data access to `src/lib/services/*` — no `prisma` import in a
   route handler.
4. Wrap the body in `try/catch` returning `handleApiError(err)`.

Routes under `src/app/api/auth/` are intentionally public — registration,
password reset, and the NextAuth handler have no guard by design.

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
- New farm-owned models carry `farmId`. Global models (`User`, `Farm`,
  `PasswordResetToken`) and models scoped through a parent relation are fine
  without it.

## Out of scope

Don't review: `prisma/migrations/`, `src/generated/`, `package-lock.json`,
and the standalone `.html` mockups at the repo root.

## What is automated vs. not

CI (`.github/workflows/ci.yml`) enforces formatting, ESLint, TypeScript and
tests only. Everything above — especially tenant isolation — is checked by
CodeRabbit and by human judgment.
