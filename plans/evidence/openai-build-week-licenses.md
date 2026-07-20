# OpenAI Build Week License Review

Date: 2026-07-20

Submission route: public repository with MIT licensing

Approved copyright holder: Tomasz Kowalczyk

## Owner decision and scope

The individual entrant approved MIT for project-owned Signmos code,
documentation, and assets and confirmed authority to license them. MIT permits
commercial and non-commercial use, modification, distribution, sublicensing,
and sale subject to retention of the copyright and license notice.

Third-party material remains under its original terms. The Signmos `LICENSE`
does not purport to relicense package dependencies, generated/copied Shadcn UI
material, service APIs, or third-party trademarks.

## Exact dependency evidence

Reviewed lockfile:

```text
pnpm-lock.yaml
SHA-256 a1ac704f8f2ab9c1de74ca73ab4daf3aad86c6f28e6b8ec32c99911c7f017b82
27 direct dependencies; 24 direct development dependencies
```

The public commit's lockfile was read directly from Git rather than from the
uncommitted working tree. Commands and checks included:

```bash
git show HEAD:pnpm-lock.yaml | shasum -a 256
pnpm licenses list --json
pnpm licenses list --prod --json
pnpm why lightningcss
pnpm why caniuse-lite
pnpm why @img/sharp-libvips-darwin-arm64
```

The exact committed lockfile contains 935 package identities. The audit matched
713 current-platform package manifests and grouped the other 222 identities as
optional binaries for non-current operating systems and CPU architectures.
Every missing identity belonged to a reviewed Biome, workerd, emnapi, esbuild,
sharp/libvips, napi-rs, Oxc, Rollup, Tailwind Oxide, or Lightning CSS package
family; no unmatched package family remained.

The 713 current-platform identities declared these 20 license expressions:

| License expression | Package records |
| --- | ---: |
| MIT | 606 |
| ISC | 37 |
| Apache-2.0 | 23 |
| BSD-3-Clause | 15 |
| MIT OR Apache-2.0 | 5 |
| BSD-2-Clause | 5 |
| `(MIT OR CC0-1.0)` | 4 |
| CC0-1.0 | 3 |
| 0BSD | 2 |
| MIT-0 | 2 |
| MPL-2.0 | 2 |
| `(BSD-2-Clause OR MIT OR Apache-2.0)` | 1 |
| `(MIT AND Zlib)` | 1 |
| Artistic-2.0 | 1 |
| BlueOak-1.0.0 | 1 |
| CC-BY-3.0 | 1 |
| CC-BY-4.0 | 1 |
| LGPL-3.0-or-later | 1 |
| Python-2.0 | 1 |
| Unlicense | 1 |

No scan entry was unknown, custom, unlicensed, GPL, or AGPL.

The explicit review set was:

- `@img/sharp-libvips-darwin-arm64@1.2.4`, declaring
  LGPL-3.0-or-later, reached through `sharp -> miniflare ->`
  Cloudflare development tooling;
- `spdx-exceptions@2.5.0`, declaring CC-BY-3.0, used by
  development/release license metadata;
- no unknown/custom entries and no strong-copyleft GPL/AGPL entry.

Dependency tracing also confirmed that `caniuse-lite` and Lightning CSS are
build-toolchain data/transformers rather than copied Signmos application
source. All optional platform variants remain under their upstream families'
own declared licenses.

## Vendored, generated, template, font, icon, and media review

| Material | Provenance and permitted use | Result |
| --- | --- | --- |
| Pre-existing project scaffold | Initial commit `d07f882`; owner-authored/assembled scaffold whose initial README declared MIT intent; third-party frameworks stay separately licensed | Verified |
| `src/components/ui/*` | Generated/adapted Shadcn UI components; upstream MIT notice reproduced in `THIRD_PARTY_NOTICES.md` | Verified |
| Lucide icons | Imported through ISC-licensed `lucide-react`; not copied as unexplained binaries | Verified |
| Signmos logo/favicon/touch/OG/thumbnail | Project-owned/generated and approved by owner for MIT distribution | Verified |
| Evidence screenshots and smoke PDF | Produced for Signmos with synthetic data; no customer document/signature identity | Verified |
| Fonts | No local font files or remote font provider; system font stack only | Verified |
| Final video/music | No final video or music committed at review time; must be cleared under #55/#60 before submission | Not applicable to repository candidate yet |

No asset or code with unresolved repository-use permission was identified in
this review. Future media added after this evidence date must be reviewed again
before the final candidate is frozen.

## Conclusion

The public MIT route is internally consistent for the reviewed repository
state. Root project licensing, copied-component notice, dependency-license
classification, owner-approved project asset provenance, and non-relicensing
boundaries are documented. This is a repository compliance review, not an
independent legal opinion.
