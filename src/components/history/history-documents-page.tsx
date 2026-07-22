import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { AuthenticatedProductNavigation } from "@/components/navigation/product-mode-navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	type CatalogGroup,
	type CatalogRole,
	type CatalogStatus,
	groupOptions,
	historyActionLabel,
	historyGroupLabel,
	historyRoleLabel,
	historyStatusLabel,
	roleOptions,
	statusOptions,
} from "./history-catalog-labels";
import { HistoryCatalogLink } from "./history-catalog-link";
import { HistoryCreatorControls } from "./history-creator-controls";
import {
	HistoryEnvelopeStart,
	type HistorySessionIdentity,
	type HistoryStartSigningMode,
} from "./history-envelope-start";
import { HistoryHumanReviewQueue } from "./history-human-review-queue";

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
	data: {
		identity: HistorySessionIdentity;
		items: HistoryDocumentRow[];
		pagination: CatalogPagination;
	};
}
interface HistoryRecoveryResponse {
	error: {
		code: "HISTORY_SESSION_EXPIRED" | "HISTORY_SESSION_REQUIRED";
		message: string;
		recoveryUrl: string;
	};
}
type HistoryLoadResult =
	| {
			state: "documents";
			identity: HistorySessionIdentity;
			items: HistoryDocumentRow[];
			pagination: CatalogPagination;
	  }
	| { state: "recovery"; recoveryUrl: string; expired: boolean };
type HistoryDocumentsPageProps = {
	initialSigningMode?: HistoryStartSigningMode;
	onSignedOut?: (recoveryUrl: string) => void;
};
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
	initialSigningMode,
	onSignedOut = defaultOnSignedOut,
}: HistoryDocumentsPageProps) {
	const recoveryHeadingRef = useRef<HTMLHeadingElement>(null);
	const catalogStatusRef = useRef<HTMLOutputElement>(null);
	const focusCatalogResultRef = useRef(false);
	const [catalogRequest, setCatalogRequest] = useState(initialCatalogRequest);
	const documentsQuery = useQuery({
		queryKey: ["history-documents", catalogRequest],
		queryFn: () => fetchHistoryCatalog(catalogRequest),
	});
	const recovery = isHistoryRecoveryLoad(documentsQuery.data) ? documentsQuery.data : null;
	const catalog = isHistoryDocumentsLoad(documentsQuery.data) ? documentsQuery.data : null;

	useEffect(() => {
		if (recovery) recoveryHeadingRef.current?.focus();
	}, [recovery]);
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
				<AuthenticatedProductNavigation activeMode="my_documents" onSignedOut={onSignedOut} />
				<div>
					<p className="text-sm font-medium text-primary">Signmos</p>
					<h1 className="mt-3 text-3xl font-semibold text-foreground">My documents</h1>
				</div>

				<p className="text-muted-foreground text-sm">
					Completed and expired documents are retained for 90 days unless deleted earlier. My
					documents is not permanent storage.
				</p>
				{catalog?.identity ? (
					<HistoryEnvelopeStart
						identity={catalog.identity}
						initialSigningMode={initialSigningMode}
					/>
				) : null}
				<HistoryHumanReviewQueue />
				<CatalogFilters onApply={applyFilters} />

				{documentsQuery.isPending ? (
					<output aria-live="polite" className="block text-muted-foreground">
						Loading your documents…
					</output>
				) : null}
				{documentsQuery.isError ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>Unable to load My documents</AlertTitle>
						<AlertDescription>Request a new secure link and try again.</AlertDescription>
					</Alert>
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
							{item.allowedActions.includes("resume") || item.allowedActions.includes("review") ? (
								<HistoryCatalogLink
									href={`/my-documents/${encodeURIComponent(item.envelopeId)}/manage`}
									label={
										item.allowedActions.includes("resume") ? "Resume preparation" : "Review status"
									}
								/>
							) : null}
							{item.allowedActions.includes("sign") ? (
								<HistoryCatalogLink
									href={`/my-documents/${encodeURIComponent(item.envelopeId)}/sign`}
									label="Review and sign"
								/>
							) : null}
							{item.detailUrl ? (
								<HistoryCatalogLink href={item.detailUrl} label="View details" />
							) : null}
							{item.downloadUrl ? (
								<HistoryCatalogLink href={item.downloadUrl} label="Download PDF" />
							) : null}
						</div>
						<HistoryCreatorControls
							envelopeId={item.envelopeId}
							title={item.title}
							allowedActions={item.allowedActions}
						/>
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
				<HistoryCatalogLink href={recovery.recoveryUrl} label="Request a new link" />
			</AlertDescription>
		</Alert>
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
