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
SHA-256 0cad6549767f281f4d48d361ca0322e936b98ec56b80156cf91cec9c5796c917
27 direct dependencies; 24 direct development dependencies
```

Commands executed against the lockfile-matched installation:

```bash
pnpm install --frozen-lockfile
pnpm licenses list --json
pnpm licenses list --prod --json
pnpm why lightningcss
pnpm why caniuse-lite
pnpm why @img/sharp-libvips-darwin-arm64
```

The frozen installation exited zero. The all-dependency scan returned 624
package records across these 20 declared license expressions:

| License expression | Package records |
| --- | ---: |
| MIT | 534 |
| ISC | 30 |
| Apache-2.0 | 19 |
| BSD-3-Clause | 14 |
| MIT OR Apache-2.0 | 5 |
| BSD-2-Clause | 4 |
| CC0-1.0 | 3 |
| MIT-0 | 2 |
| MPL-2.0 | 2 |
| `(BSD-2-Clause OR MIT OR Apache-2.0)` | 1 |
| `(MIT AND Zlib)` | 1 |
| `(MIT OR CC0-1.0)` | 1 |
| 0BSD | 1 |
| Artistic-2.0 | 1 |
| BlueOak-1.0.0 | 1 |
| CC-BY-3.0 | 1 |
| CC-BY-4.0 | 1 |
| LGPL-3.0-or-later | 1 |
| Python-2.0 | 1 |
| Unlicense | 1 |

No scan entry was unknown, custom, unlicensed, GPL, or AGPL.

The production-filtered scan returned 236 package records. Its review set was
`caniuse-lite` under CC-BY-4.0 and `lightningcss` plus its current-platform
binary under MPL-2.0. Dependency tracing showed both are build-toolchain data
or transformers, not copied Signmos application source.

The all-dependency review additionally found:

- `@img/sharp-libvips-darwin-arm64@1.2.4`, declaring
  LGPL-3.0-or-later, reached through `sharp -> miniflare ->`
  Cloudflare development tooling;
- `spdx-exceptions@2.5.0`, declaring CC-BY-3.0, used by
  development/release license metadata;
- no unknown/custom entries and no strong-copyleft GPL/AGPL entry.

The lockfile also enumerates optional binaries for non-current operating
systems and CPU architectures. They are platform variants of the reviewed
Biome, workerd, emnapi, esbuild, sharp/libvips, napi-rs, Oxc, Rollup,
Tailwind Oxide, and Lightning CSS package families and remain under those
upstream families' own declared licenses.

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
