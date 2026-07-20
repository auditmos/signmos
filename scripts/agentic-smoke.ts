import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";

export const agentLifecycleSmokeFiles = [
	"src/release/agentic-smoke.test.ts",
	"src/hono/api/agent-self-sign.test.ts",
	"src/hono/api/agent-self-sign-fields.test.ts",
	"src/hono/api/agent-two-party.test.ts",
	"src/hono/api/agent-two-party-delivery.test.ts",
	"src/hono/api/agent-partner-change-request.test.ts",
	"src/hono/api/agent-partner-decline.test.ts",
	"src/hono/api/agent-partner-completion.test.ts",
	"src/hono/api/agent-revision-loop.test.ts",
	"src/hono/api/agent-creator-controls.test.ts",
	"src/hono/api/agent-command-idempotency.test.ts",
	"src/hono/api/agent-rate-limit.test.ts",
	"src/release/agent-credential-redaction.test.ts",
] as const;

export async function validateAgentSmokeEntry(input: {
	baseUrl: string;
	token: string;
	fetcher?: typeof fetch;
}): Promise<{ email: string; tokenName: string }> {
	const fetcher = input.fetcher ?? fetch;
	const baseUrl = input.baseUrl.replace(/\/+$/, "");
	const guide = await fetcher(`${baseUrl}/agent.md`);
	if (!guide.ok || !(await guide.text()).includes("Signmos Agent API")) {
		throw new Error("Public /agent.md is unavailable or incomplete");
	}
	const openapi = await fetcher(`${baseUrl}/openapi.json`);
	const openapiBody: unknown = await openapi.json().catch(() => null);
	if (!openapi.ok || !isOpenApiDocument(openapiBody)) {
		throw new Error("Public /openapi.json is unavailable or incomplete");
	}
	const identity = await fetcher(`${baseUrl}/api/v1/me`, {
		headers: { authorization: `Bearer ${input.token}` },
	});
	const identityBody: unknown = await identity.json().catch(() => null);
	if (!identity.ok || !isIdentityResponse(identityBody)) {
		throw new Error(`Bearer identity preflight failed with HTTP ${identity.status}`);
	}
	return {
		email: identityBody.data.principal.email,
		tokenName: identityBody.data.token.name,
	};
}

export async function runLiveSelfSignSmoke(input: {
	baseUrl: string;
	token: string;
	onReviewRequired: (review: PendingHumanReview) => Promise<void>;
	onHeartbeat?: (message: string) => void;
	pollIntervalMs?: number;
	maxPolls?: number;
	fetcher?: typeof fetch;
}): Promise<{ finalPdfBytes: number }> {
	const fetcher = input.fetcher ?? fetch;
	const baseUrl = input.baseUrl.replace(/\/+$/, "");
	const created = await jsonRequest<{ documentId?: string }>(fetcher, {
		url: `${baseUrl}/api/v1/documents`,
		token: input.token,
		method: "POST",
		body: { name: "Agentic release smoke" },
		idempotencyKey: smokeKey("create"),
		expectedStatus: 201,
	});
	const documentId = created.documentId;
	if (!documentId) throw new Error("Live smoke create response omitted documentId");

	const pdf = await smokePdf();
	await request(fetcher, {
		url: `${baseUrl}/api/v1/documents/${documentId}/source-pdf`,
		token: input.token,
		method: "PUT",
		body: toArrayBuffer(pdf),
		contentType: "application/pdf",
		idempotencyKey: smokeKey("upload"),
		expectedStatus: 201,
	});
	await jsonRequest(fetcher, {
		url: `${baseUrl}/api/v1/documents/${documentId}/fields/defaults`,
		token: input.token,
		method: "POST",
		body: { page: 1 },
		idempotencyKey: smokeKey("fields"),
		expectedStatus: 201,
	});
	const pending = await jsonRequest<PendingHumanReview>(fetcher, {
		url: `${baseUrl}/api/v1/documents/${documentId}/complete`,
		token: input.token,
		method: "POST",
		body: {
			signature: {
				kind: "typed",
				typedText: "Agentic Release Smoke",
				typedFont: "cursive",
			},
			rememberSignature: false,
		},
		idempotencyKey: smokeKey("complete"),
		expectedStatus: 202,
	});
	if (pending.status !== "pending_human_review") {
		throw new Error("Protected completion did not pause for human review");
	}
	const beforeApproval = await jsonRequest<{ finalPdfAvailable?: boolean }>(fetcher, {
		url: `${baseUrl}/api/v1/documents/${documentId}/status`,
		token: input.token,
		method: "GET",
		expectedStatus: 200,
	});
	if (beforeApproval.finalPdfAvailable) {
		throw new Error("Protected completion produced a final PDF before human approval");
	}
	await input.onReviewRequired(pending);
	await waitForHumanReview(fetcher, input.token, pending, input);
	const afterApproval = await jsonRequest<{ finalPdfAvailable?: boolean }>(fetcher, {
		url: `${baseUrl}/api/v1/documents/${documentId}/status`,
		token: input.token,
		method: "GET",
		expectedStatus: 200,
	});
	if (!afterApproval.finalPdfAvailable) throw new Error("Live smoke final PDF is unavailable");
	const downloaded = await request(fetcher, {
		url: `${baseUrl}/api/v1/documents/${documentId}/pdf`,
		token: input.token,
		method: "GET",
		expectedStatus: 200,
	});
	if (!downloaded.headers.get("content-type")?.startsWith("application/pdf")) {
		throw new Error("Live smoke final download was not a PDF");
	}
	return { finalPdfBytes: (await downloaded.arrayBuffer()).byteLength };
}

async function main() {
	const token = process.env.SIGNMOS_TOKEN?.trim();
	if (!token) throw new Error("Set SIGNMOS_TOKEN to a temporary Agentic release token");
	const baseUrl = process.env.SIGNMOS_BASE_URL?.trim() || "http://localhost:3000";
	heartbeat("public guide, OpenAPI, and Bearer identity preflight");
	const identity = await validateAgentSmokeEntry({ baseUrl, token });
	process.stdout.write(
		`Preflight passed for ${identity.email} using safe token name ${identity.tokenName}.\n`,
	);
	heartbeat("live Bearer self-sign lifecycle starting");
	const live = await runLiveSelfSignSmoke({
		baseUrl,
		token,
		onReviewRequired: async (review) => {
			heartbeat("protected completion paused with no final PDF");
			process.stdout.write(
				`Open ${review.reviewUrl} in a browser as the matching verified human.\n`,
			);
			process.stdout.write(
				"Inspect the PDF, assigned fields, and exact action, then approve and execute.\n",
			);
		},
		onHeartbeat: heartbeat,
	});
	process.stdout.write(`Live self-sign final PDF verified (${live.finalPdfBytes} bytes).\n`);
	process.stdout.write(
		"The completed smoke document remains subject to normal Signmos retention controls.\n",
	);
	heartbeat("Bearer lifecycle integration files starting");
	const exitCode = await runVitest();
	if (exitCode !== 0) throw new Error(`Agentic lifecycle smoke failed with exit ${exitCode}`);
	heartbeat(
		"self-sign, two-party, change/revision, decline, controls, polling, and download passed",
	);
}

function runVitest(): Promise<number> {
	return new Promise((resolve, reject) => {
		const child = spawn("pnpm", ["exec", "vitest", "run", ...agentLifecycleSmokeFiles], {
			stdio: "inherit",
			env: process.env,
		});
		child.on("error", reject);
		child.on("exit", (code) => resolve(code ?? 1));
	});
}

function heartbeat(message: string) {
	process.stdout.write(`[heartbeat] ${message}\n`);
}

export interface PendingHumanReview {
	commandId: string;
	status: "pending_human_review";
	reviewUrl: string;
	statusUrl: string;
	expiresAt: string;
	notificationStatus: "sent" | "fallback" | "failed";
}

async function waitForHumanReview(
	fetcher: typeof fetch,
	token: string,
	review: PendingHumanReview,
	options: Pick<
		Parameters<typeof runLiveSelfSignSmoke>[0],
		"maxPolls" | "onHeartbeat" | "pollIntervalMs"
	>,
) {
	const maxPolls = options.maxPolls ?? 300;
	const pollIntervalMs = options.pollIntervalMs ?? 2_000;
	for (let poll = 1; poll <= maxPolls; poll += 1) {
		const status = await jsonRequest<HumanReviewStatus>(fetcher, {
			url: review.statusUrl,
			token,
			method: "GET",
			expectedStatus: 200,
		});
		if (status.commandId !== review.commandId) {
			throw new Error("Human-review polling returned a different command");
		}
		if (status.status === "completed") return;
		if (status.status !== "pending_human_review") {
			throw new Error(`Human review ended without execution: ${status.status}`);
		}
		if (poll % 15 === 0) options.onHeartbeat?.("waiting for matching-human browser approval");
		if (pollIntervalMs > 0) await pause(pollIntervalMs);
	}
	throw new Error("Human-review polling limit reached without a terminal decision");
}

interface HumanReviewStatus {
	commandId: string;
	status: "pending_human_review" | "completed" | "rejected" | "expired" | "invalidated" | "failed";
}

function pause(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function jsonRequest<T = unknown>(
	fetcher: typeof fetch,
	input: Omit<SmokeRequest, "body" | "contentType"> & { body?: unknown },
): Promise<T> {
	const response = await request(fetcher, {
		...input,
		body: input.body === undefined ? undefined : JSON.stringify(input.body),
		contentType: "application/json",
	});
	const body = (await response.json()) as { data?: T };
	if (body.data === undefined) throw new Error(`Live smoke response omitted data: ${input.url}`);
	return body.data;
}

interface SmokeRequest {
	url: string;
	token: string;
	method: "GET" | "POST" | "PUT";
	body?: BodyInit;
	contentType?: string;
	idempotencyKey?: string;
	expectedStatus: number;
}

async function request(fetcher: typeof fetch, input: SmokeRequest): Promise<Response> {
	const headers: Record<string, string> = { authorization: `Bearer ${input.token}` };
	if (input.contentType) headers["content-type"] = input.contentType;
	if (input.idempotencyKey) headers["idempotency-key"] = input.idempotencyKey;
	const response = await fetcher(input.url, {
		method: input.method,
		headers,
		body: input.body,
	});
	if (response.status === input.expectedStatus) return response;
	const body = (await response.text()).slice(0, 500);
	throw new Error(
		`Live smoke ${input.method} request returned ${response.status}, expected ${input.expectedStatus}: ${body}`,
	);
}

function smokeKey(operation: string): string {
	return `agentic-smoke-${operation}-${crypto.randomUUID()}`;
}

async function smokePdf(): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const page = pdf.addPage([612, 792]);
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	page.drawText("Signmos Agentic release smoke", { x: 72, y: 720, size: 16, font });
	return pdf.save({ useObjectStreams: false });
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return buffer;
}

function isOpenApiDocument(value: unknown): value is { openapi: string; paths: object } {
	return Boolean(
		value &&
			typeof value === "object" &&
			"openapi" in value &&
			value.openapi === "3.1.0" &&
			"paths" in value &&
			value.paths &&
			typeof value.paths === "object",
	);
}

function isIdentityResponse(value: unknown): value is {
	data: { principal: { email: string }; token: { name: string } };
} {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	if (!data || typeof data !== "object" || !("principal" in data) || !("token" in data)) {
		return false;
	}
	const principal = data.principal;
	const token = data.token;
	return Boolean(
		principal &&
			typeof principal === "object" &&
			"email" in principal &&
			typeof principal.email === "string" &&
			token &&
			typeof token === "object" &&
			"name" in token &&
			typeof token.name === "string",
	);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
