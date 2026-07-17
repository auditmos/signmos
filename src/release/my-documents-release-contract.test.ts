import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("My documents release credential and scope guard", () => {
	it("keeps credentials hashed at rest and out of logs, browser storage, and history URLs", () => {
		const table = read("src/db/history-access/table.ts");
		const historyApi = ["history-access.ts", "history-creator.ts", "history-signing.ts"]
			.map((file) => read(`src/hono/api/${file}`))
			.join("\n");
		const historyUi = [
			"history-access-confirmation-page.tsx",
			"history-creator-page.tsx",
			"history-document-detail-page.tsx",
			"history-documents-page.tsx",
		]
			.map((file) => read(`src/components/history/${file}`))
			.join("\n");
		const confirmation = read("src/components/history/history-access-confirmation-page.tsx");

		expect(table).toContain('credentialHash: text("credential_hash")');
		expect(table).toContain('sessionHash: text("session_hash")');
		expect(table).not.toMatch(/(?:credential|session)(?:Token|Secret): text\(/);
		expect(`${historyApi}\n${historyUi}`).not.toMatch(/console\.(?:log|info|warn|error)/);
		expect(historyUi).not.toMatch(/(?:localStorage|sessionStorage)/);
		expect(historyUi).not.toMatch(/[?&](?:senderSessionToken|signerToken|token)=/);
		expect(confirmation).not.toMatch(/queryKey:\s*\[[^\]]*credential/);
		expect(historyApi).toContain('CLOUDFLARE_ENV !== "production"');
	});

	it("contains no account, linked-identity, analytics, retry-outbox, or compliance expansion", () => {
		const schema = read("src/db/schema.ts");
		const historyTables = read("src/db/history-access/table.ts");
		const packageJson = read("package.json");
		const historyUi = [
			"history-request-form.tsx",
			"history-documents-page.tsx",
			"history-document-detail-page.tsx",
		]
			.map((file) => read(`src/components/history/${file}`))
			.join("\n");

		expect(`${schema}\n${historyTables}`).not.toMatch(
			/(?:passwordHash|userAccounts|linkedEmails|analyticsEvents|emailOutbox|retryQueue)/,
		);
		expect(packageJson).not.toMatch(/(?:segment|mixpanel|amplitude|posthog|analytics-node)/i);
		expect(historyUi).not.toMatch(
			/(?:certified|qualified|regulated-industry|trust-service|eIDAS compliant)/i,
		);
	});

	it("mounts creator and signer recovery children through the envelope route outlet", () => {
		const historyParent = read("src/routes/my-documents.tsx");
		const catalogIndex = read("src/routes/my-documents.index.tsx");
		const parentRoute = read("src/routes/my-documents.$envelopeId.tsx");
		const detailIndex = read("src/routes/my-documents.$envelopeId.index.tsx");

		expect(historyParent).toContain("<Outlet />");
		expect(catalogIndex).toContain('createFileRoute("/my-documents/")');
		expect(parentRoute).toContain("<Outlet />");
		expect(detailIndex).toContain('createFileRoute("/my-documents/$envelopeId/")');
	});

	it("retains passing browser, keyboard, and scope release evidence", () => {
		const browser = read("plans/evidence/my-documents-release/browser-smokes.md");
		const keyboard = read("plans/evidence/my-documents-release/keyboard-walkthrough.md");
		const scope = read("plans/evidence/my-documents-release/scope-review.md");

		expect(browser).toContain("## Self-sign — PASS");
		expect(browser).toContain("## Two-party — PASS");
		expect(browser).toContain("## My Documents recovery — PASS");
		expect(browser).toContain("## Security-stream observation — PASS");
		expect(keyboard).toContain("Result: PASS");
		expect(keyboard).toContain("| Creator dialogs |");
		expect(keyboard).toContain("| Expired session |");
		expect(scope).toContain("Result: PASS");
		expect(scope).toContain("| Credential migration |");
		expect(scope).toContain("| Performance/capacity |");
	});
});
