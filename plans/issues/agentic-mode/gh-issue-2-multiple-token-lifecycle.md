## Parent PRD

#43

## Type

AFK — an agent can implement, verify, and merge this slice without human input. Every gate is automated or observable.

## What to build

Extend the verified Agentic console into a complete personal token manager. A user can create up to five named active tokens, identify them through safe metadata, and revoke one without affecting the others. Revocation must invalidate the very next `/api/v1` request. Active tokens remain valid until revoked; revoked non-secret metadata remains auditable and does not count toward the active limit.

Keep credential management behind the dedicated freshly verified browser session. A Bearer token must never generate, list, or revoke tokens. Creation and revocation must not send transactional email.

## Assumptions

- Issue #44 supplies the Agentic access-link/session authority, one-token generator, Bearer identity endpoint, audit attribution, and redaction harness.
- A fresh Agentic verification is required whenever the 15-minute management session is missing or expired.
- The existing token secret format and hash-only persistence contract must not change.

## Out of scope for this issue

- Token scopes, automatic expiration, refresh tokens, rotation protocols, rename, or token-record deletion.
- Bearer-authorized token management or token lifecycle emails.
- Document resources beyond the identity response.
- CLI credential storage or keychain integration.

## Acceptance criteria

- [ ] The console lists token name, safe prefix/trailing display, creation time, last-used time, and active/revoked status without raw secrets or hashes — [test: token metadata API and console projection]
- [ ] Five active tokens can be generated; the sixth returns a stable limit error; revoking one permits exactly one replacement — [test: five-token boundary]
- [ ] Two or more named tokens authenticate independently, and revoking one leaves every other active token usable — [test: independent credential lifecycle]
- [ ] A revoked token's very next identity request returns the stable revoked/unauthorized error — [test: immediate revocation]
- [ ] An unrevoked token remains active after the 30-minute link and 15-minute management-session boundaries pass — [test: time-controlled non-expiring token]
- [ ] Bearer credentials are rejected by token generation/list/revocation endpoints; a live same-origin management session is required — [test: management authorization matrix]
- [ ] Revoked metadata remains visible through the verified console, is excluded from the active limit, and contains no raw secret/hash — [test: revoked metadata projection]
- [ ] Token creation and revocation produce no transactional email call or email send record — [test: email boundary]
- [ ] Create/revoke security events contain normalized email plus safe token identity metadata and omit every raw credential — [test: security audit and redaction]
- [ ] Console states cover loading, empty list, active limit, one-time secret, copy success/failure, revoke confirmation, expired management session, and API failure with accessible controls/status — [test: component state and accessibility]
- [ ] An integration smoke creates five tokens, revokes one, proves it fails immediately, and proves the other four remain valid — [test: token lifecycle integration smoke]

## How to verify

1. Run `pnpm test -- -t "agent token lifecycle"`; cap, independent use, revocation, non-expiry, email, and audit scenarios pass.
2. Run `pnpm test -- -t "agent token console"`; safe metadata and accessible UI states pass.
3. Run `pnpm test -- -t "agent credential redaction"`; no newly added path leaks raw secret/hash material.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.
7. Run `pnpm build`.

## Blocked by

- Blocked by #44

## User stories addressed

- User story 6
- User stories 9–14
- User stories 38–39
