# Plan: Passwordless My Documents Access And Signing History

> Source PRD: [GitHub issue #36](https://github.com/auditmos/signmos/issues/36) and `plans/my-documents-prd.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Architecture style**: extend the existing TanStack Start, Hono, Cloudflare Workers, Neon/Drizzle, R2, and Resend application through deep feature boundaries. UI routes remain thin, HTTP handlers adapt requests, and domain modules own persistence, identity, authorization, and lifecycle behavior.
- **Identity model**: history identity is one normalized email address produced only by trimming surrounding whitespace and lowercasing. Provider aliases remain separate identities, and no password account or permanent profile is introduced.
- **History request data**: a request has a normalized email, idempotency scope, provider-delivery outcome, and timestamps. Matching and non-matching accepted requests expose the same public result.
- **Magic-link data**: a history link has a one-way credential hash, normalized email, pending/active/consumed/expired/revoked state, issuance and 30-minute expiry timestamps, and delivery linkage. Raw link credentials are never persisted.
- **Session data**: a history session has a one-way opaque credential hash, normalized email, fixed eight-hour expiry, revocation state, and audit timestamps. The raw session credential exists only in a secure HTTP-only browser cookie.
- **Document metadata**: every source revision can retain its original upload filename. The latest active revision supplies the document title; pre-upload drafts use a non-secret "Untitled document" fallback.
- **Authorization**: one email-scoped authorization gateway resolves creator, signer, or creator-and-signer role plus current envelope state for every list item, detail read, PDF read, verification-equivalence transition, and mutation. UI code never invents allowed actions.
- **Session-protected navigation**: history-originated resume, signing, detail, and PDF operations use the active history session. History APIs and URLs never return or expose existing sender, signer, verification, or final-document bearer credentials.
- **Backward compatibility**: existing envelope-specific and completed-document process links retain their current behavior. This plan adds a parallel history-originated access path rather than migrating existing credentials.
- **Privacy**: valid accepted history requests use one enumeration-safe response. Unmatched and deleted-only emails receive no message. Matching emails receive a metadata-free link email.
- **Abuse controls**: history requests require Turnstile and reuse the current five-attempt, ten-minute limits independently for normalized email and IP.
- **Time boundaries**: unredeemed links expire after 30 minutes; redeemed sessions expire after a fixed, non-sliding eight hours; the existing 90-day completed/expired retention contract remains unchanged.
- **Catalog semantics**: history covers all matching non-deleted rows still retained by Signmos, with no independent creation-date window or hidden result cap. Search, role/state filters, ordering, and 25-row numbered pagination are server-side.
- **Activity ordering**: documents needing the verified user's action come first. Remaining order uses the latest user-facing lifecycle event, falls back to creation time, and uses envelope identity as a deterministic tie-breaker. History-security events never affect this order.
- **Audit separation**: credential/session/document-access events are security events with no raw credentials. They remain queryable for operators but are filtered out of the user-facing completed-document timeline.
- **Email failure**: an immediate provider failure is recorded and receives no automatic or operator retry surface. A later deliberate request creates a fresh attempt. Older unused links are revoked only after the replacement email is accepted by the provider.
- **Mutation safety**: request submission is idempotent. Redemption is atomic and single-use. Cookie-authenticated sign-out and envelope mutations require same-origin/CSRF protections and current server authorization.
- **Scope constraints**: do not change retention, add analytics, introduce accounts, merge email aliases, build delivery retry infrastructure, or claim a new compliance/signature tier.
- **Verification discipline**: numeric boundaries use deterministic clock tests. Authorization uses a role-by-state matrix through public boundaries. No phase is ready until its mapped criteria have evidence; the whole feature is not ready until types, tests, lint, build, and both signing-mode regression smokes pass.

---

## Phase 1: Completed-Document Recovery Tracer

**User stories**: 1-3, 9-13, 21, 34, 39, 44, 47

### What to build

Deliver one narrow, local/test-only recovery journey across every integration layer. A visitor starts from an unselected three-card landing page, chooses "My documents," submits an email known to own a completed document, receives a metadata-free single-use link, confirms redemption with an intentional POST, receives an eight-hour history session, sees the matching completed document, opens its details, and downloads its final PDF without a bearer token appearing in the history URL or response.

This phase establishes the durable credential, session, authorization, email, history, and PDF boundaries with only the completed-document happy path. It is demoable locally and in automated integration tests, but it is not exposed as a production-ready public path until Phase 2 adds the complete privacy and abuse contract.

### Assumptions carried in

- The existing completed-document artifact and participant records can supply one representative completed envelope.
- Resend or the existing development/test delivery fallback can deliver the history link through the current email abstraction.
- Existing completed-document bearer links remain unchanged and are not used by the new history-originated download.
- Production rollout remains gated until Phase 2 passes.

### Out of scope for this phase

- Public unmatched-email behavior, detailed troubleshooting copy, rate-limit boundary coverage, replacement-link ordering, and delivery-failure recovery.
- Draft, awaiting-verification, sent, changes-requested, declined, or expired rows.
- Search, filters, role-aware groups, full ordering, and pagination.
- Creator controls, sender verification equivalence, and partner verification equivalence.
- Complete security-audit event coverage and existing-flow regression release evidence.

### Acceptance criteria

- [ ] The landing surface initially shows three equal actions with no selected task, and choosing "My documents" reveals an email-only form with a working return-to-chooser action — [test: landing task-chooser component test]
- [ ] The two signing choices still submit their existing signing modes through the unchanged sender-start contract — [test: landing signing-mode regression test]
- [ ] A matching completed-document request creates one pending history credential whose database value is a one-way hash and produces one metadata-free access email — [test: request/email/persistence integration test]
- [ ] The access email includes only the history link, the 30-minute expiry, and ignore-if-unrequested guidance; it contains no filename, parties, statuses, or document count — [test: history email payload test]
- [ ] GET requests render the confirmation state without consuming the history credential, including repeated scanner-like GETs — [test: non-consuming confirmation route test]
- [ ] One intentional same-origin POST consumes the active credential and concurrent or repeated redemption attempts cannot create another session — [test: atomic single-use redemption integration test]
- [ ] Redemption succeeds immediately before the 30-minute expiry boundary and fails at and after expiry — [test: deterministic 30-minute token-boundary test]
- [ ] Successful redemption stores only a session hash and returns a production cookie with Secure, HttpOnly, and SameSite=Lax attributes — [test: session persistence and cookie contract test]
- [ ] The session works immediately before eight hours, fails at and after eight hours, and intermediate reads do not extend its fixed expiry — [test: deterministic eight-hour session-boundary test]
- [ ] A valid session lists the representative completed document only when the normalized email is a creator or recipient; an unrelated envelope identifier is rejected — [test: minimal history authorization integration test]
- [ ] The completed detail and final PDF are available through session-protected history routes, and no existing bearer credential appears in the response, redirect, URL, or client-visible state — [test: session-protected completed-document integration test]
- [ ] The same completed PDF remains available through its pre-existing process link contract — [test: existing completed-link regression test]
- [ ] The chooser, email form, confirmation action, completed row, and download action are keyboard operable with programmatic labels and visible focus — [test: Phase 1 accessibility component test]

---

## Phase 2: Privacy-Safe Request And Credential Lifecycle

**User stories**: 4-20, 44-45, 47

### What to build

Turn the Phase 1 tracer into a safe public request and recovery journey. Apply input validation, Turnstile, both rate-limit scopes, enumeration-safe accepted responses, no-send behavior for unmatched/deleted-only addresses, privacy-safe troubleshooting, strict normalization, idempotent submission, metadata-free email delivery, replacement-link ordering, provider-failure recording, expiry/replay recovery states, sign-out, and credential/session security events.

The slice ends with a production-eligible public access boundary: accepted requests cannot disclose document existence in their response shape, credentials cannot be replayed, automatic retries cannot duplicate effects, failed delivery cannot revoke an older working link, and the user can recover from every link/session terminal state.

### Assumptions carried in

- Phase 1's hashed credential/session model, scanner-safe POST redemption, completed-document tracer, and history authorization boundary are working.
- Turnstile verification and rate-limit persistence from sender start can be reused behind a history-request-specific operation boundary.
- The email provider gives a synchronous accepted/failed result; accepted does not mean inbox delivery.

### Out of scope for this phase

- Full retained-document catalog, filenames, groups, search, filters, and pagination.
- Draft/changes resume, creator controls, and partner signing through the history session.
- Automatic retries, delivery queues/outboxes, operator retry commands, or delivery administration UI.
- Product analytics or permanent login.

### Acceptance criteria

- [ ] Empty, whitespace-only, and malformed email values are rejected with accessible field errors before submission — [test: history-request form validation test]
- [ ] Missing or invalid Turnstile is rejected before matching/email work, while the explicit test bypass remains unavailable outside test configuration — [test: Turnstile integration and configuration test]
- [ ] For both normalized-email and IP scopes, the first five requests inside ten minutes are accepted, the sixth is rate-limited, and a request at or after reset is accepted — [test: deterministic dual-scope rate-limit boundary test]
- [ ] Matching, unmatched, and deleted-only accepted requests return the same status and response body and never return a match flag, document count, or delivery outcome — [test: enumeration-safe response parity test]
- [ ] Unmatched and deleted-only accepted requests create no active link credential and no email send attempt — [test: unmatched request persistence/email test]
- [ ] The accepted UI state provides spelling, spam, alternate-address, and 90-day retention guidance without implying whether a match exists — [test: privacy-safe confirmation component test]
- [ ] Whitespace/mixed-case variants resolve to the same identity, while dot and plus-tag variants remain distinct unless stored exactly after normalization — [test: email normalization and alias-separation test]
- [ ] Automatic retries using the same idempotency key return the original public result and cause one match evaluation, at most one send attempt, one activation, and no additional revocation — [test: request idempotency integration test]
- [ ] A deliberate request with a fresh idempotency key produces a fresh pending credential — [test: deliberate replacement request test]
- [ ] Provider acceptance activates the fresh credential and revokes earlier unused credentials for that normalized email in one consistent outcome — [test: accepted replacement ordering test]
- [ ] Provider failure records the failed attempt without a raw credential, leaves older unexpired credentials usable, returns the same public accepted response, and schedules no retry — [test: failed replacement delivery test; observable: failed delivery record with no retry state]
- [ ] Unknown, consumed, expired, and revoked links render distinct non-technical recovery states with a path back to a preselected "My documents" request form — [test: link recovery-state route/component tests]
- [ ] An expired session renders a non-technical request-new-link state rather than a generic unauthorized page — [test: expired-session recovery test]
- [ ] Sign-out requires same-origin/CSRF protection, revokes the current server session, clears the cookie, records revocation, and leaves other sessions unchanged — [test: sign-out authorization/revocation integration test]
- [ ] Link issuance, successful redemption, expiry observation, and revocation append security events with safe identifiers and no raw credentials — [test: credential/session security-audit test]
- [ ] Normal end-user responses, logs, audit records, and developer fallback behavior do not expose raw history credentials outside the email and explicitly restricted debug/test surface — [test: credential leak regression test]
- [ ] The public request, confirmation, recovery, and sign-out states announce errors/status changes and preserve logical keyboard focus — [test: Phase 2 accessibility component test]

---

## Phase 3: Full Retained-Document Catalog

**User stories**: 22-33, 37, 42, 47

### What to build

Replace the minimal completed-document list and existing 30-day/fixed-limit history behavior with the full session-authorized catalog. Persist original filenames per PDF revision, name rows from the latest active revision, keep pre-upload drafts discoverable as "Untitled document," include creator/signer/both roles and all non-deleted lifecycle states, explain retention, derive user-centered groups, show exact statuses and parties, prioritize actionable work, and add server-side search, filters, and numbered pagination.

This slice is complete when one history session can navigate every retained matching row through an authorized, deterministic, paged catalog without loading a fixed candidate set or leaking unrelated documents.

### Assumptions carried in

- Phase 2 provides a valid normalized-email session and production-safe public access flow.
- Existing source-document revisions and lifecycle/audit events can identify the latest active revision and latest meaningful user-facing activity, or can be extended with durable metadata while preserving lifecycle semantics.
- Existing retention/deletion remains the source of whether data is still present; this phase does not execute retention deletion.

### Out of scope for this phase

- Activating/resuming awaiting-verification creator drafts.
- Partner verification equivalence and completing a signing task from history.
- Creator cancel/delete mutations and their confirmation dialogs.
- New retention policy, permanent archive, folders, tags, bulk actions, or PDF-content search.

### Acceptance criteria

- [ ] Source upload and revision persistence records the original filename without weakening existing PDF type, size, hash, R2, idempotency, or revision guards — [test: source filename persistence and upload regression test]
- [ ] Multiple revisions display the latest active revision's original filename, while older revision names do not replace it — [test: latest-revision document-title test]
- [ ] A matching pre-upload draft appears as "Untitled document" with created date and a short non-secret reference — [test: untitled draft history test]
- [ ] Matching retained envelopes older than 30 days are returned, with no independent creation-date cutoff — [test: deterministic older-than-30-days catalog test]
- [ ] Creator, signer, and creator-and-signer roles are returned across awaiting verification, draft, sent, changes requested, completed, declined, and expired statuses; unrelated and deleted rows are excluded — [test: full role/status catalog matrix]
- [ ] Participant names and full emails are present only for authorized rows and can be matched by authorized search — [test: participant projection authorization test]
- [ ] Rows map to Drafts, Needs my action, Waiting on others, Completed, and Closed from the verified email's role, recipient state, envelope status, and allowed actions — [test: role-aware group matrix]
- [ ] Every row also exposes its exact lifecycle status and server-derived allowed actions — [test: exact-status and allowed-action contract test]
- [ ] Needs-my-action rows appear first; remaining rows use latest user-facing lifecycle activity, creation fallback, and a deterministic identity tie-breaker — [test: action-first stable-ordering test]
- [ ] History-security events do not alter meaningful-activity ordering — [test: security-event ordering exclusion test]
- [ ] Case-insensitive search matches latest filename, participant name, and participant email only after session authorization is applied — [test: authorized server-search integration test]
- [ ] Role, user-centered group, and exact-status filters can be combined without changing which envelopes the session is authorized to see — [test: combined server-filter integration test]
- [ ] The API returns numbered pages of 25 with page, page size, total items, and total pages; more than 25 rows produce stable, non-overlapping pages with all rows reachable — [test: multi-page pagination integration test]
- [ ] The query has no hidden fixed maximum that can silently truncate authorized results — [test: catalog result-set boundary test with data beyond prior limits]
- [ ] The history page explains the existing 90-day completed/expired retention policy without promising permanent storage — [test: retention-copy component test]
- [ ] If an envelope is deleted after a page is loaded, the next catalog request omits it and direct catalog-derived reads reject it — [test: deleted-after-list catalog race test]
- [ ] Search, filter, pagination, row labels, groups, statuses, loading, empty, and error states are keyboard and assistive-technology operable — [test: catalog accessibility component test]

---

## Phase 4: Creator Recovery And Document Controls

**User stories**: 23, 26, 28-30, 34-35, 37-38, 40-42, 45, 47

### What to build

Extend the catalog into a complete creator journey. A verified history session can activate and resume its matching awaiting-verification draft, resume normal draft preparation or requested changes, review sent status, and invoke only lifecycle-permitted creator cancel/delete actions. The authorization gateway performs role and state checks for every action; the UI renders server-derived actions and provides separate consequence-specific confirmation dialogs.

The slice crosses history, verification equivalence, envelope lifecycle, navigation, mutation, deletion, audit, and UI. It is complete when losing every envelope-specific sender link no longer prevents a verified creator from recovering or safely controlling owned documents.

### Assumptions carried in

- Phase 3 returns creator roles, exact statuses, groups, allowed actions, and stable catalog navigation.
- Existing sender verification, preparation, changes, status, cancel, and delete lifecycle operations remain authoritative and are adapted rather than duplicated.
- The history session's normalized email exactly matches the stored creator identity before sender equivalence can occur.

### Out of scope for this phase

- Granting creator controls to a signer who is not the creator.
- Partner verification equivalence or completing partner signing from history.
- New lifecycle transitions, undelete, restore, bulk cancel/delete, or retention-policy changes.
- Fresh email verification for each destructive action.

### Acceptance criteria

- [ ] Opening an awaiting-verification draft as the matching creator records equivalent sender verification, applies the valid transition, and resumes the appropriate preparation path — [test: creator verification-equivalence integration test]
- [ ] A different normalized email, signer-only role, expired/revoked session, or deleted envelope cannot trigger sender verification equivalence — [test: creator equivalence denial matrix]
- [ ] Draft and changes-requested creator rows resume the correct current preparation/revision path through the history session without exposing a sender token — [test: creator resume browser/API test]
- [ ] Sent creator rows open a session-protected status review with server-derived allowed actions — [test: creator status-review integration test]
- [ ] The role-aware group changes correctly when creator verification, upload, send, change request, cancel, or completion changes who must act — [test: creator lifecycle grouping test]
- [ ] Only creator-owned rows expose lifecycle-permitted cancel/delete actions; signer-only rows and invalid lifecycle states do not — [test: creator row-action authorization test]
- [ ] Direct cancel/delete requests by signer-only or unrelated sessions return stable structured authorization/state errors — [test: creator-control API denial test]
- [ ] Cancel and delete require same-origin/CSRF protection and re-check role/state at mutation time rather than trusting the listed row — [test: creator mutation CSRF and stale-state test]
- [ ] Cancel and delete use distinct confirmation dialogs describing their actual consequences, with keyboard cancellation, focus trapping, and focus restoration — [test: destructive-dialog behavior/accessibility test]
- [ ] Confirmed cancel/delete invokes the existing lifecycle operation exactly once and refreshes or removes the row according to resulting state — [test: creator control idempotency/UI integration test]
- [ ] Creator verification equivalence, resume/open, cancel, and delete append safe security/domain audit evidence without raw history credentials — [test: creator recovery audit test]
- [ ] Deleting a previously listed envelope immediately blocks its detail, source PDF, final PDF, resume, status, and further mutation paths for the same session — [test: creator deletion revocation race test]
- [ ] Existing sender-specific process links continue to enforce their prior behavior for unaffected envelopes — [test: sender-link compatibility regression test]

---

## Phase 5: Signer Recovery And Active Signing

**User stories**: 23, 27-30, 34, 36-39, 42, 45, 47

### What to build

Extend the history session into a complete signer recovery journey. A matching recipient can open an assigned task without the original invitation link, record equivalent partner email verification, review the document and assigned fields, sign or take other already permitted signer actions, see role-aware waiting/action states, and later open the completed detail and final PDF through session-protected routes.

The authorization gateway remains the only source of signer access. A creator who is not a recipient cannot sign merely because they own the envelope, an unrelated email cannot see or act, and deleted/closed states continue to block operations according to the existing lifecycle.

### Assumptions carried in

- Phase 3 supplies signer roles, participant data, groups, statuses, catalog actions, and session-protected row selection.
- Existing partner verification, source-PDF review, field assignment, signing completion, change-request/decline behavior, finalization, and completed detail remain authoritative.
- Existing saved-signature behavior by verified email is reused only where already supported; this phase does not create new signature-profile scope.

### Out of scope for this phase

- New signer actions or lifecycle transitions not already allowed by the product.
- Partner cancel/delete authority, bulk signing, multi-envelope signing, or linked email identities.
- Changes to signature capture, signing date, final PDF generation, or existing completion-email delivery.
- Removal or migration of existing invitation/signing/completed bearer links.

### Acceptance criteria

- [ ] Opening a matching unverified recipient task through history records equivalent partner verification and grants the existing assigned signing view without exposing a signer token — [test: partner verification-equivalence integration test]
- [ ] A different recipient email, creator-only role, expired/revoked session, deleted envelope, or disallowed lifecycle state cannot trigger partner equivalence or signing access — [test: signer equivalence/access denial matrix]
- [ ] The signer can review the current source PDF and assigned fields through session-protected routes with the same content/state rules as the existing signing flow — [test: session-protected signer review integration test]
- [ ] The signer can complete an already permitted signing action through history-session authorization, producing the same field values, recipient status, envelope transition, audit evidence, and finalization behavior as the existing flow — [test: recovered signer completion lifecycle test]
- [ ] Existing permitted change-request and decline behavior remains available or blocked according to the same server-derived lifecycle rules as token-based signing — [test: recovered signer alternate-action regression test]
- [ ] Creator-only users cannot sign unless their normalized email is also an assigned recipient — [test: creator-versus-recipient authorization test]
- [ ] Needs-my-action and Waiting-on-others groups update correctly as the current signer, creator, and other recipients act — [test: signer-perspective lifecycle grouping test]
- [ ] Completed detail and final PDF download work through the history session after finalization and contain no process bearer credential in client-visible state — [test: recovered signer completed-document access test]
- [ ] Expired, declined, and deleted envelopes display the correct closed/revoked state and expose no signing mutation — [test: signer terminal-state UI/API test]
- [ ] Verification equivalence, document open, signing action, and final PDF download append safe audit evidence without leaking raw session credentials — [test: signer recovery security/domain audit test]
- [ ] Deletion after signer page load blocks subsequent source PDF reads, signing mutations, completed detail, and final PDF reads — [test: signer deletion race test]
- [ ] Existing partner verification, invitation, signing, and completion links remain functional under their previous contracts — [test: signer-link compatibility regression suite]
- [ ] Signer row actions, document review, signature controls, alternate actions, completion, and terminal states remain keyboard and assistive-technology operable — [test: recovered signer accessibility test]

---

## Phase 6: Audited, Accessible Compatibility Release

**User stories**: 39, 42-48

### What to build

Close the feature as one production-ready end-to-end release path. Verify and finish the security-event stream, technical-event filtering, credential hygiene, session-protected document access, deletion races, structured recovery errors, accessibility across every new state, and compatibility with every existing sender, signer, verification, completion-detail, and final-download process link. Run full self-sign and two-party browser/API smokes from the new landing chooser through final artifact retrieval.

This phase adds no new product capability. It integrates and verifies the preceding slices as one coherent no-account feature, proves that the history surface never exposes bearer credentials or deleted documents, and confirms that no account, analytics, retry system, or new compliance claim slipped into scope.

### Assumptions carried in

- Phases 1-5 have passing phase-level evidence and expose all required history flows through public module boundaries.
- Existing full signing and completed-document smoke paths remain available as regression oracles.
- Production configuration can exercise secure cookies, Turnstile, Resend integration/fallback restrictions, Neon, and R2 through the established environment boundaries.

### Out of scope for this phase

- New history features, changed lifecycle behavior, account/profile work, analytics, email retry infrastructure, retention changes, or credential migration.
- Performance or capacity claims without a separately approved measured calibration.
- Fixing unrelated pre-existing failures; any such failure is reported with its affected acceptance criteria.

### Acceptance criteria

- [ ] Security events cover link issuance, redemption, expiry observation/revocation, sign-out, document open, and final PDF download with safe identity/session references and no raw credentials — [test: end-to-end history security-audit suite]
- [ ] User-facing completed-document history excludes every history credential/session technical event while preserving normal created/sent/viewed/signed/changes/completed events — [test: user-timeline filtering regression test]
- [ ] Database rows, structured logs, error payloads, HTML, redirects, browser state, URLs, and audit output contain no raw history session credential and expose a raw magic-link credential only where required for the email/confirmation request — [test: credential hygiene inspection suite]
- [ ] Production cookies, referrer policy, same-origin/CSRF checks, fixed expiry, sign-out revocation, replay denial, and unrelated-envelope denial all pass together — [test: production history-session security contract test]
- [ ] A deleted envelope is omitted from catalog and denied at detail, source PDF, final PDF, verification equivalence, signing, cancel, delete, and status boundaries, including stale browser state — [test: cross-boundary deletion revocation suite]
- [ ] Existing sender verification, sender preparation, partner verification, signing, completion detail, final download, and manual smoke contracts remain unchanged outside the new history-session path — [test: complete existing-link regression suite]
- [ ] The full self-sign browser smoke starts from the new task chooser and reaches completed PDF retrieval successfully — [test: self-sign browser smoke]
- [ ] The full two-party browser smoke starts from the new task chooser and reaches partner completion and final PDF retrieval successfully — [test: two-party browser smoke]
- [ ] The history recovery browser smoke covers request, debug/test link retrieval, scanner-safe confirmation, redemption, catalog search/filter/page, creator resume/control, signer resume/sign, completed download, sign-out, and expired recovery — [test: My documents browser smoke]
- [ ] Automated accessibility checks and keyboard walkthroughs cover the chooser, request, accepted state, confirmation, recovery, catalog, filters, pagination, dialogs, signing transition, completed detail, download, and sign-out — [test: complete My documents accessibility suite; observable: keyboard walkthrough checklist]
- [ ] Schema/config review finds no new password account, linked-email identity, product analytics, automatic retry/outbox, or elevated compliance-claim surface — [test: scope-guard contract test; observable: PRD scope review checklist]
- [ ] All known history errors use stable machine-readable JSON codes/messages and recovery hints without revealing match or delivery state — [test: history error-contract suite]
- [ ] `pnpm types` exits successfully — [command: `pnpm types`]
- [ ] `pnpm test` exits successfully — [command: `pnpm test`]
- [ ] `pnpm lint` exits successfully — [command: `pnpm lint`]
- [ ] `pnpm build` exits successfully — [command: `pnpm build`]

