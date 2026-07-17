import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CatalogRole = "creator" | "signer" | "creator_and_signer";
type CatalogGroup = "drafts" | "needs_my_action" | "waiting_on_others" | "completed" | "closed";
type CatalogStatus =
	| "awaiting_verification"
	| "draft"
	| "changes_requested"
	| "sent"
	| "completed"
	| "declined"
	| "expired";

interface HistoryDocumentRow {
	envelopeId: string;
	title: string;
	shortReference: string;
	status: CatalogStatus;
	group: CatalogGroup;
	role: CatalogRole;
	participants: Array<{ name: string; email: string; role: "creator" | "signer" }>;
	allowedActions: string[];
	createdAt: string;
	activityAt: string;
	detailUrl: string | null;
	downloadUrl: string | null;
}

interface CatalogPagination {
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
}

interface HistoryDocumentsResponse {
	data: { items: HistoryDocumentRow[]; pagination: CatalogPagination };
}

interface HistoryRecoveryResponse {
	error: {
		code: "HISTORY_SESSION_EXPIRED" | "HISTORY_SESSION_REQUIRED";
		message: string;
		recoveryUrl: string;
	};
}

type HistoryLoadResult =
	| { state: "documents"; items: HistoryDocumentRow[]; pagination: CatalogPagination }
	| { state: "recovery"; recoveryUrl: string; expired: boolean };

interface HistoryDocumentsPageProps {
	onSignedOut?: (recoveryUrl: string) => void;
}

interface CatalogFilterValues {
	search: string;
	role: "" | CatalogRole;
	group: "" | CatalogGroup;
	status: "" | CatalogStatus;
}

type CatalogRequest = CatalogFilterValues & { page: number };

const defaultOnSignedOut = (url: string) => window.location.assign(url);
const initialCatalogRequest: CatalogRequest = {
	search: "",
	role: "",
	group: "",
	status: "",
	page: 1,
};

export function HistoryDocumentsPage({
	onSignedOut = defaultOnSignedOut,
}: HistoryDocumentsPageProps) {
	const recoveryHeadingRef = useRef<HTMLHeadingElement>(null);
	const signedOutStatusRef = useRef<HTMLOutputElement>(null);
	const catalogStatusRef = useRef<HTMLOutputElement>(null);
	const focusCatalogResultRef = useRef(false);
	const [catalogRequest, setCatalogRequest] = useState(initialCatalogRequest);
	const documentsQuery = useQuery({
		queryKey: ["history-documents", catalogRequest],
		queryFn: () => fetchHistoryCatalog(catalogRequest),
	});
	const signOut = useMutation({
		mutationFn: async () => {
			const response = await fetch("/api/history/session/sign-out", {
				method: "POST",
				credentials: "same-origin",
			});
			if (!response.ok) throw new Error("Unable to sign out");
			return "/?task=my-documents";
		},
		onSuccess: (url) => onSignedOut(url),
	});
	const recovery = isHistoryRecoveryLoad(documentsQuery.data) ? documentsQuery.data : null;
	const catalog = isHistoryDocumentsLoad(documentsQuery.data) ? documentsQuery.data : null;

	useEffect(() => {
		if (recovery) recoveryHeadingRef.current?.focus();
	}, [recovery]);
	useEffect(() => {
		if (signOut.isSuccess) signedOutStatusRef.current?.focus();
	}, [signOut.isSuccess]);
	useEffect(() => {
		if (catalog && focusCatalogResultRef.current) {
			catalogStatusRef.current?.focus();
			focusCatalogResultRef.current = false;
		}
	}, [catalog]);

	function applyFilters(filters: CatalogFilterValues) {
		focusCatalogResultRef.current = true;
		setCatalogRequest({ ...filters, search: filters.search.trim(), page: 1 });
	}

	function selectPage(page: number) {
		focusCatalogResultRef.current = true;
		setCatalogRequest((current) => ({ ...current, page }));
	}

	return (
		<main className="min-h-dvh bg-background px-6 py-10">
			<section className="mx-auto max-w-3xl space-y-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p className="text-sm font-medium text-primary">Signmos</p>
						<h1 className="mt-3 text-3xl font-semibold text-foreground">My documents</h1>
					</div>
					<Button type="button" variant="outline" onClick={() => signOut.mutate()}>
						{signOut.isPending ? "Signing out..." : "Sign out"}
					</Button>
				</div>

				<p className="text-muted-foreground text-sm">
					Completed and expired documents are retained for 90 days unless deleted earlier. My
					documents is not permanent storage.
				</p>
				<CatalogFilters onApply={applyFilters} />

				{documentsQuery.isPending ? (
					<output aria-live="polite" className="block text-muted-foreground">
						Loading your documents…
					</output>
				) : null}
				{documentsQuery.isError || signOut.isError ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>Unable to load My documents</AlertTitle>
						<AlertDescription>Request a new secure link and try again.</AlertDescription>
					</Alert>
				) : null}
				{signOut.isSuccess ? (
					<output ref={signedOutStatusRef} tabIndex={-1} className="block text-muted-foreground">
						Signed out. Redirecting to request a new link…
					</output>
				) : null}
				{recovery ? <CatalogRecovery recovery={recovery} headingRef={recoveryHeadingRef} /> : null}
				{catalog ? (
					<>
						<output
							ref={catalogStatusRef}
							tabIndex={-1}
							aria-live="polite"
							className="block text-muted-foreground text-sm"
						>
							{catalog.items.length === 0
								? "No documents match these filters."
								: `Showing ${catalog.items.length} of ${catalog.pagination.totalItems} documents.`}
						</output>
						<CatalogRows items={catalog.items} />
						<CatalogPaginationNav pagination={catalog.pagination} onSelect={selectPage} />
					</>
				) : null}
			</section>
		</main>
	);
}

function CatalogFilters({ onApply }: { onApply: (filters: CatalogFilterValues) => void }) {
	const form = useForm({
		defaultValues: { ...initialCatalogRequest } as CatalogFilterValues,
		onSubmit: ({ value }) => onApply(value),
	});
	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void form.handleSubmit();
	}
	return (
		<form
			aria-label="Filter My documents"
			className="grid gap-4 rounded-lg border p-4"
			onSubmit={submit}
		>
			<form.Field name="search">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor="history-search">Search documents</Label>
						<Input
							id="history-search"
							type="search"
							value={field.state.value}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					</div>
				)}
			</form.Field>
			<div className="grid gap-4 sm:grid-cols-3">
				<form.Field name="role">
					{(field) => (
						<CatalogSelect
							name="role"
							label="Role"
							value={field.state.value}
							onChange={(value) => field.handleChange(value as CatalogFilterValues["role"])}
							options={roleOptions}
						/>
					)}
				</form.Field>
				<form.Field name="group">
					{(field) => (
						<CatalogSelect
							name="group"
							label="Group"
							value={field.state.value}
							onChange={(value) => field.handleChange(value as CatalogFilterValues["group"])}
							options={groupOptions}
						/>
					)}
				</form.Field>
				<form.Field name="status">
					{(field) => (
						<CatalogSelect
							name="status"
							label="Status"
							value={field.state.value}
							onChange={(value) => field.handleChange(value as CatalogFilterValues["status"])}
							options={statusOptions}
						/>
					)}
				</form.Field>
			</div>
			<Button type="submit">Apply filters</Button>
		</form>
	);
}

function CatalogSelect({
	name,
	label,
	value,
	onChange,
	options,
}: {
	name: "role" | "group" | "status";
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: ReadonlyArray<readonly [string, string]>;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={`history-${name}`}>{label}</Label>
			<select
				id={`history-${name}`}
				className="h-9 w-full rounded-md border bg-background px-3 text-sm"
				value={value}
				onChange={(event) => onChange(event.target.value)}
			>
				<option value="">All</option>
				{options.map(([optionValue, optionLabel]) => (
					<option key={optionValue} value={optionValue}>
						{optionLabel}
					</option>
				))}
			</select>
		</div>
	);
}

function CatalogRows({ items }: { items: HistoryDocumentRow[] }) {
	return (
		<ul className="grid gap-4">
			{items.map((item) => (
				<li key={item.envelopeId}>
					<article className="space-y-3 rounded-lg border bg-card p-5 shadow-sm">
						<h2 className="font-semibold text-foreground">{item.title}</h2>
						<p className="text-muted-foreground text-sm">
							{historyGroupLabel(item.group)} · {historyStatusLabel(item.status)} ·{" "}
							{historyRoleLabel(item.role)}
						</p>
						<p className="text-muted-foreground text-xs">
							Created {new Date(item.createdAt).toLocaleDateString()} · Reference{" "}
							{item.shortReference}
						</p>
						<ul
							aria-label={`Participants for ${item.title}`}
							className="text-muted-foreground text-sm"
						>
							{item.participants.map((participant, index) => (
								<li key={`${participant.role}-${participant.email}-${index}`}>
									{participant.name} · {participant.email} ·{" "}
									{participant.role === "creator" ? "Creator" : "Signer"}
								</li>
							))}
						</ul>
						{item.allowedActions.length > 0 ? (
							<p className="text-muted-foreground text-xs">
								Available: {item.allowedActions.map(historyActionLabel).join(", ")}
							</p>
						) : null}
						<div className="flex flex-wrap gap-4 text-sm">
							{item.detailUrl ? <CatalogLink href={item.detailUrl} label="View details" /> : null}
							{item.downloadUrl ? (
								<CatalogLink href={item.downloadUrl} label="Download PDF" />
							) : null}
						</div>
					</article>
				</li>
			))}
		</ul>
	);
}

function CatalogPaginationNav({
	pagination,
	onSelect,
}: {
	pagination: CatalogPagination;
	onSelect: (page: number) => void;
}) {
	if (pagination.totalPages <= 1) return null;
	return (
		<nav aria-label="Catalog pages" className="flex flex-wrap gap-2">
			{Array.from({ length: pagination.totalPages }, (_, index) => index + 1).map((page) => (
				<Button
					key={page}
					type="button"
					variant={page === pagination.page ? "default" : "outline"}
					aria-current={page === pagination.page ? "page" : undefined}
					onClick={() => onSelect(page)}
				>
					Page {page}
				</Button>
			))}
		</nav>
	);
}

function CatalogRecovery({
	recovery,
	headingRef,
}: {
	recovery: Extract<HistoryLoadResult, { state: "recovery" }>;
	headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
	return (
		<Alert role="alert" variant="destructive">
			<AlertTitle>
				<h2 ref={headingRef} tabIndex={-1}>
					{recovery.expired ? "Session expired" : "My documents access required"}
				</h2>
			</AlertTitle>
			<AlertDescription>
				<p>Request a new secure link to continue.</p>
				<CatalogLink href={recovery.recoveryUrl} label="Request a new link" />
			</AlertDescription>
		</Alert>
	);
}

function CatalogLink({ href, label }: { href: string; label: string }) {
	return (
		<a
			className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			href={href}
		>
			{label}
		</a>
	);
}

async function fetchHistoryCatalog(request: CatalogRequest): Promise<HistoryLoadResult> {
	const response = await fetch(buildCatalogUrl(request), { credentials: "same-origin" });
	const body: unknown = await response.json().catch(() => null);
	if (!response.ok && isHistoryRecoveryResponse(body)) {
		return {
			state: "recovery",
			recoveryUrl: body.error.recoveryUrl,
			expired: body.error.code === "HISTORY_SESSION_EXPIRED",
		};
	}
	if (!response.ok || !isHistoryDocumentsResponse(body)) {
		throw new Error("Unable to load My documents");
	}
	return { state: "documents", ...body.data };
}

function buildCatalogUrl(request: CatalogRequest): string {
	const query = new URLSearchParams();
	if (request.search) query.set("search", request.search);
	if (request.role) query.set("role", request.role);
	if (request.group) query.set("group", request.group);
	if (request.status) query.set("status", request.status);
	query.set("page", String(request.page));
	return `/api/history/documents?${query.toString()}`;
}

const roleOptions = [
	["creator", "Creator"],
	["signer", "Signer"],
	["creator_and_signer", "Creator and signer"],
] as const;
const groupOptions = [
	["drafts", "Drafts"],
	["needs_my_action", "Needs my action"],
	["waiting_on_others", "Waiting on others"],
	["completed", "Completed"],
	["closed", "Closed"],
] as const;
const statusOptions = [
	["awaiting_verification", "Awaiting verification"],
	["draft", "Draft"],
	["changes_requested", "Changes requested"],
	["sent", "Sent"],
	["completed", "Completed"],
	["declined", "Declined"],
	["expired", "Expired"],
] as const;

function historyRoleLabel(role: CatalogRole): string {
	if (role === "creator_and_signer") return "Creator and signer";
	return role === "creator" ? "Creator" : "Signer";
}

function historyGroupLabel(group: CatalogGroup): string {
	return groupOptions.find(([value]) => value === group)?.[1] ?? group;
}

function historyStatusLabel(status: CatalogStatus): string {
	return statusOptions.find(([value]) => value === status)?.[1] ?? status;
}

function historyActionLabel(action: string): string {
	return action.replaceAll("_", " ");
}

function isHistoryDocumentsResponse(value: unknown): value is HistoryDocumentsResponse {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "items" in data && "pagination" in data);
}

function isHistoryRecoveryResponse(value: unknown): value is HistoryRecoveryResponse {
	if (!value || typeof value !== "object" || !("error" in value)) return false;
	const error = value.error;
	return Boolean(error && typeof error === "object" && "code" in error && "recoveryUrl" in error);
}

function isHistoryRecoveryLoad(
	value: HistoryLoadResult | undefined,
): value is Extract<HistoryLoadResult, { state: "recovery" }> {
	return value?.state === "recovery";
}

function isHistoryDocumentsLoad(
	value: HistoryLoadResult | undefined,
): value is Extract<HistoryLoadResult, { state: "documents" }> {
	return value?.state === "documents";
}
