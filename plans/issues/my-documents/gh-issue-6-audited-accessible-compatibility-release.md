## Parent PRD

#36

## Type

AFK — this is an integration and release-evidence slice whose gates are automated tests, observable audit/scope artifacts, browser smokes, and repository commands.

## What to build

Integrate and verify the preceding "My documents" slices as one production-ready no-account feature. Finish the security-event stream, technical-event filtering, credential hygiene, session-protected reads/mutations, deletion races, structured errors, accessibility coverage, and compatibility with existing sender, signer, verification, completion-detail, and final-download links. Run full self-sign, two-party, and history-recovery smokes from the new landing chooser through final artifact retrieval and sign-out/recovery.

Do not add new product capability in this issue. Its purpose is to provide objective release evidence and close cross-slice gaps without broadening PRD #36.

## Assumptions

- #41 implements creator recovery and controls with passing phase-level evidence.
- #40 implements signer recovery and active signing with passing phase-level evidence.
- The access, catalog, credential/session, authorization, audit, signing, and completed-document boundaries are independently testable.
- Existing browser/API smoke paths remain available as compatibility oracles.

## Out of scope for this issue

- Do not add history features, lifecycle transitions, accounts/profiles, analytics, delivery retries, retention changes, credential migration, or new compliance claims.
- Do not make performance/capacity claims without a separately approved measured calibration.
- Do not absorb unrelated pre-existing failures; report them with the affected acceptance criteria.

## Acceptance criteria

- [ ] Security events cover issuance, redemption, expiry observation/revocation, sign-out, document open, and final PDF download with safe references and no raw credentials — [test: end-to-end history security-audit suite]
- [ ] User-facing completed-document history filters every history credential/session event while retaining normal lifecycle events — [test: user-timeline filtering regression test]
- [ ] Persistence, logs, errors, HTML, redirects, browser state, URLs, and audit output contain no raw session credential and expose raw magic-link credentials only where required — [test: credential hygiene inspection suite]
- [ ] Production cookies, referrer policy, same-origin/CSRF, fixed expiry, sign-out revocation, replay denial, and unrelated-envelope denial pass together — [test: production history-session security contract test]
- [ ] Deleted envelopes are omitted/denied at catalog, detail, source PDF, final PDF, verification-equivalence, signing, cancel, delete, and status boundaries, including stale UI — [test: cross-boundary deletion revocation suite]
- [ ] Existing sender verification/preparation, partner verification/signing, completion detail, final download, and manual smoke contracts remain unchanged outside the history path — [test: complete existing-link regression suite]
- [ ] The full self-sign browser smoke starts from the new chooser and reaches completed PDF retrieval — [test: self-sign browser smoke]
- [ ] The full two-party browser smoke starts from the new chooser and reaches partner completion and final PDF retrieval — [test: two-party browser smoke]
- [ ] The history recovery smoke covers request, debug/test link retrieval, confirmation, redemption, catalog search/filter/page, creator resume/control, signer resume/sign, completed download, sign-out, and expired recovery — [test: My documents browser smoke]
- [ ] Automated accessibility tests and a deterministic keyboard walkthrough cover every new landing, request, confirmation, recovery, catalog, dialog, signing-transition, completed, and sign-out state — [test: complete accessibility suite; observable: keyboard walkthrough checklist]
- [ ] Schema/config review finds no account/profile, linked-email identity, product analytics, automatic retry/outbox, or elevated compliance-claim surface — [test: scope-guard contract test; observable: PRD scope checklist]
- [ ] Known history failures return stable machine-readable codes/messages and recovery hints without revealing match/delivery state — [test: history error-contract suite]
- [ ] `pnpm types` exits successfully — [command: `pnpm types`]
- [ ] `pnpm test` exits successfully — [command: `pnpm test`]
- [ ] `pnpm lint` exits successfully — [command: `pnpm lint`]
- [ ] `pnpm build` exits successfully — [command: `pnpm build`]

## How to verify

1. Apply all generated development migrations using the repository migration command.
2. Run `pnpm types`.
3. Run `pnpm test`.
4. Run `pnpm lint`.
5. Run `pnpm build`.
6. Run the self-sign browser smoke from chooser to final PDF.
7. Run the two-party browser smoke from chooser to partner completion and final PDF.
8. Run the complete "My documents" browser smoke, including creator and signer branches, sign-out, and expired recovery.
9. Inspect security audit evidence, user-facing timelines, persistence, logs, URLs, and browser state for raw credential leakage and event separation.
10. Execute the deterministic keyboard walkthrough and retain its checklist artifact.
11. Record an acceptance-evidence table marking every criterion verified, failing, or unverified with its test/artifact/command evidence.

## Blocked by

- Blocked by #41
- Blocked by #40

## User stories addressed

- User story 39
- User stories 42-48
