export type CatalogRole = "creator" | "signer" | "creator_and_signer";
export type CatalogGroup =
	| "drafts"
	| "needs_my_action"
	| "waiting_on_others"
	| "completed"
	| "closed";
export type CatalogStatus =
	| "awaiting_verification"
	| "draft"
	| "changes_requested"
	| "sent"
	| "completed"
	| "declined"
	| "expired";

export const roleOptions = [
	["creator", "Creator"],
	["signer", "Signer"],
	["creator_and_signer", "Creator and signer"],
] as const;
export const groupOptions = [
	["drafts", "Drafts"],
	["needs_my_action", "Needs my action"],
	["waiting_on_others", "Waiting on others"],
	["completed", "Completed"],
	["closed", "Closed"],
] as const;
export const statusOptions = [
	["awaiting_verification", "Awaiting verification"],
	["draft", "Draft"],
	["changes_requested", "Changes requested"],
	["sent", "Sent"],
	["completed", "Completed"],
	["declined", "Declined"],
	["expired", "Expired"],
] as const;

export function historyRoleLabel(role: CatalogRole): string {
	if (role === "creator_and_signer") return "Creator and signer";
	return role === "creator" ? "Creator" : "Signer";
}

export function historyGroupLabel(group: CatalogGroup): string {
	return groupOptions.find(([value]) => value === group)?.[1] ?? group;
}

export function historyStatusLabel(status: CatalogStatus): string {
	return statusOptions.find(([value]) => value === status)?.[1] ?? status;
}

export function historyActionLabel(action: string): string {
	return action.replaceAll("_", " ");
}
