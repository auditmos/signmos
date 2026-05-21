import { readFileSync } from "node:fs";

describe("lifecycle API contract documentation", () => {
	it("documents endpoints, schemas, idempotency, errors, and validation mapping", () => {
		const contract = readFileSync("plans/pilot-readiness-contract.md", "utf8");

		for (const text of [
			"# Pilot Readiness Contract",
			"## Agent API Contract",
			"## Endpoint Contract",
			"## Statuses And Allowed Actions",
			"## Idempotency And Retry Safety",
			"## Error Code Catalog",
			"## Agent Smoke Command",
			"## Human Browser Smoke Checklist",
			"## UI State Coverage",
			"## PRD Validation Evidence Map",
			"POST /api/envelopes/sender-start",
			"GET /api/envelopes/sender-verifications/{token}",
			"POST /api/envelopes",
			"POST /api/envelopes/{id}/source-pdf",
			"POST /api/envelopes/{id}/recipients",
			"POST /api/envelopes/{id}/signature-profiles",
			"POST /api/envelopes/{id}/fields",
			"POST /api/envelopes/{id}/fields/defaults",
			"POST /api/envelopes/{id}/actions",
			"POST /api/envelopes/{id}/recipients/{recipientId}/resend",
			"GET /api/envelopes/{id}/status",
			"GET /api/envelopes/{id}/retention",
			"GET /api/envelopes/{id}/final-pdf",
			"GET /api/signing/verifications/{token}",
			"GET /api/signing/{token}",
			"GET /api/signing/{token}/source-pdf",
			"GET /api/signing/{token}/final-pdf",
			"POST /api/signing/{token}/complete",
			"POST /api/signing/{token}/change-request",
			"POST /api/signing/{token}/decline",
			"Idempotency-Key",
			"awaiting_verification",
			"changes_requested",
			"download_final_pdf",
			"INVALID_ACTION",
			"INVALID_SOURCE_PDF",
			"PARTNER_VERIFICATION_REQUIRED",
			"EXPIRED_TOKEN",
			"FINAL_PDF_NOT_FOUND",
		]) {
			expect(contract).toContain(text);
		}

		for (let item = 1; item <= 32; item += 1) {
			expect(contract).toContain(`| ${item} |`);
		}
	});
});
