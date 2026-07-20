import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";

export interface DurationSummary {
	samples: number;
	minMs: number;
	p50Ms: number;
	p95Ms: number;
	maxMs: number;
	meanMs: number;
}

export interface AgentCalibrationResult {
	measuredAt: string;
	baseUrl: string;
	fixture: string;
	sampleSize: number;
	pdfBytes: number;
	observations: {
		catalogRead: DurationSummary;
		statusRead: DurationSummary;
		jsonMutation: DurationSummary;
		pdfUpload: DurationSummary;
		pdfDownload: DurationSummary;
		pollingRead: DurationSummary;
	};
	scalingAssumptions: string[];
	heartbeats: number;
	cleanup: string;
}

interface CalibrationOptions {
	baseUrl: string;
	token: string;
	sampleSize: number;
	onReviewRequired?: (review: CalibrationHumanReview, sample: number) => Promise<void>;
	pollIntervalMs?: number;
	maxReviewPolls?: number;
	fetcher?: typeof fetch;
	now?: () => number;
	heartbeat?: (message: string) => void;
}

interface TimedResponse {
	durationMs: number;
	response: Response;
}

const categoryLabels: Record<keyof AgentCalibrationResult["observations"], string> = {
	catalogRead: "catalog read",
	statusRead: "status read",
	jsonMutation: "JSON mutation",
	pdfUpload: "PDF upload",
	pdfDownload: "PDF download",
	pollingRead: "polling read",
};

export function summarizeDurations(values: number[]): DurationSummary {
	if (values.length === 0) throw new Error("At least one duration is required");
	const sorted = [...values].sort((left, right) => left - right);
	const rounded = (value: number) => Math.round(value * 100) / 100;
	return {
		samples: sorted.length,
		minMs: rounded(sorted[0] ?? 0),
		p50Ms: rounded(percentile(sorted, 0.5)),
		p95Ms: rounded(percentile(sorted, 0.95)),
		maxMs: rounded(sorted.at(-1) ?? 0),
		meanMs: rounded(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
	};
}

export function buildCalibrationReport(result: AgentCalibrationResult): string {
	const rows = Object.entries(result.observations)
		.map(([key, summary]) => {
			const label = categoryLabels[key as keyof typeof categoryLabels];
			return `| ${label} | ${summary.samples} | ${summary.minMs} | ${summary.p50Ms} | ${summary.p95Ms} | ${summary.maxMs} | ${summary.meanMs} |`;
		})
		.join("\n");
	return `# Agentic API Calibration

Measured at: ${result.measuredAt}

Base URL: ${result.baseUrl}

Fixture: ${result.fixture}

Sample size: ${result.sampleSize} per required operation class

PDF fixture size: ${result.pdfBytes} bytes

| Operation class | Samples | Min ms | p50 ms | p95 ms | Max ms | Mean ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

## Scaling assumptions

${result.scalingAssumptions.map((assumption) => `- ${assumption}`).join("\n")}

## Progress and cleanup

- Heartbeats emitted: ${result.heartbeats}
- ${result.cleanup}
`;
}

export async function runAgentCalibration(
	options: CalibrationOptions,
): Promise<AgentCalibrationResult> {
	if (!Number.isInteger(options.sampleSize) || options.sampleSize < 1) {
		throw new Error("SIGNMOS_CALIBRATION_SAMPLES must be a positive integer");
	}
	const fetcher = options.fetcher ?? fetch;
	const now = options.now ?? performance.now.bind(performance);
	const baseUrl = options.baseUrl.replace(/\/+$/, "");
	const pdf = await calibrationPdf();
	const observations = {
		catalogRead: [] as number[],
		statusRead: [] as number[],
		jsonMutation: [] as number[],
		pdfUpload: [] as number[],
		pdfDownload: [] as number[],
		pollingRead: [] as number[],
	};
	const documents: string[] = [];
	let heartbeats = 0;
	const heartbeat = (message: string) => {
		heartbeats += 1;
		options.heartbeat?.(message);
	};

	try {
		for (let sample = 1; sample <= options.sampleSize; sample += 1) {
			heartbeat(`calibration ${sample}/${options.sampleSize}: create and PDF lifecycle`);
			const created = await timedRequest(
				fetcher,
				`${baseUrl}/api/v1/documents`,
				{
					method: "POST",
					headers: jsonCommandHeaders(options.token, key("create", sample)),
					body: JSON.stringify({ name: `Calibration ${sample}` }),
				},
				now,
			);
			await assertStatus(created.response, 201, "create calibration document");
			observations.jsonMutation.push(created.durationMs);
			const createdBody = (await created.response.json()) as {
				data?: { documentId?: string };
			};
			const documentId = createdBody.data?.documentId;
			if (!documentId) throw new Error("Calibration create response omitted documentId");
			documents.push(documentId);

			const uploaded = await timedRequest(
				fetcher,
				`${baseUrl}/api/v1/documents/${documentId}/source-pdf`,
				{
					method: "PUT",
					headers: commandHeaders(options.token, key("upload", sample), "application/pdf"),
					body: arrayBuffer(pdf),
				},
				now,
			);
			await assertStatus(uploaded.response, 201, "upload calibration PDF");
			observations.pdfUpload.push(uploaded.durationMs);

			await jsonCommand(fetcher, {
				url: `${baseUrl}/api/v1/documents/${documentId}/fields/defaults`,
				token: options.token,
				idempotencyKey: key("fields", sample),
				body: { page: 1 },
				expectedStatus: 201,
			});
			const completion = await jsonCommand(fetcher, {
				url: `${baseUrl}/api/v1/documents/${documentId}/complete`,
				token: options.token,
				idempotencyKey: key("complete", sample),
				body: {
					signature: {
						kind: "typed",
						typedText: `Calibration ${sample}`,
						typedFont: "cursive",
					},
					rememberSignature: false,
				},
				expectedStatus: 202,
			});
			const review = await parseCalibrationReview(completion);
			heartbeat(`calibration ${sample}/${options.sampleSize}: matching-human review required`);
			if (!options.onReviewRequired) {
				throw new Error(`Calibration requires browser approval at ${review.reviewUrl}`);
			}
			await options.onReviewRequired(review, sample);
			await waitForCalibrationReview(fetcher, options.token, review, options, heartbeat);

			const status = await timedRequest(
				fetcher,
				`${baseUrl}/api/v1/documents/${documentId}/status`,
				{ headers: bearerHeaders(options.token) },
				now,
			);
			await assertStatus(status.response, 200, "read calibration status");
			observations.statusRead.push(status.durationMs);
			const polling = await timedRequest(
				fetcher,
				`${baseUrl}/api/v1/documents/${documentId}/status`,
				{ headers: bearerHeaders(options.token) },
				now,
			);
			await assertStatus(polling.response, 200, "poll calibration status");
			observations.pollingRead.push(polling.durationMs);

			const catalog = await timedRequest(
				fetcher,
				`${baseUrl}/api/v1/documents?page=1`,
				{ headers: bearerHeaders(options.token) },
				now,
			);
			await assertStatus(catalog.response, 200, "read calibration catalog");
			observations.catalogRead.push(catalog.durationMs);

			const downloaded = await timedRequest(
				fetcher,
				`${baseUrl}/api/v1/documents/${documentId}/pdf`,
				{ headers: { ...bearerHeaders(options.token), accept: "application/pdf" } },
				now,
			);
			await assertStatus(downloaded.response, 200, "download calibration PDF");
			await downloaded.response.arrayBuffer();
			observations.pdfDownload.push(downloaded.durationMs);
		}
	} finally {
		heartbeat(
			`calibration retention: ${documents.length} fixture documents remain under normal document controls`,
		);
	}

	return {
		measuredAt: new Date().toISOString(),
		baseUrl,
		fixture: "development Worker, Neon Postgres, and R2 with self-sign PDF fixtures",
		sampleSize: options.sampleSize,
		pdfBytes: pdf.byteLength,
		observations: {
			catalogRead: summarizeDurations(observations.catalogRead),
			statusRead: summarizeDurations(observations.statusRead),
			jsonMutation: summarizeDurations(observations.jsonMutation),
			pdfUpload: summarizeDurations(observations.pdfUpload),
			pdfDownload: summarizeDurations(observations.pdfDownload),
			pollingRead: summarizeDurations(observations.pollingRead),
		},
		scalingAssumptions: [
			"Measurements cover sequential personal/pilot traffic; they do not establish bulk capacity or an SLA.",
			"Fixed-window request thresholds are chosen below observed sequential throughput, leaving room for database, R2, email, and concurrent-user variance.",
			"Polling uses the same status read path; clients still back off because latency measurements do not authorize busy polling.",
		],
		heartbeats,
		cleanup:
			"calibration documents retained under normal Signmos controls; supplied token retained for explicit owner revocation",
	};
}

async function main() {
	const token = process.env.SIGNMOS_TOKEN?.trim();
	if (!token) throw new Error("Set SIGNMOS_TOKEN to a temporary development Agentic token");
	const sampleSize = Number(process.env.SIGNMOS_CALIBRATION_SAMPLES ?? "10");
	const result = await runAgentCalibration({
		baseUrl: process.env.SIGNMOS_BASE_URL?.trim() || "http://localhost:3000",
		token,
		sampleSize,
		onReviewRequired: async (review, sample) => {
			process.stdout.write(
				`Sample ${sample}: open ${review.reviewUrl} as the matching verified human, inspect it, and approve and execute.\n`,
			);
		},
		heartbeat: (message) => process.stdout.write(`[heartbeat] ${message}\n`),
	});
	const report = buildCalibrationReport(result);
	const output = process.env.SIGNMOS_CALIBRATION_OUTPUT?.trim();
	if (output) writeFileSync(output, report, "utf8");
	process.stdout.write(report);
}

function percentile(sorted: number[], percentileValue: number): number {
	const index = Math.ceil(sorted.length * percentileValue) - 1;
	return sorted[Math.max(0, index)] ?? 0;
}

async function timedRequest(
	fetcher: typeof fetch,
	url: string,
	init: RequestInit,
	now: () => number,
): Promise<TimedResponse> {
	const startedAt = now();
	const response = await fetcher(url, init);
	return { durationMs: now() - startedAt, response };
}

async function jsonCommand(
	fetcher: typeof fetch,
	input: {
		url: string;
		token: string;
		idempotencyKey: string;
		body: unknown;
		expectedStatus: number;
	},
) {
	const response = await fetcher(input.url, {
		method: "POST",
		headers: jsonCommandHeaders(input.token, input.idempotencyKey),
		body: JSON.stringify(input.body),
	});
	await assertStatus(response, input.expectedStatus, input.url);
	return response;
}

interface CalibrationHumanReview {
	commandId: string;
	status: "pending_human_review";
	reviewUrl: string;
	statusUrl: string;
}

async function parseCalibrationReview(response: Response): Promise<CalibrationHumanReview> {
	const body = (await response.json()) as { data?: CalibrationHumanReview };
	if (
		!body.data ||
		body.data.status !== "pending_human_review" ||
		!body.data.commandId ||
		!body.data.reviewUrl ||
		!body.data.statusUrl
	) {
		throw new Error("Calibration completion response omitted human-review command details");
	}
	return body.data;
}

async function waitForCalibrationReview(
	fetcher: typeof fetch,
	token: string,
	review: CalibrationHumanReview,
	options: Pick<CalibrationOptions, "maxReviewPolls" | "pollIntervalMs">,
	heartbeat: (message: string) => void,
) {
	const maxPolls = options.maxReviewPolls ?? 300;
	const interval = options.pollIntervalMs ?? 2_000;
	for (let poll = 1; poll <= maxPolls; poll += 1) {
		const response = await fetcher(review.statusUrl, { headers: bearerHeaders(token) });
		await assertStatus(response, 200, "poll calibration human review");
		const body = (await response.json()) as {
			data?: { commandId?: string; status?: string };
		};
		if (body.data?.commandId !== review.commandId) {
			throw new Error("Calibration polling returned a different command");
		}
		if (body.data.status === "completed") return;
		if (body.data.status !== "pending_human_review") {
			throw new Error(`Calibration review ended without execution: ${body.data.status}`);
		}
		if (poll % 15 === 0) heartbeat("calibration waiting for matching-human browser approval");
		if (interval > 0) await new Promise((resolve) => setTimeout(resolve, interval));
	}
	throw new Error("Calibration human-review polling limit reached without approval");
}

function bearerHeaders(token: string) {
	return { authorization: `Bearer ${token}` };
}

function commandHeaders(token: string, idempotencyKey: string, contentType: string) {
	return {
		...bearerHeaders(token),
		"content-type": contentType,
		"idempotency-key": idempotencyKey,
	};
}

function jsonCommandHeaders(token: string, idempotencyKey: string) {
	return commandHeaders(token, idempotencyKey, "application/json");
}

async function assertStatus(response: Response, expected: number, operation: string) {
	if (response.status === expected) return;
	const body = (await response.text()).slice(0, 500);
	throw new Error(`${operation} returned ${response.status}, expected ${expected}: ${body}`);
}

function key(operation: string, sample: number): string {
	return `calibration-${operation}-${sample}-${crypto.randomUUID()}`;
}

async function calibrationPdf(): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const page = pdf.addPage([612, 792]);
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	page.drawText("Signmos Agentic calibration fixture", { x: 72, y: 720, size: 16, font });
	return pdf.save({ useObjectStreams: false });
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return buffer;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
