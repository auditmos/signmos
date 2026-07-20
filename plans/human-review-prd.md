# Human Review Amendment

Date: 2026-07-20  
Issue: #62  
Amends: `plans/agentic-mode-prd.md` and `plans/agentic-mode.md`

## Decision

Agentic sign/complete, decline, creator cancel, creator expire, and eligible creator delete no longer execute directly. A valid Bearer request atomically persists an exact, 24-hour human-review intent and returns HTTP `202 pending_human_review`. The protected document action runs only after the server-derived matching signer or creator approves it through an active normalized-email My Documents session.

Send, resend, change request, preparation, and read operations retain their existing authorization, lifecycle, and idempotency behavior. This amendment supersedes the earlier decision that all high-impact actions execute immediately and the earlier exclusion of human approval protocols.

## Product contract

1. The Agent request supplies the action payload and Idempotency-Key, never reviewer identity or approval.
2. The response contains `commandId`, `status`, `reviewUrl`, `statusUrl`, `expiresAt`, and `notificationStatus`; exact retries return the same command without duplicate notification.
3. The reviewer is derived from current document authority: assigned signer for sign/decline and creator for cancel/expire/delete.
4. The intent binds the originating personal token, normalized principal email, operation, exact payload digest, document, current source PDF id/version/SHA-256, reviewer role, and assigned recipient where applicable.
5. The review is active immediately before 24 hours and expired at or after the exact boundary. A changed source, payload binding, token authority, or reviewer role invalidates it.
6. Notification is sent once to the server-derived reviewer and contains only safe action/document/agent/expiry context. Provider failure leaves the intent pending and non-authorizing with a My Documents fallback.
7. An unauthenticated reviewer enters the existing passwordless My Documents flow and returns to the same validated review path after redemption.
8. The human page shows the current PDF, assigned fields, exact proposed payload, agent name, consequence, expiry, and three unselected actions: approve and execute, reject, or not now.
9. Approval is conditionally claimed from pending state before execution. Concurrent approvals can execute the protected action at most once.
10. Rejection, expiry, invalidation, forbidden access, repeated decisions, and approved execution failure expose stable `HUMAN_REVIEW_*` machine codes. Terminal results are pollable only by the exact originating token; execution failure is terminal rather than an indefinite in-progress command.

## Security and accessibility

- Review URLs are opaque identifiers and still require a matching verified session; guessed or wrong-email access returns the same non-disclosing response.
- Passwordless return paths are restricted to local `/human-review/{uuid}` paths to prevent open redirects.
- Notification failure, email delivery, link possession, or command polling never grants approval authority.
- Protected actions are audited as agent intent creation and notification delivery state, human review opened/PDF opened/approved/rejected/executed, and the exact agent/document event after actual execution.
- Pending, error, and terminal states use live regions or alerts; terminal focus moves to the result; controls use native buttons/links and visible keyboard focus.

## Release acceptance

Every protected action must have automated evidence for pending-without-side-effect and approved execution. Cross-cutting tests must cover normalized reviewer isolation, exact 24-hour behavior, source/payload/token/role invalidation, single execution under concurrent approval, safe notification and failure fallback, exact-token polling, passwordless return, current-PDF/field projection, rejection, and accessible UI states. Release evidence must enumerate each criterion as verified, failing, or unverified.

## Smoke and demo flow

1. Start a configured environment and create a temporary personal token for the same email that will review the document.
2. Run `pnpm agentic:smoke`. The Agent creates, uploads, and prepares a self-sign document, then receives `202 pending_human_review`; the script proves no final PDF exists.
3. Open the printed `reviewUrl` in a browser. Complete My Documents passwordless verification if needed, inspect the current PDF, assigned fields, exact signature payload, agent name, consequence, and expiry, then choose **Approve and execute**.
4. The script emits heartbeats while the originating token polls `statusUrl`, verifies the terminal result and final PDF, and then runs the retained protected-operation integration files. The completed live fixture remains subject to normal retention controls.
5. `pnpm agentic:calibrate` is likewise supervised: every sample pauses for matching-human review and its fixture remains under normal retention controls. Do not present historical pre-amendment calibration or smoke evidence as proof of the new review boundary.
