# PRD: Passwordless My Documents Access And Signing History

## Problem Statement

Signmos is a no-account e-signature product, but returning creators and signers do not have a direct way to recover all documents associated with their email address. The current history is reachable only after somebody starts and verifies a new envelope, is limited to envelopes created within the last 30 days, and relies on one envelope's sender session as the entry point. Users who lose an individual signing or completion link can therefore struggle to resume work, check status, or retrieve a signed PDF.

The product needs a privacy-safe recovery path from the landing page. A visitor should be able to prove ownership of an email address and receive temporary access to every non-deleted document still retained by Signmos in which that address is the creator, a signer, or both. The request flow must not reveal whether an arbitrary email address has used Signmos, and the resulting history must preserve envelope-specific roles, lifecycle rules, deletion, and retention.

## Solution

Turn the landing page into an unselected three-task chooser: "Sign by myself," "Sign with someone else," and "My documents." Selecting a task reveals only the form required for that task. "My documents" asks for an email address, requires Turnstile, applies the existing sender-start rate-limit policy, and always returns the same privacy-safe confirmation for valid accepted submissions.

If the normalized email is involved in at least one retained, non-deleted envelope, Signmos emails a metadata-free, single-use history link. The link remains redeemable for 30 minutes. Opening it displays a confirmation page without consuming the credential; an intentional POST consumes it and creates a fixed eight-hour, revocable, email-scoped browser session in a secure HTTP-only cookie. The session gives direct access to matching envelopes without requiring another envelope-specific email link, while every action remains constrained by the user's role and the envelope lifecycle.

The "My documents" page shows all currently retained matching envelopes, not a separate 30-day window. It prioritizes documents requiring the current user's action, supports server-side search, role/state filters, and numbered pagination, and exposes the existing permitted resume, sign, review, completed-document, cancel, and delete actions. History-based detail and PDF routes use the active history session and never expose reusable completed-document bearer tokens. Existing completion and process links continue to work independently.

## User Stories

1. As a landing-page visitor, I want three equal task choices, so that creating a document and recovering existing documents are clearly separate jobs.
2. As a landing-page visitor, I want no task preselected and only the selected task's form revealed, so that the page does not bias or confuse my intent.
3. As a returning creator or signer, I want to request "My documents" access using only my email, so that I do not need to create an account.
4. As a requester, I want missing and malformed email input rejected clearly, so that I can correct it before submitting.
5. As an operator, I want history-link requests protected by Turnstile and rate limits per normalized email and IP, so that the public email surface resists basic abuse.
6. As a requester, I want every valid accepted submission to receive the same response, so that Signmos does not reveal whether another person's email has documents.
7. As a requester, I want privacy-safe troubleshooting after submission, so that I can check spelling and spam, try another signing address, and understand retention without learning whether the address matched.
8. As an email owner with no matching retained documents, I do not want Signmos to send an unnecessary email, so that unmatched requests create no mailbox noise.
9. As an email owner with matching documents, I want an access email containing only a secure link, its expiration, and security guidance, so that document names, parties, and counts are not exposed in email.
10. As an email owner, I want an unused history link to expire after 30 minutes, so that old recovery links do not remain valid.
11. As an email owner, I want opening the email link to show a confirmation step before redemption, so that automated email scanners cannot consume my single-use credential.
12. As an email owner, I want successful redemption to consume the link exactly once, so that replaying or forwarding it does not create another session.
13. As a verified user, I want a fixed eight-hour history session, so that I can work across my documents without repeatedly checking email.
14. As a verified user, I want to sign out explicitly, so that I can revoke the current browser session before it expires.
15. As a user with an invalid, consumed, or expired link or session, I want a clear recovery page, so that I can request a new link without encountering a technical authorization error.
16. As an email owner requesting a replacement link, I want earlier unused links revoked only after the new email is accepted for delivery, so that a delivery failure does not destroy my last usable link.
17. As an email owner, I want automatic transport retries of one submission to be idempotent, so that they do not send or revoke extra links.
18. As a requester, I want an immediate email-delivery failure to remain private and be logged, so that document existence is not leaked even though I must submit again for another attempt.
19. As a user, I want email identity compared after trimming whitespace and lowercasing, so that harmless casing differences do not split my history.
20. As a user, I want provider aliases to remain distinct addresses, so that Signmos does not guess that two syntactically different addresses have the same owner.
21. As a user, I want history access to remain passwordless and account-free, so that recovery does not introduce profiles or permanent login.
22. As a verified user, I want every non-deleted document still retained by Signmos in my history, so that recovery is not limited by an arbitrary 30-day query window.
23. As a verified user, I want history to include documents where I am creator, signer, or both across all lifecycle states, so that drafts, active work, completed work, declined documents, and expired documents are discoverable.
24. As a verified user, I want the history page to explain the existing 90-day terminal-document retention policy, so that I do not mistake the feature for permanent archival storage.
25. As a verified user, I want an uploaded document identified by the latest active PDF revision's original filename, so that I can recognize it.
26. As a verified creator, I want pre-upload drafts shown as "Untitled document" with distinguishing metadata, so that interrupted drafts remain recoverable before a filename exists.
27. As an authorized party, I want participant names and email addresses shown in each row, so that I can distinguish similar documents and search by party.
28. As a verified user, I want role-aware groups for Drafts, Needs my action, Waiting on others, Completed, and Closed, so that the list reflects what I can or must do.
29. As a verified user, I want each row to retain its exact envelope status, so that grouped labels do not hide lifecycle detail.
30. As a verified user, I want documents needing my action first and remaining documents ordered by latest meaningful lifecycle activity, so that urgent work is visible before passive history.
31. As a verified user, I want server-side search across filename and participant details, so that I can find a document without loading the entire history.
32. As a verified user, I want server-side role and state filters, so that I can narrow history without losing authorization guarantees.
33. As a verified user, I want numbered server-side pagination with accurate totals, so that large histories are navigable and never silently truncated.
34. As a verified user, I want matching envelopes to open directly during my eight-hour session, so that I do not repeat email verification for each row.
35. As a verified creator, I want the history session to satisfy sender verification when resuming a matching awaiting-verification draft, so that the obsolete envelope link is not required.
36. As a verified recipient, I want the history session to satisfy partner verification for a matching signing task, so that I can proceed directly to the permitted signing view.
37. As an envelope participant, I want every row and action authorized by both my verified email role and current envelope state, so that appearing in history never grants broader control.
38. As an authorized participant, I want permitted resume, sign, and status-review actions available from history, so that interrupted work is recoverable.
39. As an authorized participant, I want completed-document details and PDF downloads available through the history session, so that I can retrieve final artifacts without exposing a reusable bearer credential.
40. As a creator, I want existing lifecycle-permitted cancel and delete actions available from history, so that I can manage documents I own.
41. As a creator, I want consequence-specific confirmation before cancel or delete, so that destructive actions are not accidental.
42. As a participant, I want deleted envelopes excluded and inaccessible immediately, so that sender deletion continues to revoke history and PDF access.
43. As a recipient of an existing signing or completion link, I want that link's established behavior to remain unchanged, so that the new history access path does not break current process links.
44. As a security-conscious user, I want history credentials to be opaque, revocable, and stored only as hashes, so that a database read does not reveal usable link or session tokens.
45. As an operator, I want link issuance, redemption, session expiry/revocation, document opening, and PDF download recorded as security events outside the user-facing signing timeline, so that access is auditable without cluttering document history.
46. As a pilot stakeholder, I want no new product analytics, permanent-account model, or formal compliance claim added by this feature, so that scope remains focused on secure self-service recovery.
47. As a keyboard or assistive-technology user, I want the landing chooser, forms, history controls, confirmation dialogs, and recovery states to be accessible, so that the full flow does not depend on pointer interaction or visual-only cues.
48. As an existing self-sign or partner-sign user, I want both signing workflows to continue working after the landing and authorization changes, so that recovery improvements do not regress document creation or signing.

## Implementation Decisions

- **Landing task model**: the landing page initially renders three equal actions with no selection. Selecting one reveals its task-specific form and a clear route back to the chooser. "My documents" is a top-level task, not a third signing mode.
- **History request input**: the public history request accepts an email, Turnstile proof, and idempotency key. It never asks for a name.
- **Email normalization**: identity matching trims surrounding whitespace and lowercases the full address. It does not strip dots, plus tags, or apply provider-specific alias rules.
- **Privacy response**: every syntactically valid, Turnstile-valid, accepted request returns the same status and generic copy regardless of match or delivery outcome. Missing/invalid input, failed Turnstile, and active rate limits remain explicit recoverable errors because they are independent of document existence.
- **Abuse policy**: use the existing sender-start limits: five accepted attempts per normalized email and per IP within a ten-minute window. Matching is evaluated only after universal abuse checks.
- **Match rule**: issue an email only if the normalized address is the creator or a current recipient of at least one retained, non-deleted envelope. Deleted-only and unrelated addresses behave as no match.
- **Access email**: the history email contains the link, 30-minute expiration, and "ignore this if you did not request it" guidance. It contains no document name, participant, status, or result count.
- **Delivery failure**: an immediate provider failure is persisted and logged but not retried by the product. No queue, durable outbox, retry command, or admin UI is introduced. The user must make another request.
- **Replacement ordering**: a fresh token remains pending until the email provider accepts its message. Only then does it become redeemable and invalidate earlier unredeemed tokens for that email. A failed attempt cannot revoke an older usable token.
- **Request idempotency**: transport retries using the same idempotency key return the original result and do not create, send, activate, consume, or revoke additional credentials. A deliberate new form submission uses a fresh key.
- **Magic-link authority**: history links use high-entropy opaque credentials stored as one-way cryptographic hashes. They expire 30 minutes after issuance, can be redeemed once, and are scoped to one normalized email.
- **Scanner-safe redemption**: a GET renders a no-sensitive-content confirmation page and does not mutate token state. An intentional, same-origin POST performs redemption. The confirmation response uses a no-referrer policy so the raw URL credential is not propagated.
- **History session**: redemption creates a server-side session with a fixed eight-hour lifetime. The raw opaque session ID exists only in a production `Secure`, `HttpOnly`, `SameSite=Lax` cookie; only its hash is stored. Session expiry is not sliding.
- **Session mutations**: sign-out and envelope mutations require same-origin/CSRF protections in addition to the history cookie. Signing out revokes only the current history session.
- **Recovery states**: unknown, expired, consumed, and revoked links and expired sessions render non-technical recovery states with a path to the landing page's preselected "My documents" form.
- **History identity context**: the session exposes a narrow verified-email identity and never grants a global account or arbitrary envelope lookup.
- **Envelope authorization gateway**: each history list item, detail read, PDF download, and mutation resolves the verified email's creator/recipient role and the envelope's current lifecycle state before returning data or applying an action.
- **Sender verification equivalence**: using a history session to resume a sender-owned `awaiting_verification` envelope records equivalent email verification and moves it through the existing valid lifecycle transition before preparation continues.
- **Partner verification equivalence**: using a history session to open a matching recipient task records equivalent partner verification before signing access is granted.
- **History range**: the catalog has no independent creation-date cutoff. It returns all matching rows still present under the existing retention/deletion rules.
- **Deleted behavior**: deleted envelopes are omitted from results and rejected at every history-based detail, PDF, and mutation boundary even if they were listed earlier in the session.
- **Role-aware grouping**: grouping is derived from verified-email role, recipient completion, envelope status, and allowed actions. Drafts cover recoverable preparation; Needs my action means the verified role can advance the envelope; Waiting on others means another party must act; Completed covers finalized envelopes; Closed covers declined and expired envelopes.
- **Exact status**: every item also returns the underlying lifecycle status and permitted actions. UI code does not recreate lifecycle rules.
- **Meaningful activity**: ordering uses the latest user-facing envelope lifecycle activity, excluding history-security events. Creation time is the fallback, and envelope ID is the stable tie-breaker.
- **Search and filters**: authorization is applied before case-insensitive server search across the latest filename, participant name, and participant email. Role/group/exact-status filters are server-side.
- **Pagination**: the catalog returns numbered pages of 25 items with page, page size, total items, and total pages. It has no hidden fixed maximum that can truncate matching results.
- **Document name**: source-document metadata stores the original upload filename for each revision. The latest active revision supplies the history title. Before upload, the title is "Untitled document" plus created date and short non-secret envelope reference.
- **History actions**: row actions come from the authorization gateway. They include existing lifecycle-permitted resume, sign, review, completed detail/download, and creator-only cancel/delete behavior.
- **Destructive confirmation**: cancel and delete use separate dialogs explaining their actual lifecycle and access consequences. Confirmation changes no server authorization rule.
- **Session-protected navigation**: routes opened from history use the history session for document detail, source/final PDF, and actions. History responses never return existing sender, signer, or final-document bearer tokens.
- **Existing process links**: current envelope-specific sender, signer, verification, and final-document links remain valid under their existing contracts. This PRD adds a safer history-originated access path rather than migrating or revoking those credentials.
- **Security audit**: technical access events record event type, normalized-email identity reference, session/link reference, envelope where applicable, timestamp, and request context appropriate to the existing privacy posture. Raw credentials are never recorded. These events are excluded from the user-facing completed-document timeline.
- **Analytics and compliance**: no product analytics are added. The feature preserves existing PII, authorization, audit, deletion, and retention controls without claiming certified, qualified, regulated-industry, or trust-service signing.
- **Email delivery integration**: use the existing Resend abstraction and development/test fallback behavior. Fallback links remain restricted to developer/debug surfaces and must not appear in normal end-user responses.

### Major Functional Components

- **Landing Task Chooser**: accepts one task selection and exposes the matching form while hiding task-specific state for the other paths. It keeps landing composition separate from the signing-mode domain.
- **History Access Request**: owns public input validation, Turnstile, rate limits, match lookup, idempotency, privacy-safe response semantics, email creation, provider outcome recording, and replacement-link ordering behind one request boundary.
- **History Credential Authority**: owns hashed magic-link credentials, scanner-safe redemption, hashed server sessions, cookie issuance, expiry, revocation, sign-out, and recovery-state resolution behind a small verified-email-session interface.
- **Email-Scoped Envelope Authorization**: accepts a verified email, envelope, and requested capability and returns the role-specific authorization decision and allowed actions. It hides creator/recipient lookup and lifecycle rules from catalog, route, and UI callers.
- **Document History Catalog**: owns authorized matching, lifecycle-derived grouping, meaningful-activity ordering, latest-filename projection, search, filters, and numbered pagination behind one paged query interface.
- **History Document Gateway**: owns session-protected resume, verification-equivalence transitions, detail access, source/final PDF access, and creator mutations without exposing envelope bearer credentials.
- **History Security Audit**: appends credential/session/document access events and keeps the technical stream separate from user-facing document events.
- **Document Display Metadata**: owns revision filenames and the "Untitled document" fallback without expanding the envelope lifecycle interface.

## Assumptions

- Possession of an email mailbox is an acceptable identity proof for every current Signmos envelope that stores that normalized address as creator or recipient.
- Users will tolerate an email click followed by one explicit confirmation click in exchange for scanner-safe single-use redemption.
- Users will tolerate requesting a new link after an immediate email-provider failure; automatic retry and operator resend are not required for this pilot.
- Resend remains the approved transactional email provider and reports synchronous acceptance or failure for a send attempt.
- Provider acceptance does not guarantee inbox delivery; the product can only preserve older links based on the provider result it receives.
- The current five-attempt, ten-minute sender-start rate-limit policy is appropriate for history requests at pilot scale.
- Browser clients support first-party cookies, and production is served over HTTPS so secure cookie attributes are effective.
- The first external pilot remains low-volume enough for Neon-backed server pagination and search without a separate search service.
- Existing envelope lifecycle and recipient records contain enough information to derive the verified email's role and allowed actions.
- Existing audit/lifecycle timestamps can define latest meaningful user-facing activity; if they cannot, implementation must add a canonical envelope activity timestamp without changing the user-facing rule.
- The original uploaded filename is safe to reveal to authorized envelope participants and can be stored as document metadata.
- Showing participant names and full email addresses to another authorized participant is consistent with the existing document-detail privacy posture.
- Existing 90-day retention eligibility for completed or expired documents remains acceptable, and history is not a legal archive.
- Documents may contain PII, so access control, audit, deletion, and retention remain necessary even without a new formal compliance regime.
- Existing envelope-specific and completed-document bearer links remain acceptable for their current email/process flows; only history-originated access must avoid exposing them.
- No password accounts, linked email identities, profile settings, teams, or organization boundaries are required for this feature.

## Tradeoffs Considered

- **Third option inside the signing-mode radio group** — rejected because viewing existing documents is a separate user job, not a signing mode.
- **Defaulting to self-sign on landing** — rejected because the three tasks should begin as equal choices with no hidden form state.
- **Explicit "no documents found" response** — rejected because it enables email-address enumeration.
- **Sending a no-results email** — rejected because unmatched requests should create no mailbox noise and could be abused for spam.
- **Document metadata in the access email** — rejected because names, parties, counts, and statuses are unnecessary exposure outside the authenticated history view.
- **Immediate redemption on GET** — rejected because email-security scanners may consume single-use links.
- **Reusable magic link until expiry** — rejected because a one-time exchange into a revocable browser session reduces replay risk.
- **Persistent browser login** — rejected because it creates an account-like security model beyond the no-account pilot.
- **Per-document email reverification** — rejected because one active email-scoped session is sufficient when every envelope action still enforces role and lifecycle.
- **Thirty-day history window** — rejected because centralized recovery should cover every document still retained under the actual retention policy.
- **Including deleted envelopes** — rejected because deletion must revoke discovery and artifact access immediately.
- **Permanent completed-document retention** — rejected because this feature is an access surface, not a change to the existing retention policy.
- **Reusing completed-document bearer tokens in history URLs** — rejected because session-only access should not mint or reveal a forwardable credential.
- **Removing existing bearer links globally** — rejected because that would expand scope and break established completion/process flows.
- **Exact-status-only navigation** — rejected because role-aware action groups are more useful while exact status remains visible per row.
- **Existing Draft/In progress/Completed buckets** — rejected because they misleadingly classify declined and expired documents as in progress.
- **Client-side search over a fixed result set** — rejected because it silently omits retained documents beyond internal query limits.
- **Infinite scrolling** — rejected because numbered pagination provides explicit position and total-result feedback.
- **Required user-entered document title** — rejected because the latest original PDF filename supplies recognition without adding signing-form friction.
- **First-revision filename** — rejected because the latest active revision is the document currently being reviewed or signed.
- **Provider-specific email alias normalization** — rejected because Signmos cannot safely infer mailbox equivalence across providers.
- **Plaintext history credentials** — rejected because one-way hashes prevent a database read from becoming usable access.
- **Fresh email verification for cancel/delete** — rejected because the active eight-hour session is sufficient when destructive actions have explicit confirmation and server authorization.
- **Automatic delivery queue/outbox** — rejected because it adds infrastructure beyond the chosen pilot scope.
- **Operator retry command or admin UI** — rejected because failed delivery recovery is a new user request, not an operational product surface.
- **Product analytics funnel** — rejected because qualitative pilot feedback is sufficient; security audit and operational logs remain separate.
- **New compliance certification** — rejected because the feature preserves the current lightweight general-business e-signature posture.

## Validation Strategy

| Story | Verification mechanism |
| --- | --- |
| 1 | Landing component test asserts three equal task actions with the agreed labels. |
| 2 | Component test asserts no task is initially selected, only one task form renders after selection, and returning to the chooser clears/hides task-specific UI safely. |
| 3 | Form/API test submits history access with email only and proves no name or account credential is required. |
| 4 | Form tests reject empty, whitespace-only, and malformed email values with accessible field errors before request submission. |
| 5 | Time-controlled integration tests assert valid Turnstile is required; the first five requests per email and IP in a ten-minute window are accepted, the sixth is rate-limited, and a request after reset is accepted. |
| 6 | API tests submit matching and non-matching valid addresses and assert identical accepted status/body/error-neutral shape; response data never contains a match flag. |
| 7 | Component test asserts generic confirmation includes spelling, spam, alternate-address, and retention guidance without match-specific language. |
| 8 | Email-boundary test asserts a valid unmatched or deleted-only address creates no history email send attempt or active credential. |
| 9 | Email payload test for a matching address asserts link, 30-minute expiry, and ignore guidance are present while filename, participants, statuses, and result count are absent. |
| 10 | Time-controlled token test accepts redemption immediately before the 30-minute expiry boundary and rejects it at and after expiry. |
| 11 | Route/API test asserts GET neither consumes nor verifies the token, repeated scanner-like GETs are harmless, and only same-origin POST attempts redemption. |
| 12 | Concurrency/replay integration test asserts exactly one redemption creates a session and later or concurrent redemption attempts return the consumed recovery state. |
| 13 | Time-controlled session test accepts access immediately before eight hours and rejects it at and after the fixed expiry without extending expiry on intermediate activity. |
| 14 | API/browser test signs out, verifies server revocation/audit state, and proves the cookie can no longer read history or documents. |
| 15 | Component/route tests cover unknown, consumed, expired, and revoked links plus expired sessions and assert a non-technical "request a new link" path. |
| 16 | Email-provider integration test proves a provider-accepted replacement activates the fresh token and revokes older unused tokens, while a provider failure leaves the older unexpired token usable. |
| 17 | Idempotency test repeats the same request key after success and uncertain response and asserts one credential, one email attempt, one activation result, and no extra revocation. |
| 18 | Provider-failure test asserts the public response remains generic, the failure is recorded without a raw token, no automatic retry occurs, and a later deliberate request can create a fresh attempt. |
| 19 | Identity tests prove whitespace and mixed-case variants resolve to the same creator/recipient history. |
| 20 | Identity tests prove dot variants and plus-tag variants remain distinct unless the exact normalized address is stored on the envelope. |
| 21 | End-to-end browser test requests, redeems, browses, and signs out without creating or requiring a password account/profile. |
| 22 | History integration test includes matching retained envelopes older than 30 days and excludes only unrelated/deleted/not-retained rows; it asserts no creation-window filter exists. |
| 23 | History tests cover creator, signer, and creator-and-signer roles across awaiting verification, draft, sent, changes requested, completed, declined, and expired states. |
| 24 | UI test asserts the existing 90-day completed/expired retention explanation is visible; existing time-controlled retention tests remain green at the 90-day boundary. |
| 25 | Persistence/query test uploads multiple revisions with different original filenames and asserts the latest active revision names the history row. |
| 26 | History UI/query test includes a pre-upload draft labeled "Untitled document" with created date and a non-secret short reference. |
| 27 | Authorization/UI test proves participant names and emails appear only on envelopes involving the verified email and are searchable there. |
| 28 | Role/state matrix tests map representative envelopes into Drafts, Needs my action, Waiting on others, Completed, and Closed for both creator and signer perspectives. |
| 29 | API/UI test asserts every grouped row also exposes and renders the exact lifecycle status. |
| 30 | Ordering test places actionable rows first, then orders by latest user-facing lifecycle event with creation fallback and deterministic envelope-ID tie-break. |
| 31 | Paged API tests search case-insensitively by latest filename, participant name, and participant email and exclude unauthorized matches. |
| 32 | Paged API/UI tests combine role, group, and exact-status filters and assert authorization is unchanged by filter input. |
| 33 | Pagination test creates more than 25 authorized rows, verifies page metadata and stable non-overlapping numbered pages, and proves rows beyond the first page are reachable with no hidden maximum. |
| 34 | Browser/API test opens multiple matching envelopes in one valid history session without another email challenge and rejects an unrelated envelope ID. |
| 35 | Integration test resumes a matching awaiting-verification creator draft, records equivalent sender verification, applies the valid lifecycle transition, and rejects a different creator email. |
| 36 | Integration test opens a matching unverified recipient task, records equivalent partner verification, permits the assigned signing view, and rejects a different recipient email. |
| 37 | Authorization matrix tests cover creator, signer, creator-and-signer, unrelated email, stale role data, and every lifecycle state for list, detail, PDF, and mutation boundaries. |
| 38 | Browser tests exercise permitted draft resume, changes resume, signing, and status review actions and assert each reaches the correct current workflow state. |
| 39 | Detail/download tests return completed data and PDF bytes through the history session, reject expired/unrelated sessions, and assert no bearer token is present in response bodies, URLs, or client-visible state. |
| 40 | Creator-control tests assert only lifecycle-permitted cancel/delete actions are returned and that direct signer attempts are rejected with stable structured errors. |
| 41 | Component tests assert distinct cancel/delete dialogs describe consequences, require confirmation, support cancel/focus return, and do not bypass server authorization. |
| 42 | Deletion race/regression test lists an envelope, deletes it, then proves subsequent history refresh, detail access, source/final PDF access, and mutations all reject or omit it. |
| 43 | Regression tests prove existing sender, signer, verification, completion-detail, and final-download links retain their prior behavior after history access is added. |
| 44 | Persistence/security tests assert only link/session hashes are stored, production cookies include Secure/HttpOnly/SameSite attributes, raw credentials are absent from logs/audit rows, and revocation blocks reuse. |
| 45 | Audit tests assert issuance, redemption, expiry observation/revocation, open, and download events with safe context; completed-document timeline tests assert those technical events are filtered out. |
| 46 | Schema/UI/config review plus tests assert no account/profile or product-analytics persistence is introduced and user copy makes no certified/qualified/regulated signing claim. |
| 47 | Accessibility-focused component/browser tests assert semantic controls and labels, keyboard selection/navigation, focus movement and restoration, dialog focus trapping, live status/error announcements, and adequate existing theme contrast. |
| 48 | Regression tests and manual smoke cover self-sign start through final PDF and two-party start through partner signing after the landing/session changes. |

### Major Component Done Criteria

- **Landing and request**: stories 1-9 and 17-20 pass through component and API boundaries, including privacy parity and both rate-limit scopes.
- **Credential/session authority**: stories 10-16, 21, and 44 pass with deterministic clock control, replay/concurrency coverage, hashed storage evidence, cookie assertions, CSRF/origin checks, and sign-out revocation.
- **History catalog**: stories 22-33 pass with a role/state matrix, records older than 30 days, multiple revisions, more than one 25-row page, combined filters, deterministic ordering, and no hidden maximum.
- **Authorization and actions**: stories 34-43 pass at list, detail, source PDF, final PDF, and mutation boundaries, including deleted-after-list and unrelated-envelope attempts.
- **Audit and quality**: stories 45-48 pass; normal user timelines exclude history-security events; both signing modes pass regression smoke; normal UI exposes no debug fallback links.
- **Repository readiness**: `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` all exit successfully before implementation is called ready. Any skipped command leaves its mapped criteria explicitly unverified.

## Out of Scope

- Password accounts, permanent login, account recovery, user profiles, linked email identities, teams, organizations, or role-based organization access.
- Provider-specific alias merging, user-controlled email linking, or searching documents across multiple addresses in one session.
- Changing the 90-day completed/expired retention policy, providing permanent archival guarantees, or restoring deleted documents.
- Showing deleted envelopes in history or granting a partner creator-only cancel/delete authority.
- Migrating, hashing, revoking, or replacing existing sender, signer, verification, and completed-document bearer credentials.
- Removing existing completion/process bearer links from email flows.
- Automatic email retry, Cloudflare Queues, a durable delivery outbox, scheduled resend, an operator retry command, or a failed-delivery admin UI.
- Product analytics, funnel tracking, growth telemetry, or document-level behavioral analytics.
- New certified, qualified, regulated-industry, notarized, trust-service, eIDAS, or enterprise identity claims.
- A permanent document title field, filename history UI, filename editing, folders, tags, favorites, bulk actions, or export-all.
- A separate search service, full-text document-content indexing, OCR, or searching inside PDF contents.
- Multi-document envelopes, templates, public API keys, webhooks, billing, or notification preferences.

## Further Notes

This PRD amends the earlier single-signer/history requirements in three deliberate ways: the landing page no longer defaults to "Only me," history is no longer limited to 30 days, and history authentication is no longer borrowed from the sender session of a newly created envelope. The existing envelope lifecycle, signing workflows, completed-document bearer links, deletion behavior, and retention policy remain authoritative except where this PRD explicitly adds email-session equivalence for matching sender and recipient verification.

The implementation plan should be split by the deep-module boundaries above. In particular, the public request/redemption/session authority should be independently testable before the history catalog is connected, and the authorization gateway should be verified with a full role/status matrix before any UI row action is trusted.
