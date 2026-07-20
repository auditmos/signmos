# Plan: Agentic Mode And Bearer API

> **Amended 2026-07-20 by issue #62:** see `plans/human-review-prd.md`. Agentic sign/complete, decline, cancel, expire, and delete now persist pending review and require server-derived matching-human approval.

> Source PRD: `plans/agentic-mode-prd.md` and GitHub issue #43

## Architectural decisions

Durable decisions that apply across all phases:

- **Architecture style**: Add narrow Hono `/api/v1` adapters and deep authentication/idempotency modules in front of the existing envelope and history-access domains. Do not create a parallel agent-specific signing lifecycle.
- **Compatibility boundary**: `/api/v1` is the stable public contract for agents and a future CLI. Existing browser sender, signer, completed-link, and My Documents APIs remain supported throughout the rollout.
- **Identity model**: One API token represents one normalized, email-verified individual. Authorization still checks the identity's current creator or signer role and the document's current lifecycle state on every request.
- **Credential model**: Tokens are named, opaque `signmos_...` secrets with at least 256 bits of CSPRNG material. Only deterministic hashes and safe metadata are stored. Secrets are shown once, remain active until revoked, and are never recoverable.
- **Credential limits**: A verified email may have at most five active tokens. Tokens have full role-equivalent document authority, no scopes, and cannot manage tokens.
- **Management authorization**: Agentic access uses a dedicated single-use 30-minute email link and a separate 15-minute browser-only management session. Token management does not reuse My Documents and does not accept Bearer credentials.
- **High-impact actions**: Send retains existing direct authorization. Sign/complete, decline, cancel, expire, and delete require exact matching-human review before execution.
- **Idempotency**: Every `/api/v1` mutation requires an Idempotency-Key. Exact request replays return the original completed response; reuse with a changed request returns a stable conflict.
- **Data model**: Persist dedicated Agentic access-link hashes, management-session hashes, API-token hashes/metadata, and operation idempotency records. Security audit evidence stores normalized email, stable token ID/name, and agent actor type, never raw credential material.
- **Public contract**: Runtime trust-boundary schemas and `/openapi.json` share one source of truth. `/agent.md` adds workflow, authorization, allowed-action, idempotency, error-recovery, polling, and secret-handling guidance.
- **Prompt contract**: The console provides a platform-neutral prompt that references `$SIGNMOS_TOKEN`; the raw token is copied separately and is never inserted into prompt text.
- **Async model**: V1 uses status/catalog polling, not webhooks. Standard rate-limit recovery is part of the API contract.
- **Scale posture**: Target personal/pilot automation, not bulk processing. Select numeric rate limits only after representative calibration of document reads, polling, JSON mutations, and PDF operations.
- **Compliance posture**: General-business documents and ordinary PII only; no HIPAA, qualified/certified-signature, or regulated trust-service claim.
- **Release evidence**: Every PRD story and every numeric/security bound must be reported as verified, failing, or unverified with named evidence. Any unverified row blocks an “Agentic mode ready” claim.

---

## Phase 1: Agentic Onboarding To The First Authenticated Call

**User stories**: 1–5, 7–8, 15–16, 38–42

### What to build

Deliver the thinnest complete Agentic experience: a fourth landing choice, dedicated email verification, a short-lived token-management session, generation of one named full-access token, one-time secret presentation, a copy-ready environment/prompt setup, and one successful Bearer-authenticated identity request. Publish initial `/agent.md` and `/openapi.json` artifacts that accurately document this slice.

This phase must prove the entire trust chain from human verification through persisted credential metadata to Bearer authentication, audit attribution, and secret-free public guidance before document access is added.

### Assumptions carried in

- The existing Turnstile verifier, transactional-email boundary, normalized-email behavior, scanner-safe link pattern, and security-audit conventions can be reused behind Agentic-specific interfaces.
- Cloudflare Workers and Neon Postgres/Drizzle are reachable in development and tests.
- The identity response is the only `/api/v1` business resource in this phase.

### Out of scope for this phase

- Multiple active tokens, token listing history, and revocation; these arrive in Phase 2.
- Document catalog, upload, signing, lifecycle actions, and final PDF access.
- Complete API documentation for later document resources.
- Final rate-limit thresholds or full parity smoke.

### Acceptance criteria

- [ ] The unselected landing chooser renders exactly four tasks, including Agentic mode, and preserves the existing three choices — [automated test: landing component behavior]
- [ ] Agentic access requests reject invalid email/missing Turnstile, accept configured non-production test bypass only outside production, require an Idempotency-Key, and return an enumeration-safe response — [automated test: public access-request API and production-bypass denial]
- [ ] Normal UI and production API responses never expose the Agentic verification URL; restricted development/test link exposure follows the existing debug boundary — [automated test: response/UI secret exposure]
- [ ] Link inspection is scanner-safe, redemption is explicit and same-origin, the link works before 30 minutes, fails at and after 30 minutes, and two concurrent redemptions create exactly one session — [automated test: time-controlled credential lifecycle and atomic redemption]
- [ ] The dedicated management cookie is secure, HTTP-only, same-site, scoped to the app, valid before 15 minutes, invalid at and after 15 minutes, and rejected by My Documents and `/api/v1` — [automated test: time-controlled session isolation]
- [ ] Token generation requires a non-empty name and explicit acknowledgment that the token can send, sign, decline, cancel, and delete as the verified email — [automated test: management API and console form]
- [ ] The generated credential has the `signmos_` prefix and at least 256 bits of CSPRNG secret material; only its deterministic hash and safe metadata are persisted — [automated test: token generation and persistence boundary]
- [ ] The raw secret appears in exactly one successful generation response/UI state and is absent from every later read, reload, persisted row, and public artifact — [automated test: one-time display and non-recoverability]
- [ ] The identity endpoint rejects missing/malformed Bearer, cookies, query credentials, and `x-internal-user-id`, accepts the generated token, and returns normalized email plus safe token identity only — [automated test: `/api/v1` authentication matrix]
- [ ] The first authenticated call records normalized email, stable token ID/name, and agent actor type without raw token/hash material — [automated test: security audit attribution]
- [ ] Authorization, cookies, link credentials, management sessions, raw token responses, and token hashes are redacted from instrumented logs/errors/audit events — [automated test: credential redaction harness]
- [ ] Public `/agent.md` and `/openapi.json` are accessible without auth, document the identity slice accurately, and contain no credential; the console prompt references `$SIGNMOS_TOKEN` and separate copy controls — [automated test: public artifacts, schema validation, and prompt UI]
- [ ] A browser/API smoke starts at the fourth landing choice and ends with a successful Bearer identity response using only the displayed secret — [automated test: end-to-end onboarding integration smoke]

---

## Phase 2: Multiple-Token Lifecycle And Immediate Revocation

**User stories**: 6, 9–14, 38–39

### What to build

Extend the verified console into a complete personal token manager. Users can create up to five named active tokens, distinguish them through safe metadata, and revoke one without affecting the others. Revocation must invalidate the next API request. Active tokens remain usable until revoked, revoked metadata remains auditable, and neither creation nor revocation sends email.

### Assumptions carried in

- Phase 1's dedicated access-link/session authority, token generator, Bearer gateway, identity endpoint, and redaction harness are working.
- A fresh Agentic verification is required whenever the 15-minute management session is absent or expired.

### Out of scope for this phase

- Token scopes, automatic expiry, refresh/rotation protocols, token rename, or token-record deletion.
- Bearer-authorized token management.
- Document resources beyond the identity response.

### Acceptance criteria

- [ ] The console lists token name, safe prefix/trailing display, created time, last-used time, and active/revoked status without raw secrets or hashes — [automated test: management API and console projection]
- [ ] Five active tokens can be generated; the sixth is rejected with a stable limit error; revoking one permits exactly one replacement — [automated test: five-token boundary]
- [ ] Two named active tokens authenticate independently, and revoking one does not alter the other's access — [automated test: independent credential lifecycle]
- [ ] A revoked token's very next identity request is denied with a stable machine-readable credential error — [automated test: immediate revocation]
- [ ] An unrevoked token remains valid after the 30-minute link and 15-minute management-session boundaries have passed — [automated test: time-controlled no-automatic-expiry behavior]
- [ ] Valid Bearer tokens cannot generate, list, or revoke tokens; only a live same-origin management session can do so — [automated test: management authorization matrix]
- [ ] Revoked metadata remains visible to the verified console, is excluded from the active limit, and does not expose secret/hash material — [automated test: revoked-token projection]
- [ ] Token creation and revocation produce no transactional email call or email send record — [automated test: email boundary]
- [ ] Create/revoke security events contain safe identity/token metadata and omit raw credentials — [automated test: security audit projection]
- [ ] Accessible console states cover loading, empty list, active limit, one-time secret, copy success/failure, revoke confirmation, expired management session, and API failure — [automated test: component accessibility and state coverage]
- [ ] A phase smoke creates five tokens, revokes one, proves it fails, and proves the other four remain valid — [automated test: end-to-end token-lifecycle integration smoke]

---

## Phase 3: Role-Aware Read-Only Document Access

**User stories**: 17–19, 27, 34, 36–41

### What to build

Give an authenticated token a safe, read-only view of the documents available to its email identity. The slice begins with a Bearer principal, passes through role authorization, and ends with catalog/search/filter/pagination, document status/allowed actions/history, and authorized completed-detail/final-PDF access. Extend the public contract and agent guidance with these resources and recovery rules.

### Assumptions carried in

- Phase 2 token validation, revocation, safe metadata, audit attribution, and redaction are stable.
- Existing history catalog, creator/signer authorization gateways, final-document lookup, and R2 access remain lifecycle truth.
- Existing retention behavior and process-link routes remain unchanged.

### Out of scope for this phase

- Draft creation or any mutation.
- Source-PDF preparation downloads for active drafts/signing tasks.
- Signature, recipient, field, signing, or creator-control commands.

### Acceptance criteria

- [ ] The catalog includes only retained documents where the principal email is creator or signer, with server-side search, combined role/state filters, action-first ordering, and pagination parity with My Documents — [automated test: catalog query and projection]
- [ ] Mixed-case variants normalize to the same identity while unrelated emails and guessed document IDs reveal no catalog/detail/PDF data — [automated test: identity normalization and isolation]
- [ ] Creator-only, signer-only, and dual-role identities receive correct document roles and currently allowed read actions — [automated test: role matrix]
- [ ] Document detail returns lifecycle status, server-derived allowed actions, retention projection, and user-facing history without process bearer credentials or internal audit data — [automated test: detail projection]
- [ ] Authorized completed creators and signers can stream the final PDF; outsiders, revoked tokens, deleted documents, and unavailable objects receive stable errors without bytes — [automated test: document/R2 authorization]
- [ ] Deleted documents revoke catalog, detail, and final-PDF access immediately for every token — [automated test: deletion visibility]
- [ ] Every sensitive read records normalized email, token ID/name, agent actor type, document ID, and event type without raw credential data — [automated test: read audit attribution]
- [ ] Read errors expose stable codes, HTTP status, retryability, allowed actions/recovery URL where applicable, and never require prose parsing — [automated test: error contract]
- [ ] `/openapi.json` includes every read route, Bearer security requirement, query/filter schema, binary response, and stable error union from the runtime source of truth — [automated test: OpenAPI/runtime drift]
- [ ] `/agent.md` explains identity confirmation, catalog discovery, role boundaries, polling, completed download, and recovery from expired/revoked/unavailable states — [automated test: public guidance contract]
- [ ] A curl-compatible phase smoke uses one token to list creator/signer work, inspect status/history, and download an authorized completed PDF while an outsider token is denied — [automated test: end-to-end read-only document integration smoke]

---

## Phase 4: Self-Signing Through The Public API

**User stories**: 20–25, 27, 29, 34–36, 38–41

### What to build

Deliver the first complete document mutation tracer: an authenticated user creates a self-sign draft, uploads one PDF, saves or selects a typed/drawn signature profile, prepares explicit or default fields, reviews and completes its signing task, observes finalization, and downloads the completed PDF. Introduce the universal idempotent-command authority with this slice and use it for every mutation from the first endpoint onward.

### Assumptions carried in

- Phases 1–3 provide active-token authentication, role-aware reads, final-PDF access, audit attribution, redaction, and public contract publication.
- Existing self-sign preparation, signature profile, field, signing, finalization, audit, R2, and email-domain behavior remains authoritative.

### Out of scope for this phase

- Partner recipients, two-party send/resend, partner completion/change/decline.
- Revision after a change request.
- Cancel/expire/delete and retention commands.

### Acceptance criteria

- [ ] Bearer-authenticated creation produces self-sign drafts owned by the normalized principal without another email verification or credential delivery — [automated test: verified draft creation]
- [ ] Source upload accepts one valid PDF under 10 MB, rejects invalid type and exact over-limit input, persists byte size/hash/content type/current version/R2 key, and permits authorized preparation reads only — [automated test: source storage and boundary validation]
- [ ] Typed and drawn signature profiles validate existing shapes, remain isolated by normalized email, and save reusable content only with explicit existing consent — [automated test: signature profile boundary]
- [ ] Explicit and default field placement persists recipient, type, page, geometry, one-signature-placeholder rules, and current draft-only constraints — [automated test: field preparation]
- [ ] The self-signer can resolve only its own assigned source/fields and reposition fields only where existing self-sign rules allow — [automated test: signing-task authorization]
- [ ] Typed and drawn completion uses the server-controlled current signing date, ignores/rejects future client dates, records field values/audit attribution, and finalizes the envelope — [automated test: signing and finalization]
- [ ] Completed detail/history/final PDF become available to the same token and contain the expected flattened values and certificate/checksum evidence — [automated test: completed artifact]
- [ ] Every phase mutation rejects a missing Idempotency-Key — [automated test: mutation contract enumeration]
- [ ] Replaying the same key and exact request returns the original status/body with no duplicate envelope, R2 object, profile, field, signature, audit, email, or finalization side effect — [automated test: exact replay]
- [ ] Reusing a key with a different JSON or PDF request fingerprint returns `IDEMPOTENCY_CONFLICT` without executing the changed command — [automated test: request conflict]
- [ ] Machine-readable precondition/state errors include valid values, allowed actions, field paths, and recovery guidance — [automated test: agent error recovery]
- [ ] `/openapi.json` and `/agent.md` expand with the self-sign creation/upload/profile/field/sign/final workflows and remain drift-free/secret-free — [automated test: contract publication]
- [ ] A curl-compatible self-sign smoke completes create → upload → default prepare → pending review, pauses for matching-human browser approval, then uses the originating Bearer token to poll → final download — [automated test: end-to-end self-sign integration smoke]

---

## Phase 5: Two-Party Creator Preparation And Delivery

**User stories**: 20–24, 26–27, 35–41

### What to build

Extend the creator path to two-party work. A Bearer principal creates a two-party draft, manages recipients, prepares sender and partner fields, completes the sender-first step where required, sends only the eligible partner invitation, resends when permitted, and follows server-derived status and allowed actions. All mutations reuse the command authority introduced in Phase 4.

### Assumptions carried in

- Phase 4 provides verified creation, PDF/profile/field preparation, sender signing, universal idempotency, error recovery, and contract publication.
- Existing recipient, sender-first signing, Resend/fallback delivery, send precondition, invitation, and audit behavior remains authoritative.

### Out of scope for this phase

- Acting as the partner with a personal token; Phase 6 covers that path.
- Partner change request, decline, and revision loop.
- Creator cancel/expire/delete controls.

### Acceptance criteria

- [ ] A Bearer principal creates a two-party draft owned by its normalized email without another verification email — [automated test: two-party creation]
- [ ] Recipient list/add/update/delete accepts the existing 1–10 valid-recipient bound, rejects invalid/duplicate/over-limit input, obeys draft-only rules, and denies signer/outsider identities — [automated test: recipient API and authorization]
- [ ] Creator and partner signature/date fields can be explicitly/default placed only for valid recipients, with all existing geometry and placeholder limits — [automated test: two-party field preparation]
- [ ] The creator can complete its sender-first signing step before delivery using the Phase 4 signing contract — [automated test: sender-first preparation]
- [ ] Send rejects missing source, recipients, sender completion, or recipient fields with stable allowed-action recovery metadata — [automated test: send preconditions]
- [ ] Successful send delivers only the eligible partner invitation, creates the expected send/audit records, and does not send a redundant creator signing invitation — [automated test: delivery routing]
- [ ] Eligible resend creates a new invitation/send record without duplicating recipients or bypassing current lifecycle rules — [automated test: resend behavior]
- [ ] Creator status/history exposes sent state, current allowed actions, partner progress, and delivery-safe projections without invitation/process credentials — [automated test: creator projection]
- [ ] Every create/recipient/field/profile/sign/send/resend mutation satisfies exact replay and changed-request conflict behavior — [automated test: idempotency matrix]
- [ ] Delivery-provider failure returns a stable retryable error and does not falsely advance the envelope to sent — [automated test: external email boundary]
- [ ] Agent audit events identify token ID/name and creator email for preparation and delivery without raw credential or partner-link leakage — [automated test: audit/redaction]
- [ ] Public OpenAPI/guidance covers two-party preparation, send preconditions, resend, polling, and delivery errors — [automated test: contract publication]
- [ ] A creator curl smoke creates and prepares, pauses for matching-human browser approval of sender-signing, then sends, resends, and observes the envelope through Bearer polling — [automated test: end-to-end two-party creator integration smoke]

---

## Phase 6: Token-Authenticated Partner Decisions

**User stories**: 17–19, 28–31, 34–41

### What to build

Allow a second independently verified email token to discover and act on its invited signing work without opening a process-link token. The partner can review only assigned content, then complete with typed/drawn signature, request changes with a comment, or decline with a reason. Use separate fixtures/flows for the mutually exclusive completion, change-request, and decline branches.

### Assumptions carried in

- Phase 5 can produce a correctly prepared and sent two-party envelope.
- The partner has independently generated an Agentic token through Phases 1–2.
- Existing signer authorization, verification equivalence, assigned-field projection, signature reuse consent, notifications, finalization, and terminal-state behavior remains authoritative.

### Out of scope for this phase

- Creator revision after a change request; Phase 7 completes that loop.
- Creator cancel/expire/delete and retention controls.
- Acting for a recipient whose email differs from the token principal.

### Acceptance criteria

- [ ] A token whose normalized email is an invited recipient discovers the active task through its catalog without exposing the process signing token — [automated test: signer catalog/recovery]
- [ ] The signer can read only the latest source PDF and fields assigned to that email; other recipients, creators without signer role, outsiders, revoked tokens, deleted documents, and inactive tasks are denied appropriately — [automated test: signer authorization matrix]
- [ ] Typed and drawn completion validates required values, fixes the signing date on the server, applies explicit signature-reuse consent, updates recipient/envelope state, and records agent attribution — [automated test: partner completion]
- [ ] When all required signers complete, both authorized identities receive completed detail/final PDF access and existing completion email routing remains correct — [automated test: finalization and delivery]
- [ ] Change request requires a non-empty comment, transitions to changes requested, blocks completion, notifies the creator through existing delivery behavior, and returns current allowed actions — [automated test: change-request branch]
- [ ] Decline requires a reason, accepts an optional comment, transitions to the terminal declined state, and blocks every subsequent signing attempt — [automated test: decline branch]
- [ ] Completion, change request, and decline each satisfy exact idempotent replay without duplicate field values, notifications, audit events, or terminal transitions — [automated test: signer command idempotency]
- [ ] A key reused across a different signer command/payload returns a stable idempotency conflict without executing the second intent — [automated test: cross-command conflict]
- [ ] Stable errors distinguish not found, wrong identity, inactive, completed, changes requested, declined, expired, deleted, revoked-token, and invalid-input states with recovery metadata — [automated test: signer error catalog]
- [ ] All partner sensitive reads and actions audit normalized email plus stable token ID/name and never expose raw bearer/process credentials — [automated test: signer audit/redaction]
- [ ] OpenAPI and agent guidance cover task discovery, assigned-content boundaries, all three partner decisions, polling, completion, and recovery — [automated test: contract publication]
- [ ] A multi-token curl smoke uses a creator token to send and a partner token to complete, then downloads the same final PDF through both authorized identities — [automated test: end-to-end partner completion integration smoke]
- [ ] Separate tests demonstrate change-request and decline branches without reusing terminal fixtures — [automated test: isolated partner decision branch suite]

---

## Phase 7: Revision Loop And Creator Controls

**User stories**: 21, 24, 26–33, 35–41

### What to build

Complete the non-happy-path lifecycle. A creator token responds to a partner change request by uploading a revised PDF, proving stale fields are cleared, preparing new fields, resending, and allowing the partner token to complete against only the revised content. Add Bearer-authorized cancel/expire/delete and retention inspection with immediate revocation of every document access path after deletion.

### Assumptions carried in

- Phase 6 supplies sent, changes-requested, completed, and declined agent workflows with multiple verified identities.
- Existing revision, field-clearing, creator controls, R2 deletion, final/process-link revocation, retention, audit, and notification behavior remains authoritative.

### Out of scope for this phase

- Threaded negotiation or creator replies to change requests.
- Restoring declined, expired, or deleted documents.
- Changing the existing seven-day signing-link or 90-day retention product policy.
- Final measured rate-limit calibration and full release evidence, which remain in Phase 8.

### Acceptance criteria

- [ ] The creator token sees the first change-request comment, changes-requested status, and server-derived recovery actions while unrelated identities do not — [automated test: creator recovery projection]
- [ ] Only the creator can upload a revised valid PDF in the allowed state; the revision becomes current and preserves source metadata/hash/version rules — [automated test: revision authorization/storage]
- [ ] Revision clears every stale field/value tied to the previous document and blocks resend until new required fields are placed — [automated test: field-clearing invariant]
- [ ] Re-placement and resend produce a fresh eligible partner invitation without duplicating recipients or retaining stale signing authority — [automated test: resend after revision]
- [ ] The partner token reviews only the revised source/fields and can complete the envelope; the final PDF contains revised content/values, not stale content — [automated test: full revision completion]
- [ ] Creator cancel/expire is allowed only in server-approved states, stops outstanding signing, exposes the terminal status/allowed actions, and preserves eligible retained history — [automated test: cancel/expire state matrix]
- [ ] Creator delete removes/revokes stored source/final artifacts as required and immediately denies creator, signer, process-link, history-session, and Bearer catalog/detail/PDF/action paths — [automated test: deletion and cross-channel revocation]
- [ ] Retention inspection respects the existing terminal-state rules and exact 90-day eligibility boundary — [automated test: time-controlled retention boundary]
- [ ] Signer-only and unrelated tokens cannot invoke revision, resend, cancel/expire, delete, or creator retention operations — [automated test: creator-control authorization]
- [ ] Revision, re-placement, resend, cancel/expire, and delete satisfy exact replay and changed-request conflict behavior without duplicate storage, email, audit, or destructive effects — [automated test: creator command idempotency]
- [ ] Errors enumerate current allowed actions for every blocked lifecycle transition and remain aligned with OpenAPI/guidance — [automated test: state/error contract]
- [ ] Audit evidence attributes every revision/control action to normalized creator email plus token ID/name and excludes all credentials — [automated test: creator audit/redaction]
- [ ] A multi-token curl smoke performs request changes → revise → replace fields → resend → pending partner completion → matching-signer browser approval → final download — [automated test: end-to-end revision-loop integration smoke]
- [ ] Separate control smoke proves cancel/expire/delete pause for matching-creator review and revoke expected access paths only after explicit approval — [automated test: end-to-end creator-control integration smoke]

---

## Phase 8: Measured Parity And Compatibility Release

**User stories**: 35–44, with regression evidence for 1–34

### What to build

Turn the accumulated slices into an evidenced public release. Complete the runtime-generated OpenAPI and public agent operating guide, calibrate and enforce measured rate limits, verify credential redaction across all operational surfaces, publish the UI-to-API capability matrix, provide one full curl-compatible lifecycle smoke command, and prove the existing browser product remains compatible.

This phase does not add new product capability. It closes contract, measurement, security, accessibility, and release-evidence gaps exposed by the earlier slices.

### Assumptions carried in

- Phases 1–7 have independently passing vertical smokes and their production behavior is represented in runtime schemas.
- Representative development/staging infrastructure is available for rate-limit calibration and full email/Turnstile/R2 browser evidence.
- Existing project verification commands remain authoritative.

### Out of scope for this phase

- New document actions, token scopes, configurable approval protocols beyond issue #62, webhooks, bulk APIs, CLI, MCP, SDKs, or platform-specific prompts.
- Guessed throughput, latency, memory, or rate-limit claims without retained measurements.
- Declaring readiness with any unverified user story or numeric/security bound.

### Acceptance criteria

- [ ] A checked capability matrix enumerates every current UI document action and maps it to one `/api/v1` operation, required role, idempotency behavior, OpenAPI operation, agent-guide workflow, and named test/smoke evidence; no row is unmapped — [observable artifact: retained parity matrix]
- [ ] Runtime route/schema enumeration and `/openapi.json` are identical for every `/api/v1` method, path, security requirement, request, response, binary body, error union, and idempotency rule — [automated test: OpenAPI drift contract]
- [ ] Public `/agent.md` covers identity, token handling, catalog, create/upload/prepare, send/resend, signing decisions, revision, controls, final download, allowed actions, errors, idempotency, polling, rate limits, goal-directed execution, and secret safety — [automated test: guidance completeness contract]
- [ ] The platform-neutral console prompt links public guidance/OpenAPI, references `$SIGNMOS_TOKEN`, contains no secret, and remains usable with accessible separate copy controls — [automated test: console prompt and accessibility]
- [ ] Representative calibration measures catalog/status reads, JSON mutations, PDF upload/download, and polling behavior on documented fixtures/infrastructure; sample size, observed results, and scaling assumptions are retained — [observable artifact: calibration report]
- [ ] Numeric per-token/IP thresholds are selected from the calibration, documented with rationale, and asserted at below-limit, exact-limit, and over-limit boundaries — [automated test: measured rate-limit boundaries]
- [ ] Every limited response uses stable `429` JSON plus standard limit/remaining/reset and Retry-After metadata; `/agent.md` documents compliant polling/backoff — [automated test: rate-limit recovery contract]
- [ ] A credential-canary scan covers URLs, redirects, response bodies after generation, logs, errors, audit/security events, analytics hooks, email payloads, public artifacts, screenshots, and release fixtures with zero raw Bearer/link/session/hash leaks — [automated test and observable artifact: redaction scan report]
- [ ] Universal idempotency route enumeration proves every `/api/v1` POST/PUT/PATCH/DELETE requires a key and has exact-replay/conflict tests; no endpoint is classified as merely state-safe — [automated test: mutation/idempotency contract]
- [ ] `pnpm agentic:smoke` uses a base URL, `$SIGNMOS_TOKEN`, public docs, Bearer auth, and Idempotency-Key for Agent requests; protected commands pause for matching-human browser review, then the originating token polls terminal self-sign, partner, decline, cancel/expire/delete, and final-download results — [runnable command: `pnpm agentic:smoke` exits 0]
- [ ] Browser smoke covers all four unselected landing choices, Agentic verification/console/token states, and unchanged sender, signer, completed-document, and My Documents workflows — [observable artifact: retained browser/keyboard evidence]
- [ ] Existing API, domain, component, release, email, PDF, retention, accessibility, and compatibility regression suites pass without weakening prior assertions — [runnable command: `pnpm test` exits 0]
- [ ] Existing process-link compatibility tests accept signing access before seven days and reject it at and after the exact seven-day boundary while `/api/v1` personal-token behavior remains non-expiring until revocation — [automated test: time-controlled process-link/token-lifetime boundary]
- [ ] Type checking, linting, and production build pass — [runnable commands: `pnpm types`, `pnpm lint`, and `pnpm build` all exit 0]
- [ ] Release evidence lists PRD stories 1–44 and every 30-minute, 15-minute, five-token, 256-bit, 10 MB, 1–10 recipient, seven-day, 90-day, idempotency, revocation, redaction, and measured-rate criterion as verified/failing/unverified with named evidence — [observable artifact: signed release evidence table]
- [ ] Any failing or unverified evidence row blocks the release headline; the final report states `44 of 44 verified` only if every row passes — [observable artifact: release go/no-go report]
