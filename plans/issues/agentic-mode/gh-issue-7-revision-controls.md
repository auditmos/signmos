## Parent PRD

#43

## Type

AFK — an agent can implement, verify, and merge this slice without human input. Every gate is automated or observable.

## What to build

Complete the Bearer-authenticated non-happy-path lifecycle. A creator token sees a partner change request, uploads a revised PDF, proves stale fields/values are cleared, prepares new fields, resends, and allows the partner token to complete against only the revised content.

Add creator cancel/expire/delete and retention inspection with current lifecycle rules. Deletion must immediately revoke every creator, signer, process-link, history-session, Bearer catalog/detail/PDF/action path and remove/revoke stored artifacts as the existing domain requires.

## Assumptions

- Issue #49 supplies sent, completed, changes-requested, and declined agent workflows with separate creator/partner tokens.
- Existing revision, field clearing, creator controls, R2 deletion, process-link revocation, retention, audit, notification, and allowed-action behavior remains authoritative.
- Current seven-day process-link and 90-day retention policies remain unchanged.

## Out of scope for this issue

- Threaded negotiation or creator replies to change requests.
- Restoring declined, expired, or deleted documents.
- Changing retention/link durations.
- Final rate-limit calibration, full parity matrix, and compatibility release evidence; issue 8 owns these.

## Acceptance criteria

- [ ] The creator token sees the first change-request comment, changes-requested status, and server-derived recovery actions while unrelated identities do not — [test: creator recovery projection]
- [ ] Only the creator uploads a valid revised PDF in the allowed state; it becomes current and preserves source hash/version/storage metadata — [test: revision authorization/storage]
- [ ] Revision clears every stale field/value tied to the previous source and blocks resend until required fields are replaced — [test: field-clearing invariant]
- [ ] Re-placement/resend creates fresh eligible partner delivery without duplicate recipients or stale signing authority — [test: resend after revision]
- [ ] The partner token reads only revised source/fields and completes a final PDF containing revised—not stale—content/values — [test: full revision completion]
- [ ] Creator cancel/expire works only in server-approved states, stops signing, returns terminal status/allowed actions, and preserves eligible retained history — [test: cancel/expire state matrix]
- [ ] Creator delete removes/revokes artifacts as required and immediately denies every creator, signer, process-link, history-session, and Bearer access path — [test: deletion/cross-channel revocation]
- [ ] Retention inspection observes the existing terminal-state rules and exact 90-day eligibility boundary — [test: time-controlled retention boundary]
- [ ] Signer-only and unrelated tokens cannot revise, resend, cancel/expire, delete, or inspect creator-only retention data — [test: creator-control authorization]
- [ ] Revision, re-placement, resend, cancel/expire, and delete reject missing keys, replay exact requests safely, and reject changed-request reuse without duplicate/destructive side effects — [test: creator command idempotency]
- [ ] Blocked lifecycle errors enumerate current allowed actions and remain aligned with OpenAPI/guidance — [test: lifecycle error contract]
- [ ] Revision/control audit evidence includes normalized creator email plus token ID/name and excludes credentials — [test: audit/redaction]
- [ ] A multi-token integration smoke completes request changes → revise → replace fields → resend → partner complete → final download with Bearer auth only — [test: revision-loop integration smoke]
- [ ] A separate control smoke proves cancel/expire and delete revoke all expected access paths — [test: creator-control integration smoke]

## How to verify

1. Run `pnpm test -- -t "agent revision loop"`; change request, revised storage, clearing, resend, and completion pass.
2. Run `pnpm test -- -t "agent creator controls"`; authorization, cancel/expire, delete, cross-channel revocation, and retention boundaries pass.
3. Run `pnpm test -- -t "agent command idempotency"`; every new creator command passes replay/conflict coverage.
4. Run `pnpm test -- -t "agent API contract"`; revision/control OpenAPI/guidance/error assertions pass.
5. Run `pnpm types`.
6. Run `pnpm test`.
7. Run `pnpm lint`.
8. Run `pnpm build`.

## Blocked by

- Blocked by #49

## User stories addressed

- User story 21
- User story 24
- User stories 26–33
- User stories 35–41
