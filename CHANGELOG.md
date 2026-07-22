## [1.9.3](https://github.com/auditmos/signmos/compare/v1.9.2...v1.9.3) (2026-07-22)


### Bug Fixes

* align task chooser back button placement ([e4e5bdb](https://github.com/auditmos/signmos/commit/e4e5bdb13cbfe62c04bc3c11d5f73730081f6173))
* sync landing choices with browser history ([bf5b65d](https://github.com/auditmos/signmos/commit/bf5b65d6de7dd9a4c8bad243a6be4029b7ebac78))
* tailor landing copy to selected task ([33b69c9](https://github.com/auditmos/signmos/commit/33b69c91bc02dc97e0cae6a28af5aa5624fec3bf))
* unify task chooser back buttons ([7bac22c](https://github.com/auditmos/signmos/commit/7bac22c3d1880e759e30431b138cc8336190993a))

## [1.9.2](https://github.com/auditmos/signmos/compare/v1.9.1...v1.9.2) (2026-07-21)


### Bug Fixes

* remove unsupported Wrangler deploy flag ([#61](https://github.com/auditmos/signmos/issues/61)) ([858e750](https://github.com/auditmos/signmos/commit/858e750ccaa126c8184404a38d58cf004d6c4736))

## [1.9.1](https://github.com/auditmos/signmos/compare/v1.9.0...v1.9.1) (2026-07-21)


### Bug Fixes

* deploy production secrets atomically ([#61](https://github.com/auditmos/signmos/issues/61)) ([db3766c](https://github.com/auditmos/signmos/commit/db3766c00f2ec9562854ec3f11e6ecbe4154ac5e))

# [1.9.0](https://github.com/auditmos/signmos/compare/v1.8.0...v1.9.0) (2026-07-20)


### Features

* **agentic:** require human review for protected actions ([2ae9c55](https://github.com/auditmos/signmos/commit/2ae9c55b5827707df614f62368e98fc45669fe20)), closes [hi#impact](https://github.com/hi/issues/impact)

# [1.8.0](https://github.com/auditmos/signmos/compare/v1.7.0...v1.8.0) (2026-07-20)


### Features

* **ui:** refine landing task chooser ([b54cb3f](https://github.com/auditmos/signmos/commit/b54cb3fdfb8bf1346bb2a2d1e117425014b82842))

# [1.7.0](https://github.com/auditmos/signmos/compare/v1.6.0...v1.7.0) (2026-07-18)


### Features

* publish measured Agentic release evidence ([#51](https://github.com/auditmos/signmos/issues/51)) ([9183acc](https://github.com/auditmos/signmos/commit/9183acc2de655cbc9fd88c6bf81c753ab551fc43))

# [1.6.0](https://github.com/auditmos/signmos/compare/v1.5.0...v1.6.0) (2026-07-18)


### Features

* add Agentic revision and creator controls ([#50](https://github.com/auditmos/signmos/issues/50)) ([bd75576](https://github.com/auditmos/signmos/commit/bd75576d2ed61c3d4e65ce3fea27804a7174ea0e))

# [1.5.0](https://github.com/auditmos/signmos/compare/v1.4.0...v1.5.0) (2026-07-18)


### Features

* add Agentic partner signing decisions ([#49](https://github.com/auditmos/signmos/issues/49)) ([6343f1e](https://github.com/auditmos/signmos/commit/6343f1eb175ef688a0b5bcd8c5a4f48b9bc1e6e2))

# [1.4.0](https://github.com/auditmos/signmos/compare/v1.3.0...v1.4.0) (2026-07-18)


### Features

* add Agentic two-party creator delivery ([#48](https://github.com/auditmos/signmos/issues/48)) ([db3ed74](https://github.com/auditmos/signmos/commit/db3ed74fbf191723920f2573fec88d2219a50fa0))

# [1.3.0](https://github.com/auditmos/signmos/compare/v1.2.0...v1.3.0) (2026-07-17)


### Features

* add Agentic self-sign lifecycle ([#47](https://github.com/auditmos/signmos/issues/47)) ([46f2b2c](https://github.com/auditmos/signmos/commit/46f2b2c504628c6a4720608f6b64dd48fd1dd098))

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
