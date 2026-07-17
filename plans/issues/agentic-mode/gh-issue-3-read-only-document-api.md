## Parent PRD

#43

## Type

AFK — an agent can implement, verify, and merge this slice without human input. Every gate is automated or observable.

## What to build

Give an active personal token a safe read-only view of documents available to its verified email. The tracer starts at Bearer authentication, reuses current creator/signer authorization gateways, and ends with catalog search/filter/pagination, role-aware detail/status/allowed actions/history, and authorized completed-detail/final-PDF download.

Extend runtime schemas, `/openapi.json`, `/agent.md`, error recovery, audit attribution, and redaction for each read resource. Do not expose browser cookies, sender/signer/final-link tokens, internal headers, raw security-audit rows, or unrelated document existence.

## Assumptions

- Issue #45 supplies stable token validation, revocation, safe metadata, management separation, audit attribution, and credential redaction.
- Existing My Documents catalog, creator/signer gateways, final-document lookup, R2 access, status/history projections, and retention logic remain domain truth.
- Existing browser/process-link routes remain supported and unchanged.

## Out of scope for this issue

- Draft creation and every document mutation.
- Source-PDF preparation downloads for active drafts/signing tasks.
- Signature profiles, recipients, fields, signing actions, or creator controls.
- Final calibrated rate thresholds; this slice provides documented polling/error primitives only.

## Acceptance criteria

- [ ] The catalog includes only retained documents where the principal email is creator or signer, with search, combined role/state filters, action-first ordering, and pagination parity with My Documents — [test: role-aware catalog query/projection]
- [ ] Mixed-case variants normalize to the same identity while unrelated emails and guessed document IDs reveal no catalog/detail/PDF data — [test: normalization and isolation]
- [ ] Creator-only, signer-only, and dual-role principals receive the correct role and currently allowed read actions — [test: role matrix]
- [ ] Document detail returns lifecycle status, server-derived allowed actions, retention projection, and user-facing history without process credentials or internal security events — [test: detail/status projection]
- [ ] Authorized completed creators/signers can stream the final PDF; outsiders, revoked tokens, deleted documents, and unavailable objects return stable errors without bytes — [test: final-document/R2 authorization]
- [ ] Deleted documents immediately disappear from or deny catalog, detail, status, history, and final-PDF access for every token — [test: deleted-document visibility]
- [ ] Every sensitive read records normalized email, stable token ID/name, agent actor type, document ID, and event type without credentials — [test: read audit attribution]
- [ ] Read failures return stable code/status plus applicable retryability, allowed actions, and recovery URL without requiring prose parsing — [test: agent error contract]
- [ ] `/openapi.json` includes every read route, Bearer security requirement, filter/pagination schema, binary response, and runtime error union without drift — [test: OpenAPI/runtime parity]
- [ ] `/agent.md` explains identity confirmation, catalog discovery, role boundaries, polling, completed download, and recovery from revoked/deleted/unavailable states — [test: public guidance contract]
- [ ] A curl-compatible integration smoke lists creator/signer work, inspects detail/status/history, downloads an authorized completed PDF, and denies an outsider token — [test: read-only document integration smoke]

## How to verify

1. Run `pnpm test -- -t "agent read-only documents"`; catalog, role, detail, status, history, download, and outsider scenarios pass.
2. Run `pnpm test -- -t "agent API contract"`; OpenAPI/runtime and machine-error assertions pass.
3. Run `pnpm test -- -t "agent credential redaction"`; no read path leaks credentials or internal audit data.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.
7. Run `pnpm build`.

## Blocked by

- Blocked by #45

## User stories addressed

- User stories 17–19
- User story 27
- User story 34
- User stories 36–41
