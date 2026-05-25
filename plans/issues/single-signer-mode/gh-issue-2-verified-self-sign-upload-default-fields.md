## Parent PRD

#28

Local source: `plans/single-signer-mode-prd.md`

## Type

AFK

## What to build

Let a verified single signer upload and preview one PDF, then create the required signature and date fields automatically at the bottom-right of the last PDF page. The slice should reuse the existing envelope, document upload, preview, field, and audit/lifecycle behavior where possible. The self-sign path should not expose a visible send step.

## Assumptions

- Issue 1 is complete: mode-aware start and initiating-user email verification are available.
- The existing PDF upload constraints remain one PDF under 10 MB.
- The existing envelope field model can represent signature and date fields assigned to the initiating signer.

## Out of scope for this issue

- Do not implement saved-signature prefill/reuse.
- Do not implement final PDF completion/download.
- Do not implement the document history table.
- Do not create a separate self-signing data model outside envelopes.

## Acceptance criteria

- [ ] A verified single signer can upload one valid PDF under the existing 10 MB limit — [test: self-sign upload API/UI integration test]
- [ ] Invalid type, missing file, and over-10 MB uploads are rejected with stable JSON errors and actionable UI copy — [test: upload validation tests]
- [ ] Uploaded PDF metadata, storage key, byte size, content type, and checksum/hash are persisted through the existing document storage path — [observable: document row and storage mock/assertion]
- [ ] The uploaded PDF preview renders before the signer completes signing controls — [test: browser/component preview test]
- [ ] Single-signer mode automatically creates required signature and date fields assigned to the initiating signer on the last page with bottom-right default geometry — [test: default field placement integration test]
- [ ] If existing field adjustment controls are reused, changed geometry persists; if controls are not exposed in v1, the implementation records fixed-default-field behavior in the issue notes — [test or observable: browser field adjustment test or implementation note]
- [ ] The self-sign path does not require a visible send action before signing can proceed — [test: browser flow test]
- [ ] Upload, default field creation, and self-sign preparation append existing lifecycle/audit evidence for equivalent actions — [observable: audit/lifecycle rows]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

## How to verify

1. Run self-sign upload integration tests for valid and invalid files.
2. Run document storage assertions against the test storage boundary.
3. Run browser/component coverage for PDF preview.
4. Run default field placement tests for last-page bottom-right signature/date fields.
5. Verify the browser self-sign flow reaches signing without a visible send step.
6. Inspect or assert audit/lifecycle rows for upload and field preparation.
7. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

## Blocked by

- Blocked by #29

## User stories addressed

- User story 5
- User story 6
- User story 7
- User story 8
- User story 9
- User story 15
- User story 29
