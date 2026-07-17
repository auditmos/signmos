## Parent PRD

#36

## Type

AFK — recipient equivalence, signer authorization, lifecycle outcomes, terminal states, audits, and compatibility are objectively testable.

## What to build

Extend the history session into the complete signer recovery journey from PRD #36. A matching recipient can open an assigned task without the original invitation link, record equivalent partner verification, review the current PDF and assigned fields, take existing permitted signing actions, see role-aware waiting/action states, and later retrieve completed details and the final PDF through session-protected routes.

Every capability must come from the verified email's recipient role and current lifecycle. Creator-only users cannot sign unless they are also recipients, unrelated users cannot see or act, and deletion/terminal states retain their existing restrictions.

## Assumptions

- #39 supplies signer roles, participants, groups, statuses, allowed actions, and session-protected row selection.
- Existing partner verification, PDF review, field assignment, signing completion, alternate signer actions, finalization, completed detail, and saved-signature behavior remain authoritative.
- Existing invitation, signing, and completion links remain supported independently.

## Out of scope for this issue

- Do not add signer actions or lifecycle transitions absent from the existing product.
- Do not grant partner cancel/delete authority or add bulk/multi-envelope signing.
- Do not change signature capture, signing date, final PDF generation, completion email, or saved-signature scope.
- Do not migrate or remove existing invitation, signing, verification, or completed bearer links.

## Acceptance criteria

- [ ] Opening a matching unverified recipient task records equivalent partner verification and grants the assigned signing view without exposing a signer token — [test: partner verification-equivalence integration test]
- [ ] Different-recipient, creator-only, expired/revoked-session, deleted-envelope, and disallowed-state cases cannot trigger partner equivalence or signing — [test: signer equivalence/access denial matrix]
- [ ] The signer reviews the current source PDF and assigned fields through session-protected routes under the same rules as token-based signing — [test: session-protected signer review test]
- [ ] Completing an existing permitted signing action produces the same values, recipient status, envelope transition, audit evidence, and finalization behavior as the existing flow — [test: recovered signer completion lifecycle test]
- [ ] Existing change-request and decline behavior is available or blocked by the same server-derived lifecycle rules as token-based signing — [test: recovered signer alternate-action regression test]
- [ ] Creator-only sessions cannot sign unless the same email is an assigned recipient — [test: creator-versus-recipient authorization test]
- [ ] Needs-my-action and Waiting-on-others update correctly as the current signer, creator, and other recipients act — [test: signer-perspective grouping test]
- [ ] Completed detail and final PDF work through the history session after finalization with no bearer credential in client-visible state — [test: recovered signer completed-access test]
- [ ] Expired, declined, and deleted envelopes render the correct closed/revoked state and expose no signing mutation — [test: signer terminal-state UI/API test]
- [ ] Verification equivalence, document open, signing action, and final PDF download append safe audit evidence without raw session credentials — [test: signer recovery audit test]
- [ ] Deletion after signer-page load blocks source PDF, signing mutations, completed detail, and final PDF reads — [test: signer deletion race test]
- [ ] Existing partner verification, invitation, signing, and completion links retain their previous contracts — [test: signer-link compatibility regression suite]
- [ ] Row actions, review, signature controls, alternate actions, completion, and terminal states are keyboard and assistive-technology operable — [test: recovered signer accessibility test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` exit successfully — [command: repository readiness commands]

## How to verify

1. Run `pnpm test` and confirm recipient equivalence, denial matrix, PDF review, completion, alternate actions, grouping, completed access, terminal states, audit, deletion race, compatibility, and accessibility suites pass.
2. Create representative signer tasks for unverified, active, completed, declined, expired, deleted, creator-only, and unrelated recipient cases.
3. Use one matching history session to verify, review, act, complete, and download without an invitation or signer token in client-visible state.
4. Attempt the same paths with creator-only, unrelated, expired, revoked, and stale sessions and verify structured denial.
5. Delete an envelope after loading the signer experience and retry every read/mutation boundary.
6. Exercise existing partner/process links and confirm compatibility.
7. Run `pnpm types`.
8. Run `pnpm lint`.
9. Run `pnpm build`.

## Blocked by

- Blocked by #39

## User stories addressed

- User story 23
- User stories 27-30
- User story 34
- User stories 36-39
- User story 42
- User story 45
- User story 47
