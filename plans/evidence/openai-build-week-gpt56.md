# OpenAI Build Week GPT-5.6 Evidence

Evidence reviewed: 2026-07-20

This record supports [issue #59](https://github.com/auditmos/signmos/issues/59) without publishing a Codex Session ID, raw prompt, credential, transcript, or local session filename. It supplements the broader [Codex collaboration evidence](./openai-build-week-codex.md).

## Claim boundary

Signmos existed before OpenAI Build Week. The qualifying GPT-5.6 claim is limited to material development work performed through Codex during the Submission Period: planning and implementing the Agentic-mode extension, its Bearer-authenticated document API, security boundaries, tests, public contracts, and release evidence.

GPT-5.6 is not a Signmos runtime dependency or user-facing inference feature. It was used through Codex as a build-time engineering model. The deployed application remains a deterministic e-signature workflow backed by its documented application and infrastructure services.

## Retained private model evidence

The primary private Codex ledger is retained locally outside the repository. A privacy-safe audit produced the following fingerprint:

| Property | Verified value |
| --- | --- |
| First recorded timestamp | `2026-07-17T14:19:48.391Z` |
| Last recorded timestamp | `2026-07-18T16:55:55.434Z` |
| Repository/worktree | Signmos |
| Model metadata | 46 model-context records, all `gpt-5.6-sol`; no other model label found |
| Ledger size | 4,843 JSONL records; 10,918,847 bytes |
| Ledger SHA-256 | `f84fca42d65c1ab76f12ff9a3e44dd251ab97939d58b0e417bc78d1f4005ad63` |
| Qualifying commit coverage | Every commit listed below appears in the retained primary ledger |

The digest allows the entrant to prove that the same private ledger was reviewed later without exposing its contents. The private `/feedback` identifier is handled only in the Devpost submission workflow.

## Material GPT-5.6 work

The primary Codex thread carried the implementation objective from the approved Agentic plan through issues #43–#51. The commits remain concrete, reviewable outputs rather than a retrospective prose assertion.

| Work | Commit | Representative final-candidate files and evidence |
| --- | --- | --- |
| Product/security contract and eight TDD slices | [`f396721`](https://github.com/auditmos/signmos/commit/f396721b6e437ab197fd189ea3582a92b06ce68d) | [`plans/agentic-mode-prd.md`](../agentic-mode-prd.md), [`plans/agentic-mode.md`](../agentic-mode.md), issue drafts #44–#51 |
| Verified-email onboarding and first Bearer call | [`116a96f`](https://github.com/auditmos/signmos/commit/116a96ff1ae6ffaeabb220db997dd7ef0c790d47) | `src/db/agentic-access/credential-authority.ts`, `src/db/agentic-access/token-authority.ts`, `src/hono/api/agentic-onboarding.test.ts` |
| Multiple-token lifecycle and immediate revocation | [`a60b780`](https://github.com/auditmos/signmos/commit/a60b7807669a01ea6735a6b6bfc1938109b2c8d3) | Agentic credential authority and token-console tests |
| Role-authorized read API | [`005dde6`](https://github.com/auditmos/signmos/commit/005dde643215a272fe05081a46866590258a3952) | Agent document catalog/detail/PDF boundaries and authorization tests |
| Self-sign lifecycle and idempotent commands | [`46f2b2c`](https://github.com/auditmos/signmos/commit/46f2b2c504628c6a4720608f6b64dd48fd1dd098) | `src/db/agentic-access/command-authority.ts`, `src/hono/api/agent-command-idempotency.test.ts`, `src/hono/api/agent-self-sign.test.ts` |
| Two-party creator preparation and delivery | [`db3ed74`](https://github.com/auditmos/signmos/commit/db3ed74fbf191723920f2573fec88d2219a50fa0) | Recipient, field, send, resend, audit, and API contract slices |
| Partner review and signing decisions | [`6343f1e`](https://github.com/auditmos/signmos/commit/6343f1eb175ef688a0b5bcd8c5a4f48b9bc1e6e2) | Partner authorization, completion, change-request, decline, and idempotency tests |
| Revision and creator controls | [`bd75576`](https://github.com/auditmos/signmos/commit/bd75576d2ed61c3d4e65ce3fea27804a7174ea0e) | Revision, field clearing, cancel/expire/delete, retention, and cross-channel revocation tests |
| Measured parity/security release gate | [`9183acc`](https://github.com/auditmos/signmos/commit/9183acc2de655cbc9fd88c6bf81c753ab551fc43) | [`agentic-mode-release`](./agentic-mode-release/release-evidence.md), calibration, credential-canary, lifecycle smoke, browser evidence, and 44-story ledger |
| Public Agentic release documentation | [`fab718b`](https://github.com/auditmos/signmos/commit/fab718b525dbfa7a8c73b08adc3dd051a3c99684) | README, architecture, agent/operator documentation, and public API guidance |

## Contribution and human-review boundary

GPT-5.6 through Codex materially contributed by:

1. auditing the pre-existing product and turning a broad “every UI action through curl” goal into a seven-component architecture and eight vertical TDD slices;
2. carrying authorization, hash-only credentials, idempotency, secret redaction, audit attribution, runtime/OpenAPI parity, and regression constraints through the complete Agentic lifecycle;
3. implementing the creator and signer API paths through existing domain boundaries rather than building a disconnected demonstration endpoint; and
4. producing executable verification artifacts, including named tests, measured calibration, browser/lifecycle smokes, and a 44-story evidence ledger.

The human participant defined the outcome, answered or confirmed 46 product/security decisions, approved the architecture and phased issue graph, set the TDD/commit/push/verification completion contract, steered continuation, and retained the submission decision. The participant subsequently changed the initial protected-action posture by requiring exact matching-human review in issue #62; that amendment supersedes the earlier direct-execution decision in the final candidate.

The accurate claim is therefore collaborative: GPT-5.6 performed material analysis and implementation through Codex, while the human selected tradeoffs, reviewed the resulting behavior and evidence, changed a security-sensitive product decision, and retained final responsibility.

## Canonical Devpost description

Use this paragraph in the Devpost project description so the public claim stays aligned with the retained evidence:

> Signmos predates OpenAI Build Week. During the event, GPT-5.6 was used through Codex as a build-time engineering model to audit the existing product, structure 46 product/security decisions, and implement issues #43–#51 as tested vertical slices. That work produced the personal Agentic token flow, role-authorized Bearer document API, idempotent commands, credential-redaction controls, public OpenAPI/agent guidance, and executable release evidence. The human participant chose and confirmed the tradeoffs, approved the architecture and gates, later required matching-human review for protected actions, reviewed the evidence, and retained the submission decision. GPT-5.6 is not a Signmos runtime dependency.

This wording describes meaningful development use without claiming that submitted PDFs, signatures, or Agentic API calls are processed by GPT-5.6 at runtime.

## Timestamped demo narration

The final video script should reserve this exact evidence segment. Issue #60 remains responsible for measuring the finished video, verifying the actual timestamp, and keeping the whole public upload under its duration limit.

| Planned timestamp | Narration and visible evidence |
| --- | --- |
| `01:45–02:10` | “Signmos existed before Build Week. GPT-5.6 was used through Codex as a build-time engineering model: first to turn 46 product and security decisions into an eight-slice plan, then to implement issues #43–#51 with tests for authorization, idempotency, redaction, and API parity. I chose the tradeoffs, reviewed the gates, and later changed protected Agentic actions to require matching-human review. GPT-5.6 is not a Signmos runtime dependency.” Show the README evidence link and briefly scroll the qualifying commit/evidence table; show no private thread identifier or transcript. |

The narration may be shortened for pacing, but it must retain all four boundaries: material GPT-5.6/Codex work, concrete qualifying outputs, the human decision/review role, and no runtime-model claim.

## Issue #59 verification

| # | Acceptance criterion | Status | Evidence |
| ---: | --- | --- | --- |
| 1 | Identify material GPT-5.6 work and its Codex thread/session | Verified | Private primary ledger timestamps/model records plus the qualifying issues #43–#51 commit map |
| 2 | Retain trustworthy model/version evidence | Verified privately | The retained JSONL ledger is fingerprinted above by time range, size, model-record count, and SHA-256; no raw transcript or identifier is public |
| 3 | Link the work to concrete final-candidate outputs | Verified | Ten qualifying commits map to planning, code, tests, public contracts, smokes, calibration, and release evidence |
| 4 | Explain GPT-5.6 contribution and human review/change | Verified | The contribution section distinguishes material Codex work from 46 human-confirmed decisions and the later human-review amendment |
| 5 | Keep README, Devpost description, and demo narration consistent | Verified for the required repository/script evidence | README links this record; canonical Devpost copy and the `01:45–02:10` narration block share the same scope. Final external placement remains a #54/#60 publication check |
| 6 | Meaningful-use fallback | Not applicable | The retained metadata and qualifying outputs prove material use; no organizer exception is being requested |
| 7 | Avoid a false runtime GPT-5.6 claim | Verified | README, canonical Devpost copy, narration, and this claim boundary all state that GPT-5.6 is not a Signmos runtime dependency |
