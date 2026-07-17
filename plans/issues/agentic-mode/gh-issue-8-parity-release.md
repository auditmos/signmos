## Parent PRD

#43

## Type

AFK — an agent can implement, verify, and merge this release slice without subjective approval. Every go/no-go gate is a test, retained artifact, or runnable command.

## What to build

Turn issues #44–#50 into an evidenced public release without adding new product capability. Complete runtime-generated OpenAPI and public agent guidance, calibrate and enforce measured rate limits, verify credential redaction across operational surfaces, publish the UI-to-API capability matrix, add the complete Bearer/curl lifecycle smoke, and prove existing browser workflows remain compatible.

The final report must enumerate all 44 PRD stories and every numeric/security bound as verified, failing, or unverified. Any failing/unverified row blocks an “Agentic mode ready” claim.

## Assumptions

- Issues #44–#50 are merged and their vertical integration tests pass.
- Representative development/staging infrastructure is available for email, Turnstile, database, R2, polling, PDF, and browser evidence.
- Runtime route schemas are the intended source for `/openapi.json`.
- Existing project verification commands remain authoritative.

## Out of scope for this issue

- New document actions or changes to established lifecycle behavior.
- Token scopes, security emails, confirmation protocols, webhooks, bulk APIs, CLI, MCP, SDKs, or platform-specific prompts.
- Guessed throughput, latency, memory, or rate-limit claims without retained measurements.
- Closing or modifying parent PRD #43 automatically.
- Declaring readiness with any unverified story or numeric/security bound.

## Acceptance criteria

- [ ] A retained capability matrix maps every current UI document action to one `/api/v1` operation, required role, idempotency behavior, OpenAPI operation, `/agent.md` workflow, and named test/smoke; no row is unmapped — [observable: complete UI/API parity matrix]
- [ ] Runtime route/schema enumeration and `/openapi.json` are identical for every `/api/v1` method, path, Bearer requirement, request, response, binary body, error union, and idempotency rule — [test: OpenAPI drift contract]
- [ ] Public `/agent.md` covers identity/token handling, catalog, create/upload/prepare, send/resend, signing decisions, revision, controls, final download, errors, idempotency, polling, measured rate limits, goal-directed execution, and secret safety — [test: guidance completeness contract]
- [ ] The platform-neutral console prompt links public guidance/OpenAPI, references `$SIGNMOS_TOKEN`, contains no secret, and has accessible separate copy controls — [test: console prompt/accessibility]
- [ ] A representative calibration measures catalog/status reads, JSON mutations, PDF upload/download, and polling on documented fixtures/infrastructure; sample size, observations, and scaling assumptions are retained — [observable: calibration report]
- [ ] Numeric per-token/IP thresholds are selected from that calibration, documented with rationale, and tested below, exactly at, and above each limit — [test: measured rate-limit boundaries]
- [ ] Limited responses use stable `429` JSON plus standard limit/remaining/reset and Retry-After metadata; public guidance documents compliant polling/backoff — [test: rate-limit recovery contract]
- [ ] A credential-canary scan covers URLs, redirects, later responses, logs, errors, audits, analytics hooks, emails, public artifacts, screenshots, and release fixtures with zero raw Bearer/link/session/hash leaks — [test and observable: redaction scan/report]
- [ ] Route enumeration proves every `/api/v1` POST/PUT/PATCH/DELETE requires an Idempotency-Key and has exact-replay/conflict tests; no mutation is merely state-safe — [test: universal idempotency contract]
- [ ] `pnpm agentic:smoke` uses only a base URL, `$SIGNMOS_TOKEN`, public docs, Bearer auth, Idempotency-Key, and permitted email-link fixtures to cover self-sign, two-party, change/revision, decline, cancel/expire/delete, polling, and final download — [command: `pnpm agentic:smoke` exits 0]
- [ ] Browser smoke covers all four unselected landing choices, Agentic verification/console/token states, and unchanged sender, signer, completed-document, and My Documents flows — [observable: retained browser/keyboard evidence]
- [ ] Existing API, domain, component, release, email, PDF, retention, accessibility, and compatibility suites pass without weakened assertions — [command: `pnpm test` exits 0]
- [ ] Existing process-link tests allow access before seven days and reject at/after the exact seven-day boundary while personal Agentic tokens remain valid until revoked — [test: time-controlled lifetime compatibility]
- [ ] `pnpm types`, `pnpm lint`, and `pnpm build` all pass — [commands: project readiness checks exit 0]
- [ ] Release evidence enumerates PRD stories 1–44 and the 30-minute, 15-minute, five-token, 256-bit, 10 MB, 1–10 recipient, seven-day, 90-day, idempotency, revocation, redaction, and measured-rate criteria with named evidence/status — [observable: signed release evidence table]
- [ ] The final report says `44 of 44 verified` only if every story/bound passes; otherwise its headline states the exact verified count and blocker — [observable: release go/no-go report]

## How to verify

1. Run `pnpm agentic:calibrate`; retain the measurement report and confirm configured thresholds cite its observations/assumptions.
2. Run `pnpm test -- -t "agent API contract"`; OpenAPI, guidance, error, rate-limit, and idempotency enumerations pass.
3. Run `pnpm test -- -t "agent credential redaction"`; zero credential canaries leak.
4. Run `pnpm agentic:smoke`; all required lifecycle branches exit 0 using Bearer auth only.
5. Start the documented development/staging app and run the four-choice browser/keyboard smoke; retain the report/screenshots without credentials.
6. Run `pnpm types`.
7. Run `pnpm test`.
8. Run `pnpm lint`.
9. Run `pnpm build`.
10. Review the capability and release-evidence tables: every story/action/bound has a named verified artifact, or the release is explicitly blocked.

## Blocked by

- Blocked by #44
- Blocked by #45
- Blocked by #46
- Blocked by #47
- Blocked by #48
- Blocked by #49
- Blocked by #50

## User stories addressed

- User stories 35–44
- Regression evidence for user stories 1–34
