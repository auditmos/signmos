import { readFileSync } from "node:fs";

describe("lifecycle API contract documentation", () => {
	it("documents endpoints, schemas, idempotency, errors, and validation mapping", () => {
		const prd = readFileSync("docs/simple-esignature-prd.md", "utf8");

		for (const text of [
			"## Lifecycle API Contract",
			"POST /api/envelopes",
			"POST /api/envelopes/{id}/source-pdf",
			"POST /api/envelopes/{id}/recipients",
			"POST /api/envelopes/{id}/fields",
			"POST /api/envelopes/{id}/actions",
			"GET /api/envelopes/{id}/status",
			"GET /api/envelopes/{id}/final-pdf",
			"GET /api/signing/{token}",
			"POST /api/signing/{token}/complete",
			"POST /api/signing/{token}/decline",
			"Idempotency-Key",
			"INVALID_ACTION",
			"INVALID_SOURCE_PDF",
			"EXPIRED_TOKEN",
			"FINAL_PDF_NOT_FOUND",
			"## Validation Checklist",
			"## Manual Human UI Smoke Checklist",
		]) {
			expect(prd).toContain(text);
		}

		for (let item = 1; item <= 20; item += 1) {
			expect(prd).toContain(`| ${item} |`);
		}
	});
});
