# Human Review RED → GREEN Evidence

Date: 2026-07-20  
Issue: #62

Each retained public-boundary test below was introduced or changed to demand pending review before the production route was changed. The RED observation records the pre-change behavior; the same named test is retained green in the suite.

## Protected-action RED tracers

| Protected action | Retained RED test | Pre-change failure | GREEN behavior |
| --- | --- | --- | --- |
| Sign/complete | `agent self-sign lifecycle > queues self-sign completion for human review without signing the document`; `agent partner completion > queues partner completion for human review without signing the document` | Expected `202`; route returned `200` and persisted signature/finalization immediately. | One pending command; envelope/fields/final PDF unchanged until matching-signer approval. |
| Decline | `agent partner decline > queues decline for human review without declining the document` | Expected `202`; route returned the immediate declined result and changed the envelope. | Pending command leaves recipient/envelope active; approval invokes the existing decline boundary once. |
| Cancel | `agent creator controls > queues creator cancel for human review without canceling the document` | Expected `202`; route returned the immediate control result and changed lifecycle state. | Pending command preserves current status; matching-creator approval invokes `controlEnvelope` once. |
| Expire | `agent creator controls > queues creator expiration for human review without expiring the document` | Expected `202`; route returned the immediate control result and expired the envelope. | Pending command preserves current status; matching-creator approval expires once. |
| Delete | `agent creator controls > queues eligible creator deletion for human review without deleting artifacts` | Expected `202`; route immediately deleted eligible persistence/R2 artifacts. | Pending command preserves all artifacts/access; matching-creator approval revalidates retention and deletes once. |

## Vertical slices

1. **Pending self-sign command tracer**
   - RED command: `pnpm exec vitest run src/hono/api/agent-self-sign.test.ts`
   - GREEN: pending schema/authority, exact replay/conflict, current PDF/field binding, exact-token status polling, and zero pre-approval side effects.
2. **Human identity, review, and server-side execution**
   - RED: `human-review.test.ts` denied unauthenticated/wrong-email access but no matching-human decision route existed.
   - GREEN: matching My Documents identity can inspect and explicitly approve/reject; approval conditionally claims and invokes existing completion behavior; terminal polling/replay are identical.
3. **Notification and My Documents discovery**
   - RED: pending intent had no Resend/fallback notification or matching-email queue.
   - GREEN: `human-review.test.ts` proves persist-before-send, safe server-selected recipient/content, one delivery, observable failure, and normalized-email queue isolation; history UI tests prove discovery and return-to-review.
4. **Remaining protected operations**
   - RED tracers are retained in `agent-partner-decline.test.ts`, `agent-partner-completion.test.ts`, and `agent-creator-controls.test.ts`.
   - GREEN: each queues first and executes only through the existing signing, decline, or creator-control domain boundary after action-specific approval.
5. **Adversarial, temporal, and concurrency boundaries**
   - RED cases: wrong reviewer, source/lifecycle/payload/token/role/assigned-field change, exact expiry, repeated/rejected decision, and racing approvals.
   - GREEN: the 17 `human-review.test.ts` cases prove stable rejection/expiry/invalidation/forbidden/already-decided/execution-failed outcomes, active-at-expiry-minus-1-ms, expired-at-exact-boundary, and at-most-one mutation/result.
6. **Public contract, smoke, and release evidence**
   - RED: public contract tests and the live smoke still required immediate `200` completion.
   - GREEN: OpenAPI/guidance contract tests require `202` pending plus terminal replay, and `agentic-smoke.test.ts` proves no final PDF before browser review, matching-human pause, originating-token polling, and final download.

Latest focused GREEN command: `pnpm exec vitest run src/hono/api/agent-self-sign.test.ts src/hono/api/human-review.test.ts src/hono/api/agent-creator-controls.test.ts src/components/history/human-review-page.test.tsx` — 4 files, 32 tests passed. Aggregate GREEN: `pnpm test` — 94 files, 396 tests passed.
