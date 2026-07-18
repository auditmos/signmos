import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { agenticSecurityEvents } from "@/db/agentic-access";
import { emailSendRecords } from "@/db/envelope";
import { apiHono } from "@/hono/api";
import {
	agentHeaders,
	creatorToken,
	resetAgentPartnerFixture,
} from "@/hono/api/agent-partner-test-fixture";
import { selfSignRows as rows } from "@/hono/api/agent-self-sign-test-db";
import { publicAgentContractHono } from "@/hono/public-agent-contract";

vi.mock("@/db/setup", async () => {
	const { getAgentSelfSignTestDb } = await import("@/hono/api/agent-self-sign-test-db");
	return { getDb: getAgentSelfSignTestDb };
});

describe("agent credential redaction", () => {
	beforeEach(resetAgentPartnerFixture);
	afterEach(() => vi.restoreAllMocks());

	it("keeps Bearer canaries out of URLs, redirects, later responses, errors, logs, audits, and email records", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const tokenHash = createHash("sha256").update(creatorToken).digest("hex");
		const responses = [
			await apiHono.request("/api/v1/me", { headers: agentHeaders(creatorToken) }),
			await apiHono.request("/api/v1/documents/90000000-0000-4000-8000-000000000099", {
				headers: agentHeaders(creatorToken),
			}),
			await apiHono.request("/api/v1/documents", {
				method: "POST",
				headers: agentHeaders(creatorToken),
				body: JSON.stringify({ name: "Missing key canary" }),
			}),
		];
		const captured = await Promise.all(responses.map(serializeResponse));
		const operational = JSON.stringify({
			captured,
			securityEvents: rows(agenticSecurityEvents),
			emailRecords: rows(emailSendRecords),
			logs: [...log.mock.calls, ...info.mock.calls, ...warn.mock.calls, ...error.mock.calls],
		});
		expect(operational).not.toContain(creatorToken);
		expect(operational).not.toContain(tokenHash);
		for (const response of responses) {
			expect(response.url).not.toContain(creatorToken);
			expect(response.headers.get("location") ?? "").not.toContain(creatorToken);
			expect(response.headers.get("authorization")).toBeNull();
			expect(response.headers.get("set-cookie")).toBeNull();
		}
	});

	it("keeps public docs and retained release fixtures free of reusable credential shapes", async () => {
		const publicResponses = await Promise.all([
			publicAgentContractHono.request("/agent.md"),
			publicAgentContractHono.request("/openapi.json"),
		]);
		const publicText = (await Promise.all(publicResponses.map((response) => response.text()))).join(
			"\n",
		);
		expect(publicText).not.toMatch(/Bearer signmos_[A-Za-z0-9_-]{16,}/);
		expect(publicText).not.toMatch(/[?&](?:token|credential|session)=[^\s&"']+/i);

		const evidenceRoot = resolve("plans/evidence/agentic-mode-release");
		expect(statSync(evidenceRoot).isDirectory()).toBe(true);
		const retainedBytes = recursiveFiles(evidenceRoot).map((file) => readFileSync(file));
		for (const bytes of retainedBytes) {
			const retained = bytes.toString("latin1");
			expect(retained).not.toMatch(/signmos_[A-Za-z0-9_-]{16,}/);
			expect(retained).not.toMatch(/#[A-Za-z0-9_-]{16,}/);
			expect(retained).not.toMatch(/\b[a-f0-9]{64}\b/);
		}
		const packageJson = readFileSync(resolve("package.json"), "utf8");
		expect(packageJson).not.toMatch(/segment|mixpanel|amplitude|posthog/i);
	});
});

async function serializeResponse(response: Response) {
	return {
		status: response.status,
		url: response.url,
		headers: Object.fromEntries(response.headers.entries()),
		body: await response.clone().text(),
	};
}

function recursiveFiles(directory: string): string[] {
	return readdirSync(directory).flatMap((entry) => {
		const path = resolve(directory, entry);
		return statSync(path).isDirectory() ? recursiveFiles(path) : [path];
	});
}
