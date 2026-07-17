export const historyErrorCodes = [
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
] as const;

export type HistoryErrorCode = (typeof historyErrorCodes)[number];

const contracts: Record<HistoryErrorCode, { message: string; recoveryUrl: string }> = {
	HISTORY_LINK_UNKNOWN: {
		message: "This My documents link is not valid",
		recoveryUrl: "/?task=my-documents",
	},
	HISTORY_LINK_CONSUMED: {
		message: "This My documents link has already been used",
		recoveryUrl: "/?task=my-documents",
	},
	HISTORY_LINK_EXPIRED: {
		message: "This My documents link has expired",
		recoveryUrl: "/?task=my-documents",
	},
	HISTORY_LINK_REVOKED: {
		message: "This My documents link is no longer active",
		recoveryUrl: "/?task=my-documents",
	},
	HISTORY_SESSION_REQUIRED: {
		message: "Request a new My documents link",
		recoveryUrl: "/?task=my-documents",
	},
	HISTORY_SESSION_EXPIRED: {
		message: "Your My documents session expired",
		recoveryUrl: "/?task=my-documents",
	},
	HISTORY_DOCUMENT_NOT_FOUND: {
		message: "Document not found for this My documents session",
		recoveryUrl: "/my-documents",
	},
	HISTORY_CREATOR_FORBIDDEN: {
		message: "Only the document creator can use this action",
		recoveryUrl: "/my-documents",
	},
	HISTORY_CREATOR_DELETED: {
		message: "This document was deleted",
		recoveryUrl: "/my-documents",
	},
	HISTORY_CREATOR_ACTION_BLOCKED: {
		message: "This creator action is not allowed in the current state",
		recoveryUrl: "/my-documents",
	},
	HISTORY_SIGNING_NOT_FOUND: {
		message: "Signing task not found for this My documents session",
		recoveryUrl: "/my-documents",
	},
	HISTORY_SIGNING_NOT_ACTIVE: {
		message: "This signing task is not active",
		recoveryUrl: "/my-documents",
	},
	HISTORY_SIGNING_DECLINED: {
		message: "This document was declined",
		recoveryUrl: "/my-documents",
	},
	HISTORY_SIGNING_EXPIRED: {
		message: "This document expired",
		recoveryUrl: "/my-documents",
	},
	HISTORY_SIGNING_DELETED: {
		message: "This document was deleted",
		recoveryUrl: "/my-documents",
	},
};

export function historyError(
	code: HistoryErrorCode,
	extra: Readonly<Record<string, unknown>> = {},
) {
	return { error: { ...extra, code, ...contracts[code] } };
}
