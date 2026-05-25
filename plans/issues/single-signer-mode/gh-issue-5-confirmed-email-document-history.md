## Parent PRD

#28

Local source: `plans/single-signer-mode-prd.md`

## Type

AFK

## What to build

Add a confirmed-email document history table showing documents involving the confirmed normalized email. The history window is based on envelope creation date and covers the last 30 days. It includes completed, in-progress, and draft envelopes; labels rows as self-signed or signed with a partner; supports state filtering; and exposes resume or completed-document actions where allowed.

## Assumptions

- Issue 1 is complete: email confirmation gates access to user-linked data.
- Issue 4 is complete: completed self-sign documents have detail/download behavior.
- The existing envelope lifecycle statuses can identify draft, in-progress, and completed documents.

## Out of scope for this issue

- Do not implement creator cancel/delete actions; those are handled by the next slice.
- Do not change underlying retention or deletion policies.
- Do not add account settings, password login, teams, or organizations.
- Do not expose documents before email confirmation.

## Acceptance criteria

- [ ] History is inaccessible before the user confirms ownership of the email for the current session — [test: history access-control test]
- [ ] Confirmed history includes envelopes involving the normalized email as creator or signer and excludes unrelated envelopes — [test: history query integration test]
- [ ] History includes only envelopes created within the last 30 days based on creation date — [test: time-controlled history-window test]
- [ ] History can include completed, in-progress, and draft envelopes — [test: history status coverage test]
- [ ] History table supports filtering by document/envelope state — [test: history table UI filter test]
- [ ] Each row labels the document as self-signed or signed with a partner — [test: history row label test]
- [ ] Completed rows expose a path to detail/download and return the completed PDF through existing access rules — [test: completed history action test]
- [ ] Draft and in-progress rows expose a resume action leading to the appropriate current step — [test: resume action browser test]
- [ ] Mixed-case email variants resolve to the same history identity — [test: normalized-email history test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

## How to verify

1. Run history access-control tests for unconfirmed and confirmed sessions.
2. Run history query tests covering creator, partner signer, unrelated email, and mixed-case emails.
3. Run time-controlled tests around the 30-day creation-date boundary.
4. Run history table UI tests for status filtering and mode labels.
5. Run browser tests for completed download/detail and draft/in-progress resume actions.
6. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

## Blocked by

- Blocked by #29
- Blocked by #32

## User stories addressed

- User story 19
- User story 20
- User story 21
- User story 22
- User story 23
- User story 24
- User story 25
