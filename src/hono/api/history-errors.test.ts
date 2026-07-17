import { historyError, historyErrorCodes } from "./history-errors";

describe("My documents stable error contract", () => {
	it("enumerates every known link, session, document, creator, and signer failure", () => {
		expect(historyErrorCodes).toEqual([
			"HISTORY_LINK_UNKNOWN",
			"HISTORY_LINK_CONSUMED",
			"HISTORY_LINK_EXPIRED",
			"HISTORY_LINK_REVOKED",
			"HISTORY_SESSION_REQUIRED",
			"HISTORY_SESSION_EXPIRED",
			"HISTORY_DOCUMENT_NOT_FOUND",
			"HISTORY_CREATOR_FORBIDDEN",
			"HISTORY_CREATOR_DELETED",
			"HISTORY_CREATOR_ACTION_BLOCKED",
			"HISTORY_SIGNING_NOT_FOUND",
			"HISTORY_SIGNING_NOT_ACTIVE",
			"HISTORY_SIGNING_DECLINED",
			"HISTORY_SIGNING_EXPIRED",
			"HISTORY_SIGNING_DELETED",
		]);
	});

	it.each(
		historyErrorCodes,
	)("returns a stable %s code, message, and non-secret recovery URL", (code) => {
		const body = historyError(code);
		expect(body).toEqual({
			error: {
				code,
				message: expect.any(String),
				recoveryUrl: expect.stringMatching(/^\//),
			},
		});
		expect(body.error.message.length).toBeGreaterThan(0);
		expect(JSON.stringify(body)).not.toMatch(/(?:matched|delivered|email sent|document count)/i);
	});

	it("preserves machine-readable action hints without changing the base contract", () => {
		expect(historyError("HISTORY_CREATOR_ACTION_BLOCKED", { allowedActions: ["delete"] })).toEqual({
			error: {
				code: "HISTORY_CREATOR_ACTION_BLOCKED",
				message: "This creator action is not allowed in the current state",
				recoveryUrl: "/my-documents",
				allowedActions: ["delete"],
			},
		});
	});

	it("does not let optional hints replace stable error fields", () => {
		expect(
			historyError("HISTORY_SESSION_EXPIRED", {
				code: "OVERRIDDEN",
				message: "overridden",
				recoveryUrl: "/unsafe",
			}),
		).toEqual({
			error: {
				code: "HISTORY_SESSION_EXPIRED",
				message: "Your My documents session expired",
				recoveryUrl: "/?task=my-documents",
			},
		});
	});
});
