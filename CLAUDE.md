# Raket — Project Context for Claude

Cross-border payment platform for Filipino freelancers. Turborepo monorepo: Next.js 15 (web) + NestJS (api) + Prisma + Supabase Postgres, with `@raket/contracts` (ts-rest + Zod) as the shared wire layer.

Read the PRD for product context: [`docs/prd.md`](docs/prd.md).

For local dev setup, see [`docs/ONBOARDING.md`](docs/ONBOARDING.md).

## Conventions — read before writing code

These docs are authoritative. If something here conflicts with a convention doc, the convention doc wins; raise it for discussion instead of silently diverging.

- [`docs/api-contract-convention.md`](docs/api-contract-convention.md) — ts-rest + Zod contracts in `packages/contracts`. Source of truth for every endpoint. **Change the contract first; both sides break at compile time and that is the point.**
- [`docs/api-convention.md`](docs/api-convention.md) — NestJS vertical slices under `apps/api/src/modules/<feature>/`. Thin ts-rest controllers, services own all logic and Prisma calls, mappers at the boundary, typed errors mapped to the contract's `ErrorResponse`.
- [`docs/web-convention.md`](docs/web-convention.md) — Next.js 15 App Router with feature-driven folders under `apps/web/src/features/<feature>/`. Three component tiers: global (pure, no logic), feature (render-only + paired hook), shared `*.parts.tsx` (each part with its own hook). Hooks own all data fetching.

## TDD approach

Every behaviour-bearing change follows red → green → refactor:

1. **Red** — write a failing test that describes the behaviour. Run it; confirm it fails for the expected reason (not a typo, not a missing import). If the test doesn't fail, the test is wrong.
2. **Green** — write the smallest production code that makes the test pass. No extra branches, no speculative abstraction.
3. **Refactor** — clean up while the test stays green. Improve names, extract helpers, dedupe. Re-run the test after each refactor.

Rules of engagement:

- **Contract first.** New endpoint or shape change → update `@raket/contracts` and add a contract-level test, then drive the backend handler with an E2E test, then drive the frontend hook with a hook test.
- **Backend:** every service method gets a unit test with Prisma mocked. The demo path (create invoice → send → pay webhook → payout) has an E2E test against a real test database. See §10 of `docs/api-convention.md`.
- **Frontend:** hooks are tested with `renderHook` + a real `QueryClientProvider`; pure view components get assertion tests with props. The end-to-end demo path has one Playwright run. See §10 of `docs/web-convention.md`.
- **No test, no merge** for new behaviour. Bug fix? Write the regression test first — it should fail before the fix and pass after.
- **Tests describe behaviour, not implementation.** `it("rejects when client belongs to another user")`, not `it("calls prismaClient.invoice.findFirst")`.
- **Don't mock what you own** unless the test is genuinely about the seam. Mock external SDKs (Stripe, Anthropic, Resend) via the integration service we wrap them in; don't mock our own services unless isolating a specific layer.

Hackathon reality: if you must triage, **the demo path is non-negotiable**. Skip exhaustive unit coverage on non-demo code before skipping E2E coverage on the demo path.

## Project hooks

A `PreToolUse` hook in `.claude/settings.json` blocks Write/Edit/MultiEdit on `.ts/.tsx/.mts/.cts` files that introduce `as any`, `as unknown`, `@ts-ignore`, `@ts-expect-error`, or `@ts-nocheck`. Fix the underlying type instead of asserting; if the contract is wrong, fix `@raket/contracts` first.
