import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface HistoryDocumentRow {
	envelopeId: string;
	status: "completed";
	role: "creator" | "signer" | "creator_and_signer";
	detailUrl: string;
	downloadUrl: string;
}

interface HistoryDocumentsResponse {
	data: { documents: HistoryDocumentRow[] };
}

interface HistoryRecoveryResponse {
	error: {
		code: "HISTORY_SESSION_EXPIRED" | "HISTORY_SESSION_REQUIRED";
		message: string;
		recoveryUrl: string;
	};
}

type HistoryLoadResult =
	| { state: "documents"; documents: HistoryDocumentRow[] }
	| { state: "recovery"; recoveryUrl: string; expired: boolean };

interface HistoryDocumentsPageProps {
	onSignedOut?: (recoveryUrl: string) => void;
}

const defaultOnSignedOut = (url: string) => window.location.assign(url);

export function HistoryDocumentsPage({
	onSignedOut = defaultOnSignedOut,
}: HistoryDocumentsPageProps) {
	const recoveryHeadingRef = useRef<HTMLHeadingElement>(null);
	const signedOutStatusRef = useRef<HTMLOutputElement>(null);
	const documentsQuery = useQuery({
		queryKey: ["history-documents"],
		queryFn: async (): Promise<HistoryLoadResult> => {
			const response = await fetch("/api/history/documents", { credentials: "same-origin" });
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
			return { state: "documents", documents: body.data.documents };
		},
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
	const documents =
		documentsQuery.data?.state === "documents" ? documentsQuery.data.documents : undefined;

	useEffect(() => {
		if (recovery) recoveryHeadingRef.current?.focus();
	}, [recovery]);
	useEffect(() => {
		if (signOut.isSuccess) signedOutStatusRef.current?.focus();
	}, [signOut.isSuccess]);

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
				{recovery ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>
							<h2 ref={recoveryHeadingRef} tabIndex={-1}>
								{recovery.expired ? "Session expired" : "My documents access required"}
							</h2>
						</AlertTitle>
						<AlertDescription>
							<p>Request a new secure link to continue.</p>
							<a
								className="mt-2 inline-flex rounded-sm font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								href={recovery.recoveryUrl}
							>
								Request a new link
							</a>
						</AlertDescription>
					</Alert>
				) : null}
				{documents?.length === 0 ? (
					<output className="block text-muted-foreground">
						No completed documents are available in this tracer yet.
					</output>
				) : null}
				<ul className="grid gap-4">
					{documents?.map((document) => (
						<li key={document.envelopeId}>
							<article className="space-y-3 rounded-lg border bg-card p-5 shadow-sm">
								<h2 className="font-semibold text-foreground">Completed document</h2>
								<p className="text-muted-foreground text-sm">
									<span className="font-medium text-foreground">Completed</span> ·{" "}
									{historyRoleLabel(document.role)}
								</p>
								<div className="flex flex-wrap gap-4 text-sm">
									<a
										className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										href={document.detailUrl}
									>
										View details
									</a>
									<a
										className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										href={document.downloadUrl}
									>
										Download PDF
									</a>
								</div>
							</article>
						</li>
					))}
				</ul>
			</section>
		</main>
	);
}

function historyRoleLabel(role: HistoryDocumentRow["role"]): string {
	if (role === "creator_and_signer") return "Creator and signer";
	return role === "creator" ? "Creator" : "Signer";
}

function isHistoryDocumentsResponse(value: unknown): value is HistoryDocumentsResponse {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "documents" in data);
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
