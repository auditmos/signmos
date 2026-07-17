## Parent PRD

#43

## Type

AFK — an agent can implement, verify, and merge this slice without human input. Every gate is automated or observable.

## What to build

Extend the Bearer creator path to two-party documents. The verified creator creates a two-party draft, uploads the PDF, manages recipients, prepares creator/partner fields, completes the sender-first signing step, sends only the eligible partner invitation, resends when permitted, and follows server-derived status/allowed actions.

Reuse issue #47's universal command idempotency and the existing recipient, sender-first, email-delivery, invitation, send-precondition, audit, and lifecycle domains. The new API must not return partner verification/signing credentials to the creator or agent contract.

## Assumptions

- Issue #47 supplies Bearer draft creation, PDF/profile/field preparation, sender signing, universal idempotency, error recovery, audit/redaction, and public contract publication.
- Existing Resend/fallback delivery, recipient, sender-first, send precondition, invitation, and status/history behavior remains authoritative.
- Partner action with its own personal token is deferred to issue 6.

## Out of scope for this issue

- Acting as the partner through `/api/v1`.
- Partner change request, decline, and revision loop.
- Creator cancel/expire/delete and retention commands.
- Exposing invitation/process tokens, webhooks, bulk sending, templates, or reminders.

## Acceptance criteria

- [ ] A Bearer principal creates a two-party draft owned by its normalized email without another verification email — [test: two-party draft creation]
- [ ] Recipient list/add/update/delete enforces normalized valid emails, the existing 1–10 bound, duplicate/invalid/over-limit errors, draft-only state, and creator-only authorization — [test: recipient API/authorization]
- [ ] Creator and partner signature/date fields can be explicit/default placed only for valid recipients with current geometry/placeholder constraints — [test: two-party field preparation]
- [ ] The creator completes its sender-first signing step before delivery through the established Bearer signing contract — [test: sender-first preparation]
- [ ] Send rejects missing source, recipients, creator completion, or recipient fields with stable allowed-action recovery metadata — [test: send preconditions]
- [ ] Successful send delivers only the eligible partner invitation, records send/audit evidence, and never sends a redundant creator signing invitation — [test: delivery routing]
- [ ] Eligible resend creates a fresh invitation/send record without duplicating recipients or bypassing lifecycle rules — [test: resend behavior]
- [ ] Creator status/history returns sent state, partner progress, and allowed actions without partner verification/signing credentials — [test: creator projection/credential isolation]
- [ ] Every create/recipient/field/profile/sign/send/resend mutation enforces missing-key rejection, exact replay, and changed-request conflict without duplicate side effects — [test: two-party idempotency matrix]
- [ ] Configured delivery-provider failure returns a stable retryable error and does not falsely mark the envelope sent — [test: email-provider boundary]
- [ ] Preparation and delivery audits identify creator email plus token ID/name and contain no raw Bearer or invitation credential — [test: audit/redaction]
- [ ] OpenAPI and `/agent.md` document two-party preparation, preconditions, send, resend, polling, and delivery errors from runtime schemas — [test: contract publication]
- [ ] A creator-only integration smoke creates, prepares, sender-signs, sends, resends, and observes the sent document using Bearer auth only — [test: two-party creator integration smoke]

## How to verify

1. Run `pnpm test -- -t "agent two-party creator"`; recipient, preparation, sender-first, send/resend, status, and provider-failure scenarios pass.
2. Run `pnpm test -- -t "agent command idempotency"`; all new mutation operations are enumerated and pass replay/conflict checks.
3. Run `pnpm test -- -t "agent API contract"`; two-party OpenAPI/guidance/error assertions pass.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.
7. Run `pnpm build`.

## Blocked by

- Blocked by #47

## User stories addressed

- User stories 20–24
- User stories 26–27
- User stories 35–41
