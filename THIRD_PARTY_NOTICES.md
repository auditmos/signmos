# Third-Party Notices

Signmos is distributed under the [MIT License](./LICENSE). That license covers
the project-owned Signmos code, documentation, and assets; it does not replace
or modify the licenses of third-party software, data, or services.

## Package dependencies

JavaScript dependencies are declared in `package.json` and resolved exactly in
`pnpm-lock.yaml`. Each package remains under the license shipped by its
copyright holder. The retained Build Week license review is in
[`plans/evidence/openai-build-week-licenses.md`](./plans/evidence/openai-build-week-licenses.md).

The review found permissive MIT, Apache-2.0, BSD, ISC, 0BSD, MIT-0, Zlib,
Artistic-2.0, BlueOak-1.0.0, Python-2.0, Unlicense, and CC0 dependencies, plus
the following dependencies that merit explicit notice:

| Dependency | License | Use in Signmos |
| --- | --- | --- |
| `lightningcss` and its native binary | MPL-2.0 | CSS build transformer reached through Tailwind, TanStack Start, and Vite. Signmos does not vendor, modify, or relicense it. |
| `@img/sharp-libvips-*` | LGPL-3.0-or-later as declared by the installed npm package | Native image-processing dependency reached through development-only Cloudflare/Miniflare tooling. It is not Signmos application source. |
| `caniuse-lite` | CC-BY-4.0 | Browser compatibility data used by the build toolchain. |
| `spdx-exceptions` | CC-BY-3.0 | SPDX metadata used by development/release tooling. |

Package license texts, copyright notices, and source/homepage metadata remain
available in each installed package and its linked upstream project. Consumers
redistributing those packages must follow their respective terms.

## Copied or generated UI material

Files under `src/components/ui/` were generated from or adapted from
[shadcn/ui](https://github.com/shadcn-ui/ui), which is distributed under the
MIT License:

> MIT License
> Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Lucide icons are imported through `lucide-react`, which declares the ISC
license. TanStack, React, Hono, Drizzle, Tailwind, Cloudflare, Neon, Resend, and
other named products remain the property and trademarks of their respective
owners; descriptive references do not imply endorsement.

## Project scaffold and assets

- The pre-existing Signmos/TanStack Start on Cloudflare scaffold first appears
  in repository commit `d07f882`. Its README stated the intent to distribute
  the scaffold under MIT; the current root `LICENSE` now records the approved
  project license.
- The Signmos logo, favicon family, Apple touch icon, Open Graph image, and
  thumbnail are project-owned/generated assets approved by the owner for
  distribution with Signmos under MIT.
- Retained repository screenshots and the smoke-test PDF use synthetic
  Signmos data and are approved project evidence, not customer material.
- No third-party font files are stored in the repository; the application uses
  a system font stack.
- No final demo-video or music asset is committed at this review point. Any
  later submission media remains subject to the separate provenance and video
  gates before submission.

## Hosted services

Cloudflare, Neon, and Resend are hosted-service integrations governed by their
own service terms. Their software, marks, APIs, and infrastructure are not
relicensed by the Signmos MIT License.
