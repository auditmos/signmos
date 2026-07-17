# [1.2.0](https://github.com/auditmos/signmos/compare/v1.1.0...v1.2.0) (2026-07-17)


### Features

* add Agentic read-only document API ([#46](https://github.com/auditmos/signmos/issues/46)) ([005dde6](https://github.com/auditmos/signmos/commit/005dde643215a272fe05081a46866590258a3952))

# [1.1.0](https://github.com/auditmos/signmos/compare/v1.0.0...v1.1.0) (2026-07-17)


### Features

* add Agentic token lifecycle management ([#45](https://github.com/auditmos/signmos/issues/45)) ([a60b780](https://github.com/auditmos/signmos/commit/a60b7807669a01ea6735a6b6bfc1938109b2c8d3))

# 1.0.0 (2026-07-17)


### Features

* add verified Agentic onboarding ([#44](https://github.com/auditmos/signmos/issues/44)) ([116a96f](https://github.com/auditmos/signmos/commit/116a96ff1ae6ffaeabb220db997dd7ef0c790d47))

# Unreleased (2026-07-17)

### Features

* add an unselected landing chooser for self-signing, two-party signing, and My Documents
* add privacy-safe passwordless My Documents access with a single-use 30-minute link and fixed eight-hour browser session
* add a full retained-document catalog with creator/signer roles, lifecycle groups, search, filters, and numbered pagination
* add history-session creator recovery and controls, active signer recovery, completed-document detail, and final PDF download
* allow an active My Documents session to start an already-verified self-sign or two-party draft

### Security and compatibility

* store history link and session credentials only as hashes, keep security events out of the user-facing document timeline, and re-check role/state authorization for history access
* preserve existing sender, signer, verification, completed-document, and final-download process links alongside the history-session path
* add browser-smoke, keyboard, scope, credential-hygiene, nested-route, and compatibility release evidence

# [1.2.0](https://github.com/auditmos/tstack-on-cf/compare/v1.1.0...v1.2.0) (2026-05-05)


### Features

* add init-project script for onboarding fresh clones ([82be9c8](https://github.com/auditmos/tstack-on-cf/commit/82be9c81ff03732b0655b0087139eb0b18d67b1c))

# [1.1.0](https://github.com/auditmos/tstack-on-cf/compare/v1.0.0...v1.1.0) (2026-04-09)


### Features

* add claude rules, agents, error infra, remove demo endpoint ([136b6a9](https://github.com/auditmos/tstack-on-cf/commit/136b6a90dda0c5ef70aa585161756803af0d70da))
* add clients CRUD UI, hooks, initial migration ([cc0e826](https://github.com/auditmos/tstack-on-cf/commit/cc0e8269163c5ef7ea82ed97cff4035b4444f7d7))
* add Neon PostgreSQL + Drizzle ORM database layer ([6de059a](https://github.com/auditmos/tstack-on-cf/commit/6de059a5483ade15f356ef6155e6967a5a20e376))

# 1.0.0 (2026-03-16)


### Bug Fixes

* specify packageManager for pnpm action-setup ([03ce86c](https://github.com/auditmos/tstack-on-cf/commit/03ce86ce7c313943d5bda304d036b8252d7ce08f))
