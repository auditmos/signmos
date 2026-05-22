# signmos Agent Map

Signmos is a lightweight e-signature workflow on TanStack Start, Hono, Cloudflare Workers, Neon Postgres, Drizzle, and Cloudflare R2.

Use this file as the always-loaded map. Load deeper docs only when the task touches that area.

## Start Here

| Need | Read |
| --- | --- |
| Product scope, lifecycle contract, validation checklist | `plans/simple-esignature-prd.md` |
| Physical code map, boundaries, invariants | `ARCHITECTURE.md` |
| Agent workflow and coding rules from `.claude/rules` | `docs/AGENT_GUIDE.md` |
| Manual setup, API examples, smoke flow | `README.md` |
| Current implementation plan and issue drafts | `plans/simple-esignature.md`, `plans/issues/` |
| Compact LLM index | `llms.txt` |

## Current Product Surface

- Draft envelope creation, one source PDF upload under 10 MB, recipients, signature/date fields, send, signer links, signer completion/decline, final PDF status/download.
- `/manual-signing-smoke` is the local browser smoke path for create -> prepare -> send -> sign -> final PDF.
- `/envelope-fields` is a field placement/review screen, not a full envelope dashboard.
- Email delivery is represented by persisted send records and API-returned signing links; production email UI is not complete.

## Issue Implementation Workflow

1. Fetch the live issue before implementing: `gh issue view <number> --json number,title,body,state,labels,url`.
2. Read `plans/simple-esignature-prd.md`, `plans/simple-esignature.md`, and the matching local file in `plans/issues/` when present.
3. Load the local TDD skill for the implementation process. Do not duplicate that workflow in repo docs.
4. Final status must enumerate verified, failing, and unverified acceptance criteria with evidence.

Open issue state changes, so do not hardcode issue status from memory.

## Where Work Usually Goes

- API routes: `src/hono/api/*`
- Envelope persistence and lifecycle behavior: `src/db/envelope/*`
- Worker entry and API/app routing: `src/server.ts`
- Field placement UI: `src/routes/envelope-fields.tsx`, `src/components/envelopes/*`
- Signer UI and manual smoke path: `src/routes/signing.$token.tsx`, `src/routes/manual-signing-smoke.tsx`, `src/components/signing/*`
- Styling primitives: `src/components/ui/*` are generated Shadcn files; do not edit manually.

## Non-Negotiables

- Prefer deep modules: narrow public interfaces, more private implementation behind them.
- On TanStack UI surfaces, default to TanStack Form for field state and validation, and TanStack Query mutations/queries for async server state. Use React `useState` only for truly local UI toggles or browser-only primitives that do not belong in Form/Query state; do not wire every textbox manually with `useState`.
- Tests live next to source as `*.test.ts` or `*.test.tsx` and verify behavior through public boundaries.
- Mock only external boundaries: DB, R2, network, time, randomness, browser APIs.
- Do not edit generated files: `src/routeTree.gen.ts`, generated migrations, `worker-configuration.d.ts`, or `src/components/ui/*`.
- Keep source files under 500 lines.
- Do not use `any`; use explicit types, `unknown` plus narrowing, or schema-derived types.
- For long-running scripts, add visible heartbeat output with flushing before asking a user to run them.
- Do not quote performance or resource estimates without measurement.

## Commands

```bash
pnpm dev
pnpm types
pnpm test
pnpm lint
pnpm build
pnpm db:generate:dev
pnpm db:migrate:dev
```

## Verification

Before declaring code changes ready, run:

```bash
pnpm types
pnpm test
pnpm lint
pnpm build
```

If any check is not run or does not pass, say exactly which acceptance criteria remain unverified and why.
