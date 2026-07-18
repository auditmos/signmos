# Agentic Mode Parity And Compatibility Release Evidence

Date: 2026-07-17

Release decision: **44 of 44 verified**. The story table and numeric/security-bound table contain no failing or unverified row.

Evidence owner: Signmos issue #51 TDD/release run. Status means the named automated test, retained measurement, or credential-safe browser artifact directly exercises the criterion; the final command ledger records the aggregate readiness gates.

## PRD story evidence

| Story | Requirement | Status | Named evidence |
| --- | --- | --- | --- |
| 1 | Fourth unselected Agentic landing choice | Verified | `landing-agentic-accessibility.test.tsx`; `landing-four-choices.png` |
| 2 | Email plus Turnstile human gate | Verified | `agentic-access.test.ts`; Agentic access component tests |
| 3 | Enumeration-safe response and hidden link | Verified | `agentic-access.test.ts`; browser smoke |
| 4 | Single-use 30-minute verification link | Verified | `agentic-access.test.ts`; exact lifetime tests |
| 5 | Separate 15-minute management session | Verified | `agentic-access.test.ts`; management-boundary tests |
| 6 | Safe token metadata without redisplay | Verified | `agent-token-lifecycle.test.ts`; console browser states |
| 7 | Token name and authority acknowledgment | Verified | `agent-token-lifecycle.test.ts`; `agentic-token-console.test.tsx` |
| 8 | One-time opaque 256-bit secret and hash-only persistence | Verified | `agent-token-lifecycle.test.ts`; credential redaction scan |
| 9 | Five-active-token cap | Verified | `agent-token-lifecycle.test.ts` boundary test |
| 10 | Multiple independent named tokens | Verified | `agent-token-lifecycle.test.ts` |
| 11 | Immediate next-request revocation | Verified | `agent-token-lifecycle.test.ts`; Bearer auth tests |
| 12 | Bearer cannot manage credentials | Verified | Agent management-boundary contract tests |
| 13 | No token lifecycle email | Verified | Agent token email-boundary tests |
| 14 | Personal token remains active until revoked | Verified | Time-controlled token lifecycle test |
| 15 | Bearer-only `/api/v1` authentication | Verified | `agent-contract.test.ts`; route enumeration |
| 16 | Safe `/api/v1/me` principal resolution | Verified | Bearer identity tests; credential redaction scan |
| 17 | Per-operation creator/signer role checks | Verified | Agent authorization and partner decision suites |
| 18 | Unrelated/deleted document isolation | Verified | Agent redaction/deletion/authorization suites |
| 19 | Searchable, filtered, paged role-aware catalog | Verified | `agent-read-only.test.ts`; `agent-catalog.test.ts` |
| 20 | Bearer self-sign and two-party draft creation | Verified | Agent self-sign and two-party creator lifecycle tests |
| 21 | One source PDF, revision, and 10 MB bounds | Verified | Agent source-PDF and revision-loop tests |
| 22 | List/add/edit/remove 1–10 recipients | Verified | Agent recipient contract and boundary tests |
| 23 | Typed/drawn signature profiles with consent | Verified | Agent signature-profile lifecycle tests |
| 24 | List/place/default/reposition signature/date fields | Verified | Agent field and command-idempotency tests |
| 25 | Token-authorized self-sign completion | Verified | `agent-self-sign.test.ts`; smoke lifecycle |
| 26 | Prepared send and eligible resend | Verified | `agent-two-party-delivery.test.ts`; smoke lifecycle |
| 27 | Detail, status, actions, retention, and history | Verified | Agent read-only, revision, and creator-control tests |
| 28 | Signer sees only assigned current task | Verified | Agent partner completion/authorization tests |
| 29 | Typed/drawn completion with server date | Verified | Agent partner completion tests |
| 30 | Required-comment change request | Verified | Agent partner change-request tests; revision loop |
| 31 | Decline with reason and optional comment | Verified | Agent partner decline tests |
| 32 | Revision clears stale fields and completes new content | Verified | `agent-revision-loop.test.ts` |
| 33 | Cancel/expire/delete and retention inspection | Verified | `agent-creator-controls.test.ts` |
| 34 | Creator/signer completed recovery and final PDF | Verified | Agent self-sign/partner completion tests; legacy completed browser smoke |
| 35 | Universal exact-replay/conflict idempotency | Verified | `agent-command-idempotency.test.ts`; OpenAPI route enumeration |
| 36 | Stable machine-readable errors and recovery | Verified | `agent-contract.test.ts`; public OpenAPI contract |
| 37 | Documented polling and measured rate-limit recovery | Verified | `agent-rate-limit.test.ts`; `calibration.md`; `/agent.md` contract |
| 38 | Agent actor/email/token attribution | Verified | Agent audit assertions across lifecycle suites |
| 39 | Credential redaction across operational surfaces | Verified | `agent-credential-redaction.test.ts`; `credential-redaction.md` |
| 40 | Complete unauthenticated `/agent.md` | Verified | `agentic-mode-release-contract.test.ts` guidance contract |
| 41 | Runtime-parity unauthenticated `/openapi.json` | Verified | `agentic-mode-release-contract.test.ts` route/schema drift contract |
| 42 | Platform-neutral prompt and separate copy controls | Verified | `agentic-token-console.test.tsx`; keyboard walkthrough |
| 43 | Complete matrix and runnable Bearer lifecycle smoke | Verified | `capability-matrix.md`; `pnpm agentic:smoke` exit 0 |
| 44 | Browser sender/signer/completed/My Documents compatibility | Verified | `browser-smokes.md`; `keyboard-walkthrough.md`; full test gate |

## Numeric and security bounds

| Bound | Status | Named evidence |
| --- | --- | --- |
| 30-minute verification link | Verified | Time-controlled before/exact/after expiry and single-use redemption tests |
| 15-minute management session | Verified | Time-controlled management-session boundary and isolation tests |
| five-token active credential cap | Verified | Five accepted, sixth rejected, replacement after revocation test |
| 256-bit token entropy | Verified | CSPRNG byte-length, prefix, one-time display, and hash-only persistence test |
| 10 MB source-PDF maximum | Verified | Below-limit upload and exact over-limit rejection tests |
| 1–10 recipient bounds | Verified | Recipient lower/upper/over-limit contract tests |
| seven-day process-link compatibility | Verified | Access at expiry minus 1 ms; rejection at and after exact expiry |
| 90-day retention eligibility | Verified | Creator-control exact retention boundary tests |
| universal mutation idempotency | Verified | Runtime/OpenAPI mutation enumeration plus exact replay and changed-payload conflict tests |
| immediate revocation | Verified | Next identical Bearer request denied; independent token remains active |
| credential redaction | Verified | Dynamic canary scan plus static artifact/screenshot/fixture scan reports zero leaks |
| measured rate limits | Verified | Ten samples per operation class retained; token 30/60 s and IP 150/60 s below/exact/above tests; standard `429` recovery metadata |

## Measurement and smoke observations

- Calibration used ten real lifecycle samples for each catalog/status/JSON mutation/PDF upload/PDF download/polling class on documented development Neon/R2 infrastructure. The retained report states observations and assumptions and makes no throughput or SLA claim: [calibration.md](calibration.md).
- The selected fixed-window policy is 30 requests per token per 60 seconds and 150 requests per IP per 60 seconds. These are policy boundaries chosen from the measured pilot workload, not extrapolated capacity claims.
- `pnpm agentic:smoke` completed its public-guide/OpenAPI/Bearer preflight, a live create/upload/prepare/complete/status/final-download/delete lifecycle (3,569-byte final PDF), and 13 isolated lifecycle files (30 tests) with heartbeat output and exit 0. Its temporary personal token was revoked afterward.

## Final command ledger

| Command | Result |
| --- | --- |
| `pnpm exec vitest run -t "agent API contract"` | Exit 0; 4 files, 9 tests passed |
| `pnpm exec vitest run -t "agent credential redaction"` | Exit 0; 3 files, 4 tests passed |
| `pnpm exec vitest run -t "agent measured rate-limit boundaries"` | Exit 0; 1 file, 2 tests passed |
| Exact seven-day process link plus non-expiring personal-token tests | Exit 0; 2 files, 2 selected tests passed |
| `pnpm agentic:smoke` | Exit 0; public preflight, live Bearer lifecycle, 3,569-byte final PDF, plus 13 files and 30 tests passed; fixture token revoked |
| `pnpm test` | Exit 0; 91 files, 363 tests passed |
| `pnpm types` | Exit 0 |
| `pnpm lint` | Exit 0; 281 files checked, no fixes required |
| `pnpm knip` | Exit 0 |
| `pnpm build` | Exit 0; client and SSR production builds completed |

The release commit and GitHub issue comment are the immutable index for the final SHA and issue state.
