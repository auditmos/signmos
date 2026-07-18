import {
	type AgentCalibrationResult,
	buildCalibrationReport,
	summarizeDurations,
} from "../../scripts/agentic-calibrate";

describe("agent calibration command", () => {
	it("summarizes retained samples without inventing observations", () => {
		expect(summarizeDurations([9, 1, 4, 2, 8])).toEqual({
			samples: 5,
			minMs: 1,
			p50Ms: 4,
			p95Ms: 9,
			maxMs: 9,
			meanMs: 4.8,
		});
	});

	it("renders fixture, observation, scaling, and heartbeat evidence for every required class", () => {
		const result: AgentCalibrationResult = {
			measuredAt: "2026-07-17T10:00:00.000Z",
			baseUrl: "http://localhost:3000",
			fixture: "development Neon + local Worker R2; temporary hash-only Agentic token",
			sampleSize: 5,
			pdfBytes: 2048,
			observations: {
				catalogRead: summarizeDurations([1, 2, 3, 4, 5]),
				statusRead: summarizeDurations([2, 3, 4, 5, 6]),
				jsonMutation: summarizeDurations([3, 4, 5, 6, 7]),
				pdfUpload: summarizeDurations([4, 5, 6, 7, 8]),
				pdfDownload: summarizeDurations([5, 6, 7, 8, 9]),
				pollingRead: summarizeDurations([6, 7, 8, 9, 10]),
			},
			scalingAssumptions: [
				"Personal/pilot calls are independent; no bulk or SLA extrapolation is claimed.",
			],
			heartbeats: 6,
			cleanup: "completed fixtures deleted; temporary token revoked",
		};
		const report = buildCalibrationReport(result);
		for (const phrase of [
			"Sample size: 5",
			"catalog read",
			"status read",
			"JSON mutation",
			"PDF upload",
			"PDF download",
			"polling read",
			"Scaling assumptions",
			"Heartbeats emitted: 6",
			"temporary token revoked",
		]) {
			expect(report).toContain(phrase);
		}
		expect(report).not.toMatch(/signmos_[A-Za-z0-9_-]{16,}/);
	});
});
