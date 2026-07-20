# OpenAI Build Week Codex Collaboration Evidence

Evidence reviewed: 2026-07-20

This record supports the OpenAI Build Week submission without publishing a Codex Session ID, raw prompts, credentials, or local session files. The official [rules](https://openai.devpost.com/rules) and [FAQ](https://openai.devpost.com/details/faqs) remain authoritative.

## Eligibility boundary

Signmos existed before Build Week. The submission claim is therefore limited to the meaningful Agentic-mode extension built after the submission window opened: verified personal API onboarding, token management, the role-authorized `/api/v1` document lifecycle, public agent/OpenAPI contracts, and measured release evidence.

The qualifying work was developed on 2026-07-17 and 2026-07-18. It is distinct from the pre-event e-signature product and from the later submission-audit and marketing threads.

## Primary Codex thread

The genuine primary thread is the private Codex CLI/TUI thread that ran from 2026-07-17 14:19 UTC through 2026-07-18 16:55 UTC, beginning from repository commit `4e3644d`.

The retained local session ledger proves all of the following:

- its working directory and Git repository were Signmos;
- its persistent objective was to implement issues #43–#51 through TDD, commit and push each slice, close each GitHub issue, and produce a per-issue evidence table;
- every recorded model context used `gpt-5.6-sol` through Codex;
- the thread applied 250 successful patches with no failed patch application recorded;
- the thread contains every qualifying Agentic feature commit from `f396721` through `9183acc`, followed by the Codex-co-authored documentation commit `fab718b`;
- the thread contains the test, type, lint, build, smoke, calibration, GitHub-state, commit, and push evidence used to finish the objective.

The private thread identifier must be recovered locally and submitted through `/feedback`. It must not be added to this repository, an issue, a video frame, or another public artifact.

## Supporting Codex planning thread

The immediately preceding Codex thread ran from 2026-07-17 13:07 UTC through 14:18 UTC and also records `gpt-5.6-sol` for every model context. It is supporting workflow evidence, not the `/feedback` primary thread, because the later thread performed the qualifying implementation.

In the planning thread, the human began with the concrete product goal: every UI action should be possible through curl; the landing page should offer a fourth Agentic mode; a user should receive a personal Bearer token after email verification; and the token page should provide public Markdown guidance for an agent. Codex first audited the existing API, then ran a 46-decision interview. The human selected or explicitly confirmed each answer, approved the seven-component architecture, required validation for every component, approved the eight tracer-bullet phases, and approved dispatch of issues #44–#51.

## Qualifying commit map

Automated release commits produced between these commits are not presented as Codex-authored product work.

| Issue | Qualifying commit | Delivered extension |
| --- | --- | --- |
| #43 | [`f396721`](https://github.com/auditmos/signmos/commit/f396721b6e437ab197fd189ea3582a92b06ce68d) | Agentic-mode PRD, architectural decisions, vertical TDD plan, and eight implementation slices |
| #44 | [`116a96f`](https://github.com/auditmos/signmos/commit/116a96ff1ae6ffaeabb220db997dd7ef0c790d47) | Verified-email Agentic onboarding, isolated management session, one-time personal token, first Bearer identity call, and public contract tracer |
| #45 | [`a60b780`](https://github.com/auditmos/signmos/commit/a60b7807669a01ea6735a6b6bfc1938109b2c8d3) | Five-token lifecycle, safe metadata, independent immediate revocation, and management-console behavior |
| #46 | [`005dde6`](https://github.com/auditmos/signmos/commit/005dde643215a272fe05081a46866590258a3952) | Role-authorized read-only document catalog, detail, history, retention, source, and final-PDF API |
| #47 | [`46f2b2c`](https://github.com/auditmos/signmos/commit/46f2b2c504628c6a4720608f6b64dd48fd1dd098) | Bearer-authenticated self-sign creation, PDF preparation, fields, profiles, signing, and idempotent commands |
| #48 | [`db3ed74`](https://github.com/auditmos/signmos/commit/db3ed74fbf191723920f2573fec88d2219a50fa0) | Two-party creator preparation, recipient/field management, delivery, and resend workflows |
| #49 | [`6343f1e`](https://github.com/auditmos/signmos/commit/6343f1eb175ef688a0b5bcd8c5a4f48b9bc1e6e2) | Token-authenticated partner review, completion, change request, and decline decisions |
| #50 | [`bd75576`](https://github.com/auditmos/signmos/commit/bd75576d2ed61c3d4e65ce3fea27804a7174ea0e) | Revision loop plus creator cancel, expire, delete, and retention controls |
| #51 | [`9183acc`](https://github.com/auditmos/signmos/commit/9183acc2de655cbc9fd88c6bf81c753ab551fc43) | Runtime/OpenAPI parity, credential-canary checks, calibrated limits, lifecycle smoke, browser evidence, and the 44-story release ledger |
| Docs | [`fab718b`](https://github.com/auditmos/signmos/commit/fab718b525dbfa7a8c73b08adc3dd051a3c99684) | Public Agentic API, architecture, operator, and release documentation |

The retained feature evidence is indexed by [Agentic Mode Parity And Compatibility Release Evidence](./agentic-mode-release/release-evidence.md). It maps all 44 PRD stories and all numeric/security bounds to named tests, measurements, smoke results, or browser artifacts.

## Specific Codex contributions

1. **Turned the Agentic product contract into testable vertical slices.** Codex maintained the issue-by-issue TDD workflow from onboarding through complete creator and signer parity, rather than creating a disconnected demo endpoint.
2. **Implemented the security-sensitive credential and authorization boundaries.** The thread built hash-only personal tokens, scanner-safe one-time email credentials, an isolated short-lived management session, per-request role authorization, immediate revocation, idempotency, audit attribution, and credential-redaction coverage.
3. **Implemented the complete public agent document lifecycle.** Codex connected the new Bearer API to existing envelope domains for catalog, PDF preparation, recipients, fields, signing decisions, revisions, lifecycle controls, and final artifacts while retaining browser compatibility.
4. **Produced executable release evidence.** The thread added runtime-parity `/openapi.json`, `/agent.md`, a credential-canary suite, measured rate-limit calibration, lifecycle and browser smokes, and a requirement-by-requirement release ledger.

## Human direction and decisions

The retained thread directly proves that the human participant:

- defined the initial product outcome: full curl parity with the UI, a fourth Agentic landing choice, email-verified Bearer-token generation, future CLI compatibility, and public agent guidance;
- made or confirmed 46 planning decisions, including full role-equivalent personal tokens, multiple named credentials, no v1 scopes, separate email-verified token management, 30-minute/15-minute credential boundaries, `/api/v1`, `/agent.md` plus OpenAPI, environment-variable secret handling, universal mutation idempotency, a five-token cap, polling, and full parity as the release gate;
- explicitly chose immediate goal-directed high-impact operations, no token-lifecycle security emails, a general-business personal pilot, a platform-neutral prompt, and deferral of the standalone CLI;
- approved the seven-component architecture, all-component validation, the eight-phase implementation plan, and the eight dispatched issues;
- set the implementation completion contract: issues #43–#51 had to be implemented through TDD, committed, pushed, closed, and supported by per-issue evidence;
- directed the long-running work to continue/resume and separately requested that public documentation be reviewed, updated, committed, and pushed;
- retained final responsibility for product/security tradeoffs, release claims, and submission approval rather than delegating the go/no-go decision to model output.

Codex proposed multiple choices and recommendations during the interview; the human selected and confirmed the resulting product/security contract. The demo should describe this accurately as human decision-making supported by Codex analysis, not imply that either party worked alone.

## Other-tool disclosure

The primary thread metadata records Codex with GPT-5.6 and no other model label. The qualifying commit history contains no Claude/Anthropic co-author trailer. A metadata/content-match review of the available local Claude history found no Claude session rooted in the Signmos repository and no reference to any qualifying Agentic commit. The Signmos matches that did exist were unrelated cross-project repository/security inventories before Build Week and a July 16 portfolio repository-list lookup from another project; they are not material authorship of this extension.

The repository contains tool-neutral and Claude-oriented agent guidance, but configuration files alone do not prove Claude authorship. Based on the local histories available, no material Claude contribution to the qualifying Agentic range was found. The participant must override this statement in the Devpost form and demo narration if they know of material remote, deleted, or otherwise unavailable AI-tool use. This record attributes only work supported by Codex session and Git evidence.

## Submission-safe workflow description

> We extended the existing Signmos e-signature app during Build Week with a personal Agentic mode and a complete Bearer-authenticated document API. First, the human used a structured Codex/GPT-5.6 audit and decision interview to define the product, security, and release contract, then approved the architecture, eight TDD phases, and GitHub issue graph. In the primary build thread, Codex worked through issues #43–#51 as vertical slices: reading each live contract, writing boundary tests first, implementing the slice, running the project gates, committing and pushing, and verifying GitHub issue state. Codex was especially valuable for carrying authorization, idempotency, credential-redaction, API/runtime parity, and regression requirements consistently across the full lifecycle; the human made the product tradeoffs, steered continuation and documentation, and retained the final release and submission decisions.

## Private submission checklist

| Item | Status | Evidence or next action |
| --- | --- | --- |
| Genuine primary build thread identified | Verified | Private 2026-07-17/18 Codex thread; current audit thread explicitly excluded |
| GPT-5.6 use in primary thread | Verified | Every retained model context reports `gpt-5.6-sol` |
| Thread mapped to qualifying work | Verified | Commits/issues #43–#51 and `fab718b` above |
| Three or more specific Codex contributions | Verified | Four contributions documented above |
| Human direction and decision boundary | Verified | Initial product request, 46 confirmed decisions, architecture/phase/issue approvals, implementation objective, continuation, and documentation direction are retained |
| Other AI/tool disclosure | Locally verified; participant attestation pending | No material Claude contribution found in available local history or qualifying commits; disclose any unavailable use known to the participant |
| `/feedback` Session ID | Verified privately | `/feedback` was recorded in the identified primary thread; paste the returned identifier only into Devpost |
| README alignment | Verified | README links this evidence and summarizes the same workflow |
| Video narration alignment | Awaiting submission work | Use the submission-safe description and show the qualifying features/commit evidence |
| Devpost form alignment | Awaiting submission work | Use the private Session ID and the same dates, scope, attribution, and disclosures |

This record is evidence for a submission decision, not an organizer eligibility determination.
