# PRD: Agentic Mode And Bearer API

## Problem Statement

Signmos exposes most of its signing lifecycle through JSON endpoints, but the current contract is not safe or coherent for a user-controlled agent or future CLI. Creator operations mix a caller-supplied internal header, envelope-scoped sender tokens, signer tokens in URL paths, and My Documents cookies. Public onboarding also depends on browser Turnstile state. The existing agent smoke therefore proves that the domain can be driven through HTTP, but it does not provide a production-grade personal API identity.

A verified Signmos user should be able to authorize an agent once, give it a standard Bearer credential, and let it perform every document action the same email identity could perform through the UI. The credential must remain understandable and revocable for a non-technical user, avoid appearing in URLs or public prompts, preserve role authorization, and produce audit evidence that distinguishes agent activity from browser activity.

Without this feature, agents must imitate browser sessions or use unsafe internal headers, API documentation can drift from runtime behavior, and a future CLI has no durable authentication or compatibility boundary.

## Solution

Add a fourth **Agentic mode** choice to the landing page. A user enters an email, completes Turnstile, receives a dedicated single-use verification link, and opens a short-lived browser-only token-management session. From that console, the user can generate, inspect, and revoke up to five named personal tokens. Each generated secret is shown once, has a recognizable `signmos_` prefix, remains valid until revoked, and is stored only as a cryptographic hash.

Expose a stable `/api/v1` contract authenticated consistently with `Authorization: Bearer <token>`. A token represents one normalized verified email and has full role-equivalent document authority: it can create documents and act on documents where that email is currently authorized as creator or signer. It cannot manage tokens. Every mutation requires an idempotency key, every request re-checks authorization and revocation, and agent activity records the email plus safe token identity metadata.

Publish unauthenticated `/agent.md` operating guidance and `/openapi.json` schemas. The Agentic console presents a platform-neutral, copy-ready prompt that points agents to those resources and references `$SIGNMOS_TOKEN`; it never embeds the secret. V1 uses polling rather than webhooks and targets personal/pilot automation rather than bulk envelope processing.

## User Stories

1. As a visitor, I want to see Agentic mode as a fourth unselected landing-page choice, so that API access is discoverable without knowing a hidden route.
2. As a user, I want Agentic mode to request my email and a Turnstile proof, so that token issuance begins with the same abuse-resistant human gate as other public email flows.
3. As a user, I want the access-request response to be enumeration-safe and hide verification URLs in normal UI, so that the flow does not reveal whether an email has Signmos documents or expose sensitive shortcuts.
4. As a user, I want the dedicated Agentic verification link to be single-use and expire after 30 minutes, so that stale email links cannot manage API credentials.
5. As a user, I want link redemption to create a separate browser-only management session that expires after 15 minutes, so that token management is narrowly authorized and independent of My Documents.
6. As a user, I want the token console to list safe token metadata without revealing secrets, so that I can identify credentials by name, creation time, last use, and status.
7. As a user, I want to name a token and explicitly acknowledge its authority before generation, so that I understand it can send, sign, decline, cancel, and delete documents as my email.
8. As a user, I want a generated token to be an opaque high-entropy `signmos_...` secret shown only once, so that the service cannot later recover or redisplay it.
9. As a user, I want at most five active tokens, so that personal credentials do not grow without bound.
10. As a user, I want multiple named tokens to coexist and be revoked independently, so that removing one device or agent does not disrupt the others.
11. As a user, I want revocation to block the token on its next API request, so that compromised credentials can be stopped immediately.
12. As a user, I want Bearer tokens to be unable to generate, list, rename, or revoke tokens, so that credential management always requires fresh email verification.
13. As a user, I do not want token creation or revocation notification emails, so that token lifecycle is managed only through the Agentic console and security audit metadata.
14. As a user, I want an active token to remain usable until I revoke it, so that recurring curl and future CLI workflows do not require periodic reissuance.
15. As an API client, I want every `/api/v1` document request to use the standard Authorization Bearer header, so that I never need cookies, query-string credentials, Turnstile responses, signer path tokens, or `x-internal-user-id`.
16. As an API client, I want to resolve the verified identity and token metadata represented by my credential, so that I can confirm which user an automation is acting for.
17. As a user, I want the Bearer gateway to authorize each operation against my current creator or signer role, so that full token access never becomes access to unrelated documents.
18. As a user, I want unrelated and deleted documents to remain inaccessible through guessed identifiers, so that the API does not weaken existing document isolation or deletion guarantees.
19. As an API client, I want to list my retained creator and signer documents with search, role, state, action-first ordering, and pagination, so that I can discover work without browser-only My Documents state.
20. As an API client, I want to create self-sign or two-party drafts as my verified identity without another email verification, so that automation can start new work efficiently.
21. As an API client, I want to upload, inspect, download for preparation, and revise the source PDF under the existing one-PDF and 10 MB rules, so that agent-created documents follow the same storage lifecycle as UI-created documents.
22. As an API client, I want to list, add, edit, and remove draft recipients within the existing recipient limits, so that recipient preparation has full UI parity.
23. As an API client, I want to create and retrieve typed or drawn signature profiles with existing consent rules, so that agents can perform the same signature preparation and optional reuse as the UI.
24. As an API client, I want to list, explicitly place, default-place, and reposition permitted signature/date fields, so that agents can choose reliable defaults or precise PDF coordinates.
25. As a self-signer, I want my token to review and complete my own prepared signing task, so that self-signing can be completed without a browser process token.
26. As a creator, I want my token to send a prepared envelope and resend an eligible partner invitation, so that delivery workflows have API parity.
27. As an API client, I want document detail, lifecycle status, current allowed actions, retention state, and user-facing history, so that I can choose the next operation from server truth.
28. As an invited signer, I want my personal token to review only the source PDF and fields assigned to my verified email, so that I can safely inspect a signing task.
29. As an invited signer, I want my token to complete typed or drawn signing while the server fixes the signing date to the actual current date, so that API signing matches UI intent and date controls.
30. As an invited signer, I want my token to request changes with a required comment, so that the creator receives the same changes-requested workflow as through the UI.
31. As an invited signer, I want my token to decline with a reason and optional comment, so that terminal refusal is available without a browser link.
32. As a creator, I want my token to upload a revision after a change request and have stale fields cleared, so that corrected content cannot retain unsafe coordinates.
33. As a creator, I want my token to cancel/expire or delete an eligible document and inspect retention eligibility, so that creator controls have API parity.
34. As an authorized creator or signer, I want my token to open completed details and download the final PDF, so that the signed artifact is recoverable without process-link credentials.
35. As an API client, I want every mutation to require an Idempotency-Key and replay a completed result safely, so that network retries do not duplicate documents, recipients, fields, delivery, signing, or destructive actions.
36. As an API client, I want stable machine-readable errors with valid values, allowed actions, retry hints, and recovery information, so that an agent can recover without scraping prose.
37. As an API client, I want documented polling and standard rate-limit responses, so that I can observe asynchronous lifecycle changes without webhooks or abusive retry loops.
38. As a user, I want every sensitive read and mutation performed by a token to record my email, stable token ID/name, and `actorType: "agent"`, so that agent behavior is distinguishable in security and lifecycle evidence.
39. As a user, I want raw verification credentials, management sessions, and Bearer secrets excluded from URLs, responses after creation, logs, errors, audit events, analytics, and email content, so that operational systems do not leak reusable authority.
40. As an agent, I want unauthenticated `/agent.md` guidance with workflows, safety expectations, error recovery, polling, and curl examples, so that I can operate Signmos from a single public entry point.
41. As an API client, I want unauthenticated `/openapi.json` generated from the same schemas used at runtime, so that exact endpoints and request/response types cannot silently drift from implementation.
42. As a user, I want the Agentic console to provide a platform-neutral copy-ready prompt and separate token/environment setup controls, so that I can onboard Codex, Claude, or another agent without putting the token in prompt text.
43. As a product owner, I want a capability matrix and runnable Bearer-authenticated curl smoke proving every current UI document action has an API equivalent, so that “agentic friendly” is an evidenced release property rather than a documentation claim.
44. As an existing browser user, I want current sender, signer, completed-link, and My Documents flows to keep working during the `/api/v1` rollout, so that the new public contract does not break the pilot UI.

## Implementation Decisions

### Major Functional Components

1. **Agentic Credential Authority**
   - Owns Agentic access requests, Turnstile/rate-limit enforcement, single-use link inspection/redemption, the 30-minute link boundary, and the separate 15-minute management session.
   - Owns named token generation, the explicit full-authority acknowledgment, the five-active-token invariant, safe metadata listing, and immediate independent revocation.
   - Exposes a narrow browser-management interface and never returns a previously generated secret.

2. **Bearer Principal Gateway**
   - Accepts only the Authorization Bearer scheme for `/api/v1`.
   - Hashes the presented opaque token, resolves an active record, and returns a principal containing normalized email, token ID/name, and agent actor type.
   - Re-checks revocation and role authorization on every request, applies per-token abuse controls, and prevents token-management access.

3. **Versioned Agent Lifecycle API**
   - Presents a stable `/api/v1` resource model for identity, retained documents, creator preparation/controls, signer work, status/history, and final artifacts.
   - Delegates lifecycle and persistence behavior to the existing envelope and history-access domains rather than implementing a parallel agent lifecycle.
   - Uses the verified email principal instead of exposing or translating browser cookies, sender sessions, signer tokens, final-link tokens, or internal user headers.

4. **Idempotent Command Authority**
   - Requires an Idempotency-Key on every `/api/v1` mutation.
   - Scopes keys to the authenticated token and canonical operation, fingerprints the request, and returns the original completed response for an exact replay.
   - Rejects reuse of one key with a different request as an idempotency conflict.
   - Covers binary upload, recipient/field/profile mutations, delivery, signing, change request, decline, revision, cancel/expire, and deletion.

5. **Agent Contract Publisher**
   - Publishes `/openapi.json` from the same trust-boundary schemas used by the runtime handlers.
   - Publishes `/agent.md` with the base workflow, bearer-header rule, role model, idempotency, allowed-action/error recovery, polling behavior, curl examples, and goal-directed automation policy.
   - Treats both resources as public and secret-free.

6. **Agentic Token Console**
   - Adds the fourth landing task and a dedicated email-verification experience.
   - Shows active/revoked token metadata, token generation with explicit authority acknowledgment, one-time secret display, independent revocation, and the five-token cap.
   - Provides separate copy controls for the secret/environment setup and a platform-neutral prompt that references `$SIGNMOS_TOKEN`.

7. **Parity And Security Release Contract**
   - Maintains an explicit mapping from every current UI document capability to an authenticated `/api/v1` operation and test.
   - Includes authorization isolation, expiry boundaries, one-time redemption, token cap, revocation, idempotency, audit attribution, secret redaction, OpenAPI drift, browser compatibility, and full curl lifecycle evidence.
   - Treats any unmapped UI action or unverified numeric/security bound as release-blocking.

### Identity, Credential, And Authorization Contract

- One token represents exactly one normalized verified email, not an account, organization, workspace, or service principal.
- Tokens have full document authority for that identity; v1 has no scopes. Authorization still requires current creator or signer membership and a currently legal lifecycle action.
- A creator token cannot sign for a different recipient. A signer token cannot invoke creator controls unless the same verified email is also the document creator.
- Raw tokens use a recognizable `signmos_` prefix and at least 256 bits of cryptographically secure random secret material.
- Only a deterministic cryptographic hash and safe display metadata are persisted. Safe metadata includes token ID, user-selected name, prefix or trailing characters, creation time, last-used time, and revocation time/status.
- The raw token is returned only by the successful generation response and displayed only in the immediate generation state.
- Active tokens do not expire automatically. Revocation is checked on every request and takes effect for the next request.
- Revoked metadata remains available for security audit and does not count toward the five-token limit. V1 does not provide token-record deletion.
- Agentic verification credentials, management-session credentials, and Bearer tokens never appear in application URLs or public documentation.
- Agentic browser mutations use the dedicated management session plus same-origin protection; a Bearer token is never accepted as a substitute.
- Token creation/revocation does not send notification email.

### Agentic Verification Flow

1. The visitor chooses Agentic mode, submits a normalized email plus Turnstile, and supplies an Idempotency-Key.
2. The public response is enumeration-safe and does not reveal a verification URL outside restricted development/test surfaces.
3. Email delivery contains a dedicated Agentic verification link without document metadata or a generated Bearer secret.
4. Link inspection is scanner-safe and does not consume the credential.
5. Explicit same-origin redemption consumes the credential atomically and issues the dedicated HTTP-only management session.
6. The session can only access token-management and Agentic-console data. It cannot substitute for a My Documents, sender, signer, final-document, or Bearer session.

### `/api/v1` Contract

- Every `/api/v1` operation requires `Authorization: Bearer <token>`; there are no public or cookie-authenticated exceptions inside this namespace.
- Success responses use a stable `data` envelope and optional pagination/request metadata.
- Known failures use a stable error envelope containing a code and message plus applicable fields such as `allowedActions`, `validValues`, `fields`, `limit`, `retryable`, `retryAfter`, or `recoveryUrl`.
- The contract covers:
  - current principal/token metadata;
  - role-aware document catalog, search, filters, ordering, and pagination;
  - self-sign and two-party document creation;
  - source-PDF metadata/content, upload, and revision;
  - recipient list/add/update/delete;
  - typed/drawn signature profiles and optional reuse consent;
  - field list, explicit/default placement, and permitted signer repositioning;
  - send, resend, status, allowed actions, history, retention, cancel/expire, and delete;
  - signer task resolution, assigned source/fields, completion, change request, and decline;
  - completed detail and final-PDF download.
- Existing domain limits and transitions remain authoritative, including one source PDF under 10 MB, recipient limits, seven-day signing-link behavior where process links remain in use, field clearing after revision, fixed signing dates, and 90-day terminal-document retention.
- High-impact operations execute immediately when requested. The server does not add a preview/confirmation protocol beyond explicit request bodies, authorization, lifecycle guards, and idempotency.
- Agents poll server state and follow returned allowed actions. Webhooks are not part of v1.

### Audit, Abuse, And Observability

- Sensitive reads and every mutation record the normalized email, stable token ID/name, and `actorType: "agent"`; the raw token and token hash are excluded.
- Existing user-facing envelope history remains understandable and does not expose security credential internals. Security audit storage may retain richer token identity metadata.
- Agentic access requests keep Turnstile plus IP/email rate limits. `/api/v1` adds per-token and defensive IP limits with standard rate-limit headers and `429` recovery metadata.
- Numeric `/api/v1` rate thresholds must be chosen from a representative calibration of document reads, status polling, JSON mutations, and PDF operations. The measurement and assumptions are release evidence; the PRD does not guess capacity.
- Structured request logging must redact Authorization, Cookie, access-link credentials, session values, raw token generation responses, and sensitive query data.

### Public Guidance And Agent Behavior

- `/agent.md` and `/openapi.json` are accessible without authentication and contain no live credentials.
- The platform-neutral prompt instructs an agent to read both resources, use `$SIGNMOS_TOKEN`, remain within the user’s goal and verified identity, follow allowed actions, use a fresh Idempotency-Key per intended mutation, and poll responsibly.
- The guidance permits high-impact actions when they reasonably follow from the user’s stated goal; it does not mandate a separate confirmation immediately before each action.
- The public guidance must explain that anyone holding the token can send, sign, decline, cancel, and delete as the verified email and must never place the secret in prompts, URLs, issue bodies, source control, or logs.

### Compatibility And Rollout

- The existing browser UI may continue using current process-specific and history-session routes while `/api/v1` is introduced.
- The new gateway and adapters must reuse existing public domain boundaries so browser and agent behavior cannot diverge into parallel lifecycle implementations.
- Existing sender, signer, completed-document, My Documents, retention, and email-delivery regression tests remain release gates.
- The standalone CLI is a future consumer of `/api/v1`, not part of this PRD.

## Assumptions

- The first users are external individual pilot users, not internal-only operators or organizations.
- Normalized email remains the authoritative personal identity for creator and signer authorization.
- Users will tolerate one human Turnstile and email-verification step before receiving long-lived automation access.
- Users understand and explicitly accept that possession of a full-access token permits immediate signing and destructive document actions as their verified email.
- Personal/pilot automation means occasional document creation and moderate polling, not bulk envelope processing; batching and high-throughput guarantees are unnecessary in v1.
- Documents may contain ordinary PII, but the feature remains a general-business pilot with no HIPAA, qualified-signature, certified trust-service, or other regulated-compliance claim.
- Resend or the configured transactional-email boundary remains available for dedicated Agentic verification delivery.
- Cloudflare Turnstile remains available for the public Agentic access-request surface.
- Cloudflare Workers, Neon Postgres/Drizzle, and the existing security-audit boundaries can support one indexed token-hash lookup plus current authorization checks per request at pilot scale; this must be validated by measurement before rate limits are finalized.
- Existing envelope and history-access domains remain the source of truth for lifecycle transitions, role checks, document visibility, signing, finalization, and retention.
- Agent platforms can provide a secret through an environment variable or equivalent secure runtime mechanism.
- Users prefer multiple named credentials over a single rotating credential and accept a five-active-token cap.
- Users accept that active tokens do not expire automatically and that no security email is sent when a token is created or revoked.
- Users accept goal-directed agent execution without a mandatory per-operation confirmation step.
- Public Markdown and OpenAPI are sufficient discovery mechanisms for v1; a standalone CLI, MCP server, SDK, and tailored platform prompts can be added later.
- Polling with documented backoff and rate limits is sufficient for asynchronous status changes; webhooks are not required in v1.
- Revoked non-secret token metadata may be retained for pilot security audit and is not user-deletable in v1.

## Tradeoffs Considered

- **Retrofitting the existing mixed `/api` routes** — rejected because cookies, process tokens, internal headers, and browser compatibility would remain coupled to the public agent contract.
- **Using `/api/agent` without versioning** — rejected because it is a weaker long-term compatibility boundary for a future CLI and other clients.
- **Reusing the eight-hour My Documents session for token management** — rejected because long-lived credential issuance deserves a dedicated, freshly verified, narrowly scoped session.
- **Allowing an active Bearer token to manage tokens** — rejected because a compromised document credential could mint persistence or disable other credentials.
- **Signed JWT credentials** — rejected because immediate individual revocation and last-used/audit lookup would still require server state while adding claim/rotation complexity.
- **Cloudflare-managed API credentials** — rejected because Signmos needs product-level personal identity, naming, revocation, and audit behavior.
- **Storing recoverable raw tokens** — rejected because a database or operator compromise would expose reusable full-authority credentials.
- **One token per email** — rejected because rotation or removing one agent would disrupt every other device and automation.
- **Unlimited active tokens** — rejected because a personal pilot needs a clear bound against credential sprawl.
- **Short-lived or automatically expiring API tokens** — rejected because recurring curl and future CLI use should continue until explicit revocation.
- **Envelope-scoped tokens** — rejected because they cannot support retained-document discovery, new document creation, or recurring personal automation.
- **Coarse or fine-grained scopes** — rejected for v1 because the chosen model is full role-equivalent access for every token.
- **Security emails for token creation/revocation** — rejected by product decision in favor of console metadata and audit records only.
- **Two-step server confirmation for signing or destructive actions** — rejected because the desired automation model allows immediate goal-directed execution protected by authorization, lifecycle guards, and idempotency.
- **Embedding the secret in the copy-ready prompt** — rejected because agent transcripts and prompt logs are poor secret stores.
- **Platform-specific prompts** — rejected because one curl-oriented Markdown contract should work across capable agents.
- **Markdown-only documentation** — rejected because exact schemas need a machine-readable drift-resistant contract.
- **OpenAPI-only documentation** — rejected because agents also need workflow, safety, retry, and lifecycle guidance.
- **Webhooks in v1** — rejected because polling is sufficient for personal/pilot automation and webhooks add delivery, signing, retry, and abuse scope.
- **Bundling a CLI into the first delivery** — rejected because `/api/v1` must first become a proven stable boundary that a CLI can consume later.
- **Internal-only availability** — rejected because Agentic mode is intended as a real external individual pilot feature.
- **Organization/workspace credentials** — rejected because the current product has no account or tenant model and tokens represent one verified email.
- **Bulk workflow guarantees** — rejected because the initial usage profile is personal/pilot rather than high-volume automation.
- **Regulated or certified agent signing** — rejected because the current pilot provides basic e-signature intent, not regulated trust-service guarantees.

## Validation Strategy

Every numbered validation item maps directly to the user story with the same number.

1. **Landing discovery:** Component test loads the unselected chooser, asserts exactly four task choices including Agentic mode, and verifies no mode is preselected.
2. **Public human gate:** API/UI tests reject missing/invalid email and Turnstile, accept the explicit non-production test bypass only outside production, and submit a valid request with an Idempotency-Key.
3. **Enumeration safety:** Integration tests compare known and unknown emails and assert indistinguishable public status/body shape; UI asserts no raw verification URL is rendered. Restricted debug-link exposure remains non-production only.
4. **Thirty-minute single-use link:** Time-controlled tests accept inspection before 30 minutes, reject redemption at and after the exact expiry boundary, and prove two concurrent redemptions yield exactly one management session.
5. **Fifteen-minute management session:** Time-controlled tests accept authorized management before 15 minutes, reject at and after the boundary, and prove the session cannot authorize My Documents or `/api/v1`.
6. **Safe metadata list:** API/UI tests show token name, safe prefix/trailing display, creation, last use, and active/revoked status while asserting that raw secrets and hashes are absent.
7. **Name and acknowledgment:** Form/API tests require a valid non-empty name and explicit full-authority acknowledgment before generation, and display the agreed send/sign/decline/cancel/delete warning.
8. **Opaque one-time secret:** Token-generation tests assert the `signmos_` prefix, at least 256 bits of CSPRNG secret material, one successful raw-secret response, hash-only persistence, and no later redisplay through list/detail endpoints.
9. **Five-token cap:** Boundary test creates five active tokens successfully, rejects the sixth with a stable limit error, revokes one, and then permits one replacement.
10. **Independent credentials:** Integration test uses two active named tokens, revokes one, and proves the other remains authorized.
11. **Immediate revocation:** API test makes a successful request, revokes the token through the management session, and asserts the very next identical Bearer request returns the stable revoked/unauthorized error.
12. **Management boundary:** Security tests send valid Bearer credentials to every token-management endpoint and assert denial; the dedicated management session remains required.
13. **No lifecycle email:** Email-boundary tests assert token creation and revocation create no outbound message or email send record.
14. **No automatic expiry:** Time-controlled test advances well beyond management/link expiry and confirms an unrevoked token remains active while a revoked token does not.
15. **Bearer-only v1:** Contract test enumerates every `/api/v1` operation, rejects missing/malformed/cookie/query/internal-header credentials, and accepts the standard Authorization Bearer header.
16. **Principal resolution:** API test returns the normalized email plus safe token identity metadata and never returns a raw token/hash or unrelated user data.
17. **Role authorization:** Matrix tests cover creator-only, signer-only, dual-role, and unrelated identities against every category of read and mutation.
18. **Isolation and deletion:** Tests use unrelated UUIDs, deleted documents, and revoked roles and assert no source/final bytes or document metadata leak; deleted access is revoked immediately.
19. **Role-aware catalog:** Integration tests cover normalized-email creator/signer membership, search, combined role/state filters, action-first ordering, pagination, and exclusion of unrelated/deleted data.
20. **Verified draft start:** API test creates self-sign and two-party drafts from the Bearer principal without email delivery or another credential and verifies the creator identity/audit event.
21. **Source PDF parity:** Storage/API tests cover metadata/content, valid upload below 10 MB, invalid type, exact over-limit rejection, duplicate upload, authorized revision, current version, R2 metadata/hash, and unrelated access denial.
22. **Recipient parity:** Tests cover list/add/update/delete, normalized valid emails, existing 1–10 recipient bounds, duplicate handling, draft-only guards, and signer/outsider denial.
23. **Signature-profile parity:** Tests cover typed/drawn validation, explicit remember consent, retrieval only for the verified identity, update behavior, and absence of cross-email signature leakage.
24. **Field parity:** Tests cover list, explicit geometry, default placement, one-signature-placeholder rules, recipient assignment, draft-only changes, self-sign repositioning, and partner repositioning denial.
25. **Self-signing:** End-to-end API test creates a self-sign draft, uploads, uses default fields, resolves the token-authorized signing task, completes it, and obtains the completed detail/final PDF.
26. **Send and resend:** Integration tests enforce preparation preconditions, send only eligible invitations, use authorized creator identity, resend without duplicating recipients, and deny signer/outsider calls.
27. **Status and actions:** State-matrix tests cover awaiting/draft/sent/changes-requested/completed/declined/expired/deleted projections, allowed actions, history, retention, and role-aware visibility.
28. **Signer review:** Tests prove an invited email can read only its active task, latest source PDF, and assigned fields while another email cannot.
29. **Signing completion:** Tests cover typed and drawn input, required fields, current server-controlled signing date, ignored/rejected future client dates, signature reuse consent, audit attribution, and completion/finalization transitions.
30. **Change request:** Tests require a non-empty comment, transition to changes requested, notify the creator through existing delivery behavior, block completion, and attribute the agent token.
31. **Decline:** Tests require a reason, accept an optional comment, transition signer/envelope state, prevent further signing, and attribute the agent token.
32. **Revision loop:** Integration test requests changes, uploads a new source version, verifies all stale fields are cleared, places new fields, resends, and completes against only the revised content.
33. **Creator controls and retention:** Authorization/time/storage tests cover cancel/expire/delete allowed states, immediate signer/source/final revocation after delete, R2 removal behavior, and the existing 90-day eligibility boundary.
34. **Completed recovery:** Creator and signer Bearer tests open completed detail/history and download the final PDF; outsider, revoked-token, deleted, and unavailable-artifact cases return stable errors.
35. **Universal idempotency:** Parameterized tests cover every mutation. Exact key/request replays return the original status/body without duplicate rows, objects, emails, audit events, signatures, or deletion effects; changed payload reuse returns `IDEMPOTENCY_CONFLICT`.
36. **Machine recovery contract:** OpenAPI/API tests assert stable error codes, HTTP statuses, allowed actions/valid values/field paths, retryability, and recovery URLs where applicable; agents never need to parse prose to choose a supported next action.
37. **Polling and rate limits:** Run and retain a representative calibration across catalog/status, JSON mutations, and PDF operations before selecting numeric limits. Automated tests then assert the measured per-token/IP thresholds, standard rate-limit headers, `429`, and Retry-After behavior; `/agent.md` documents compliant polling/backoff.
38. **Agent attribution:** Audit tests assert sensitive reads and every mutation include normalized email, stable token ID/name, and agent actor type; browser actions remain distinguishable and raw credential material is absent.
39. **Credential redaction:** Security tests instrument responses, headers, redirects, logs, audit rows, analytics hooks, email payloads, and public artifacts and fail on raw access-link/session/Bearer values or Authorization/Cookie leakage.
40. **Public agent guidance:** HTTP test fetches `/agent.md` without auth and asserts workflows for create/list/prepare/send/sign/change/decline/control/download, role limits, idempotency, errors, polling, goal-directed execution, and secret handling.
41. **OpenAPI source parity:** HTTP test fetches `/openapi.json` without auth; schema validation and route enumeration prove every `/api/v1` operation/security requirement exists. A drift test fails when a runtime route/schema changes without the published contract.
42. **Prompt console:** UI test verifies the prompt is platform-neutral, links both public artifacts, references `$SIGNMOS_TOKEN`, contains no generated secret, and provides separate accessible copy controls for the prompt and secret/environment setup.
43. **Full parity release smoke:** Maintain a checked capability matrix with one verified `/api/v1` operation and evidence item for every current UI document action. A runnable `pnpm agentic:smoke` command uses only a base URL, Bearer token, public docs, curl-compatible HTTP, and permitted email-link test fixtures to complete creator and signer lifecycles; it must exit zero.
44. **Browser compatibility:** Run existing sender, signer, completed-document, My Documents, finalization, retention, email, UI, and release contract suites unchanged, plus browser smoke evidence for all four landing choices and legacy flows.

### Major Component Done Criteria

- **Agentic Credential Authority:** stories 2–14 pass, including exact 30-minute/15-minute/five-token/256-bit bounds, atomic redemption, one-time secret display, management isolation, and immediate revocation.
- **Bearer Principal Gateway:** stories 15–18 and 38–39 pass for every `/api/v1` route with role isolation and secret-free audit/log evidence.
- **Versioned Agent Lifecycle API:** stories 19–34 pass and the capability matrix contains no missing UI-equivalent document action.
- **Idempotent Command Authority:** story 35 passes for every mutation; no endpoint is exempt or documented as merely “state-safe.”
- **Agent Contract Publisher:** stories 36–37 and 40–41 pass; runtime schemas, OpenAPI, and agent guidance agree.
- **Agentic Token Console:** stories 1, 6–13, and 42 pass at API, component, keyboard/accessibility, and browser boundaries.
- **Parity And Security Release Contract:** stories 43–44 pass, measured rate-limit evidence is retained, and all existing browser/product workflows remain green.

### Release Verification

Before any readiness claim, run:

```bash
pnpm types
pnpm test
pnpm lint
pnpm build
pnpm agentic:smoke
```

Release evidence must enumerate every user story and numeric/security bound as verified, failing, or unverified with a test name, command output, measurement artifact, or explicit environment blocker. Any unverified row blocks an “Agentic mode ready” claim.

## Out of Scope

- Standalone CLI implementation, credential files, shell keychain integration, or installer packaging.
- MCP server, language-specific SDKs, generated client libraries, or platform-specific Codex/Claude prompts.
- Organizations, teams, workspaces, service accounts, delegated administrators, or tenant-wide credentials.
- Per-token scopes, read-only credentials, envelope-scoped credentials, or configurable approval policies.
- Automatic token expiry, refresh tokens, token rotation protocols, or token-management security emails.
- Bearer-authorized token generation, listing, rename, or revocation.
- Human approval or two-step confirmation protocols for send, sign, decline, cancel, or delete.
- Webhooks, event streams, callbacks, or push delivery for agent lifecycle changes.
- Bulk envelope creation, batch APIs, throughput SLAs, or high-volume automation guarantees.
- Multi-document envelopes, templates, reusable recipient groups, reminders, billing, or analytics.
- Password accounts, permanent user profiles, or changing the normalized-email identity model.
- HIPAA, qualified/certified signatures, notarization, eIDAS trust-service claims, or other regulated compliance guarantees.
- Changing existing PDF size, recipient, signing-link, finalization, or retention product limits except where required to expose parity safely.
- Replacing existing browser sender/signer/history/process-link contracts during the initial rollout.

## Further Notes

- This PRD supersedes the earlier assumption that “agent-ready” means an internal-header lifecycle smoke. The existing test remains useful as domain evidence but cannot satisfy the personal Bearer-authenticated release gate.
- The security posture intentionally accepts a large credential blast radius: each long-lived token has full role-equivalent authority, may execute legally meaningful or destructive actions immediately, and sends no lifecycle security emails. The generation acknowledgment, one-time display, hash-only storage, five-token cap, role checks, audit attribution, redaction, and immediate revocation are therefore mandatory release criteria.
- The public agent contract should be designed as the durable boundary for a future CLI. The CLI should consume `/api/v1` and must not require privileged internal headers or browser-session translation.
- Exact rate limits are deliberately absent until representative calibration is performed. Any implementation plan that inserts guessed capacity numbers violates this PRD’s validation strategy.
