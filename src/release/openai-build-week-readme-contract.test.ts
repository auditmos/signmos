import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";

const read = (path: string) => readFileSync(resolve(path), "utf8");

/**
 * Issue #58 assumptions:
 * - The last commit before 2026-07-13 (`a47990b`) is the public pre-window
 *   baseline; later commits are not represented as a from-scratch build.
 * - Judges should evaluate My Documents, Agentic mode, and matching-human
 *   review as the meaningful Build Week product slices.
 * - The judge quick path targets desktop Chromium, the browser family used by
 *   retained smokes. Other browsers are not claimed without evidence.
 * - The verified public judge origin is `https://signmos.com`; the README names
 *   its public Agent guide and OpenAPI contract without treating endpoint
 *   availability as proof that the pending #61 end-to-end smokes passed.
 * - All sample names/content are synthetic, but judges use inboxes they control
 *   because production verification links are delivered by email.
 */
describe("OpenAI Build Week README release contract", () => {
	it("states the pre-window baseline and maps every qualifying product slice", () => {
		const readme = read("README.md");

		expect(readme).toContain("## OpenAI Build Week Submission");
		expect(readme).toContain("2026-07-13 Submission Period");
		expect(readme).toContain("a47990b");
		expect(readme).toContain("2026-07-11");
		for (const phrase of [
			"My Documents",
			"Agentic mode",
			"Matching-human review",
			"./plans/evidence/my-documents-release/",
			"./plans/evidence/agentic-mode-release/release-evidence.md",
			"./plans/evidence/human-review/release-evidence.md",
		]) {
			expect(readme, phrase).toContain(phrase);
		}
	});

	it("discloses pre-existing, third-party, generated, AI-assisted, and legal boundaries", () => {
		const readme = read("README.md");

		for (const phrase of [
			"### Pre-existing and third-party work",
			"TanStack Start scaffold",
			"Shadcn",
			"src/routeTree.gen.ts",
			"worker-configuration.d.ts",
			"generated Drizzle migrations",
			"no material Claude contribution was found",
			"./THIRD_PARTY_NOTICES.md",
			"./plans/evidence/openai-build-week-licenses.md",
			"### Pilot and human-review limits",
			"not certified",
			"qualified",
			"regulated",
			"universally enforceable",
			"sign/complete, decline, cancel, expire, and delete",
			"matching signer or creator",
		]) {
			expect(readme, phrase).toContain(phrase);
		}
	});

	it("provides a valid synthetic sample and complete human and Agentic judge paths", async () => {
		const readme = read("README.md");
		const sample = await PDFDocument.load(
			readFileSync(resolve("public/signmos-build-week-sample.pdf")),
		);

		expect(sample.getPageCount()).toBe(1);
		for (const phrase of [
			"### Judge quick path",
			"Work and Productivity",
			"https://signmos.com",
			"https://signmos.com/agent.md",
			"https://signmos.com/openapi.json",
			"do not need to provision",
			"#61",
			"desktop Chromium",
			"./public/signmos-build-week-sample.pdf",
			"Alex Example",
			"Jordan Sample",
			"inbox you control",
			"No shared test account",
			"#### Human flow",
			"Sign by myself",
			"My Documents",
			"#### Agentic flow",
			"Agentic mode",
			"pending_human_review",
			"Approve and execute",
			"revoke",
		]) {
			expect(readme, phrase).toContain(phrase);
		}
		expect(readme).not.toContain("a stable HTTPS judge deployment is not yet verified");
		expect(readme).not.toContain(
			"This README will name the exact candidate URL only after that gate passes",
		);
	});

	it("documents reproducible local setup, services, bindings, and every template variable", () => {
		const readme = read("README.md");
		const templateVariables = [...read(".example.vars").matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(
			(match) => match[1],
		);

		for (const phrase of [
			"### Local setup requirements",
			"current Node.js LTS",
			"pnpm 11.15.0",
			"Neon Postgres",
			"Cloudflare Workers",
			"Cloudflare R2",
			"Resend",
			"Cloudflare Turnstile",
			"`DOCUMENTS_BUCKET`",
			"`pnpm install`",
			"`pnpm cf-typegen`",
			"`pnpm db:migrate:dev`",
			"`pnpm dev`",
			"Never commit `.dev.vars`",
		]) {
			expect(readme, phrase).toContain(phrase);
		}

		for (const variable of templateVariables) {
			expect(readme, variable).toContain(`\`${variable}\``);
		}
	});

	it("keeps README evidence links resolvable and documented project scripts executable", () => {
		const readme = read("README.md");
		const packageJson = JSON.parse(read("package.json")) as {
			scripts?: Record<string, string>;
		};
		const relativeTargets = [...readme.matchAll(/\]\((\.\/[^)#]+)(?:#[^)]+)?\)/g)].map(
			(match) => match[1],
		);

		expect(readme).toContain(
			"[`src/release/openai-build-week-readme-contract.test.ts`](./src/release/openai-build-week-readme-contract.test.ts)",
		);
		expect(relativeTargets.length).toBeGreaterThan(0);
		for (const target of relativeTargets) {
			expect(existsSync(resolve(target)), target).toBe(true);
		}

		for (const script of [
			"dev",
			"build",
			"cf-typegen",
			"test",
			"agentic:smoke",
			"types",
			"lint",
			"knip",
			"db:migrate:dev",
		]) {
			expect(packageJson.scripts?.[script], script).toBeTruthy();
		}
	});
});
