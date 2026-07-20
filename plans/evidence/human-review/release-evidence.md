# Human Review Release Evidence

Date: 2026-07-20  
Issue: #62

## Acceptance-criterion ledger

| # | Acceptance criterion | Status | Exact evidence |
| ---: | --- | --- | --- |
| 1 | All five protected actions retain public-boundary RED tracers | Verified | `red-green.md`; named sign/complete, decline, cancel, expire, and delete tests retain the pre-change failure and current GREEN assertion. |
| 2 | Every protected mutation returns one idempotent `202` with no pre-approval side effect | Verified | `agent-self-sign.test.ts`, `agent-partner-completion.test.ts`, `agent-partner-decline.test.ts`, `agent-creator-controls.test.ts`; full suite. |
| 3 | Exact replay returns one command/notification; changed reuse conflicts | Verified | `agent-self-sign.test.ts` replay/conflict; `human-review.test.ts` one-email sent/failure replay cases. |
| 4 | Intent contains every required binding and no raw secret | Verified | `agent-self-sign.test.ts` asserts command/key/fingerprint/principal/token/reviewer/field/document/title/source/version/hash/operation/payload/time/decision bindings and raw-token absence; generated migrations 0021–0023. |
| 5 | Exact 24-hour active/expired boundary | Verified | `human-review.test.ts` at expiry minus 1 ms, exact decision expiry, and exact polling expiry with controlled clock. |
| 6 | Server-selected safe Resend/fallback notification, one delivery, and non-authorizing failure | Verified | `human-review.test.ts` persist-before-send, recipient/content redaction, provider evidence, replay count, failed pending queue, and notification audit state. |
| 7 | Matching My Documents identity only; passwordless returns to same intent | Verified | `human-review.test.ts`, `history-access.test.ts`, request/confirmation component tests; `browser-smoke.md` fallback/passwordless return and queue evidence. |
| 8 | Meaningful accessible review UI and explicit approve/reject/not-now | Verified | `human-review-page.test.tsx`, `history-human-review-queue.test.tsx`; three retained browser screenshots and terminal-focus observation in `browser-smoke.md`. |
| 9 | Approval revalidates bindings/token/lifecycle and stable mismatches execute nothing | Verified | 17-case `human-review.test.ts`: source, lifecycle, document, payload, revoked token, role, assigned field, rejection, expiry, repeated decision, forbidden identity, and execution-failed terminal behavior. |
| 10 | Concurrent approval/replay executes at most once with one terminal result | Verified | `human-review.test.ts` racing decisions plus exact replay/poll; signing field/final document and exact action audit counts. |
| 11 | Audit distinguishes intent, delivery, human decision, execution/failure without secrets | Verified | Action-specific Agent audit assertions across completion/decline/cancel/expire/delete; `human-review.test.ts` notification, approved/executed/failed history rows and credential canaries; `security-audit-release.test.ts`. |
| 12 | Existing browser signing/creator controls remain usable and all gates pass | Verified | `manual-smoke-page.test.tsx`, `history-creator-controls.test.tsx`, retained prior browser artifacts; `pnpm types`, `pnpm test`, `pnpm lint`, `pnpm build` all exit 0. |
| 13 | Agent guide/OpenAPI/README/PRD/console/smoke/calibration/demo evidence match | Verified | Public contract/release tests, capability matrix, `human-review-prd.md`, supervised scripts, `browser-smoke.md`; OpenAPI publishes pending/terminal/failed schemas and exact-token command polling. |
| 14 | Current OpenAI policy review with no unsupported legal/compliance claim | Verified | Policy review below; public guidance prohibits abuse/evasion and documentation explicitly disclaims legal compliance, certified/qualified signatures, and legal advice. |

## OpenAI policy review

Reviewed the current official [OpenAI Usage Policies](https://openai.com/policies/usage-policies/) and [ChatGPT agent policy guidance](https://openai.com/policies/using-chatgpt-agent-in-line-with-our-policies/) on 2026-07-20.

- The feature does not provide instructions for fraud, impersonation, illegal activity, safeguard evasion, or abuse. Public guidance explicitly prohibits those uses and requires the agent to remain within the authorized user goal.
- The server does not accept agent-supplied reviewer identity or approval and does not expose a bypass. Exact normalized-email role checks, source/payload/token bindings, expiry, conditional execution, and same-origin decisions preserve meaningful human control.
- OpenAI policy prohibits automated high-stakes decisions in sensitive areas without human review. Signmos does not decide a person's eligibility or outcome in a sensitive domain; for legally meaningful signature/destructive actions it nevertheless requires explicit matching-human approval of the exact action and current document.
- Residual risk: a human can approve a deceptive or unlawful document outside what application metadata can determine. The UI and `/agent.md` warn against fraud, impersonation, deception, rights violations, prohibited high-stakes automation, and safeguard evasion; legal/content moderation remains outside this lightweight e-signature scope.

Conclusion: no abuse/evasion enablement identified in the implemented feature or its public guidance; the human-review design materially narrows unauthorized or mistaken agent execution.

## Verification ledger

| Command | Result |
| --- | --- |
| `pnpm db:generate:dev` | Exit 0; migration 0023 generated after the terminal-review title snapshot addition. |
| `pnpm db:migrate:dev` | Exit 0; generated migrations applied to the configured development database. |
| `pnpm types` | Exit 0. |
| `pnpm test` | Exit 0; 94 files, 396 tests passed. |
| `pnpm lint` | Exit 0; 296 files checked, no fixes needed. |
| `pnpm build` | Exit 0; production client and SSR bundles built. |
| Configured local browser smoke | PASS; exact pending/review/Not now/queue/approve/focus/poll/final-PDF flow retained in `browser-smoke.md`; temporary token revoked. Real Resend inbox delivery was not used, and no claim says otherwise. |
