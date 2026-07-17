## Parent PRD

#43

## Type

AFK — an agent can implement, verify, and merge this slice without human input. Every gate is automated or observable.

## What to build

Allow a second independently verified personal token to discover and act on invited signing work without opening a process-link token. The partner can review only the latest source PDF and fields assigned to its normalized email, then complete with typed/drawn signature, request changes with a required comment, or decline with a reason and optional comment.

Use separate test fixtures for completion, change-request, and decline because these branches are mutually exclusive. Reuse current signer authorization, verification-equivalence, field projection, signature-reuse consent, signing date, notifications, finalization, completed-document, audit, and terminal-state domains.

## Assumptions

- Issue #48 produces a correctly prepared and sent two-party envelope.
- Both creator and partner independently generated Agentic tokens through the established onboarding/lifecycle slices.
- Existing process-link signing behavior remains compatible and is not replaced.

## Out of scope for this issue

- Creator revision after change request; issue 7 completes that loop.
- Creator cancel/expire/delete and retention controls.
- Acting for a recipient whose normalized email differs from the token principal.
- Threaded negotiation, creator replies, or stronger certified-signature claims.

## Acceptance criteria

- [ ] An invited normalized-email token discovers its active signing task through the catalog without receiving/exposing a process signing token — [test: signer catalog/recovery]
- [ ] The token reads only the latest source PDF and fields assigned to its email; other recipients, creator-only identities, outsiders, revoked tokens, deleted documents, and inactive tasks are denied — [test: signer authorization matrix]
- [ ] Typed/drawn completion validates required values, fixes the date on the server, obeys explicit signature-reuse consent, updates recipient/envelope state, and records agent attribution — [test: partner completion]
- [ ] When all signers complete, creator and signer tokens obtain completed detail/final PDF access and existing completion-email routing remains correct — [test: finalization/delivery]
- [ ] Change request requires a non-empty comment, transitions to changes requested, blocks completion, notifies the creator, and returns current allowed actions — [test: change-request branch]
- [ ] Decline requires a reason, accepts an optional comment, creates the terminal declined state, and blocks subsequent signing — [test: decline branch]
- [ ] Completion, change request, and decline each replay idempotently without duplicate values, notifications, audits, or transitions — [test: signer command replay]
- [ ] Reusing one key for a different signer command/payload returns `IDEMPOTENCY_CONFLICT` without executing the second intent — [test: cross-command conflict]
- [ ] Stable errors distinguish not found, wrong identity, inactive, completed, changes requested, declined, expired, deleted, revoked token, and invalid input with recovery metadata — [test: signer error catalog]
- [ ] Partner reads/actions audit normalized email plus token ID/name and never expose raw Bearer/process credentials — [test: signer audit/redaction]
- [ ] OpenAPI and `/agent.md` cover task discovery, assigned-content boundaries, all three decisions, polling, completion, and recovery — [test: contract publication]
- [ ] A multi-token integration smoke uses a creator token to send and a partner token to complete, then downloads the same final PDF through both identities — [test: partner completion integration smoke]
- [ ] Isolated integration tests demonstrate change-request and decline without reusing terminal fixtures — [test: partner decision branch suite]

## How to verify

1. Run `pnpm test -- -t "agent partner completion"`; discovery, assigned-content, signing, finalization, and downloads pass.
2. Run `pnpm test -- -t "agent partner change request"`; comment, notification, blocked completion, idempotency, and errors pass.
3. Run `pnpm test -- -t "agent partner decline"`; terminal decline, idempotency, and further-action denial pass.
4. Run `pnpm test -- -t "agent API contract"`; signer OpenAPI/guidance/error assertions pass.
5. Run `pnpm types`.
6. Run `pnpm test`.
7. Run `pnpm lint`.
8. Run `pnpm build`.

## Blocked by

- Blocked by #48

## User stories addressed

- User stories 17–19
- User stories 28–31
- User story 34
- User stories 35–41
