import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const agentPrompt =
	"Read /agent.md and /openapi.json. Use $SIGNMOS_TOKEN only in the Authorization Bearer header. Confirm the verified identity before acting, remain within the user's stated goal, and never place the token in prompts, URLs, logs, issues, or source control. Sign/complete, decline, cancel, expire, and delete return pending human review: tell the user, poll the returned command URL, and never claim execution before a completed terminal result.";
const tokenQueryKey = ["agentic-tokens"] as const;

interface AgenticTokenMetadata {
	id: string;
	name: string;
	hint: string;
	createdAt: string;
	lastUsedAt: string | null;
	status: "active" | "revoked";
	revokedAt: string | null;
}

interface TokenListingResponse {
	data: { activeLimit: number; tokens: AgenticTokenMetadata[] };
}

interface TokenGenerationResponse {
	data: {
		secret: string;
		token: { id: string; name: string; hint: string; createdAt: string };
	};
}

class AgenticConsoleError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "AgenticConsoleError";
	}
}

export function AgenticTokenConsole() {
	const queryClient = useQueryClient();
	const [copyStatus, setCopyStatus] = useState("");
	const [pendingRevoke, setPendingRevoke] = useState<AgenticTokenMetadata | null>(null);
	const listing = useQuery({
		queryKey: tokenQueryKey,
		queryFn: async () => {
			const response = await fetch("/api/agentic/tokens", { credentials: "same-origin" });
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok || !isTokenListingResponse(body)) {
				throw consoleError(body, "Unable to load Agentic tokens");
			}
			return body.data;
		},
	});
	const generation = useMutation({
		mutationFn: async (input: { name: string; acknowledgeFullAuthority: true }) => {
			const response = await fetch("/api/agentic/tokens", {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(input),
			});
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok || !isTokenGenerationResponse(body)) {
				throw consoleError(body, "Unable to generate Agentic token");
			}
			return body.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: tokenQueryKey }),
	});
	const revocation = useMutation({
		mutationFn: async (token: AgenticTokenMetadata) => {
			const response = await fetch(`/api/agentic/tokens/${token.id}`, {
				method: "DELETE",
				credentials: "same-origin",
			});
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok) throw consoleError(body, `Unable to revoke ${token.name}`);
			return token.id;
		},
		onSuccess: async () => {
			setPendingRevoke(null);
			await queryClient.invalidateQueries({ queryKey: tokenQueryKey });
		},
	});
	const form = useForm({
		defaultValues: { name: "", acknowledgeFullAuthority: false },
		onSubmit: ({ value }) => {
			if (!value.acknowledgeFullAuthority) return;
			generation.mutate({
				name: value.name.trim(),
				acknowledgeFullAuthority: true,
			});
		},
	});
	const activeCount = listing.data?.tokens.filter((token) => token.status === "active").length ?? 0;
	const atLimit = listing.data ? activeCount >= listing.data.activeLimit : true;

	async function copy(value: string, successMessage: string) {
		try {
			await navigator.clipboard.writeText(value);
			setCopyStatus(successMessage);
		} catch {
			setCopyStatus("Copy failed. Select and copy the text manually.");
		}
	}

	return (
		<main className="min-h-dvh bg-background px-6 py-10">
			<section className="mx-auto max-w-2xl space-y-6">
				<div className="space-y-2">
					<p className="text-sm font-medium text-primary">Signmos Agentic mode</p>
					<h1 className="text-3xl font-semibold text-foreground">Create an Agentic token</h1>
					<p className="text-muted-foreground">
						Anyone holding this token can send, sign, decline, cancel, and delete documents as your
						verified email. Sign, decline, cancel, expire, and delete requests still require the
						matching human to approve the exact action in Signmos before it runs.
					</p>
				</div>

				<TokenListing listing={listing} onRevoke={setPendingRevoke} />

				<form
					aria-label="Generate Agentic token"
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
					className="space-y-4 rounded-lg border bg-card p-5 shadow-sm"
				>
					<form.Field name="name">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor="agentic-token-name">Token name</Label>
								<Input
									id="agentic-token-name"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									required
									disabled={atLimit}
								/>
							</div>
						)}
					</form.Field>
					<form.Field name="acknowledgeFullAuthority">
						{(field) => (
							<label className="flex items-start gap-3 text-sm text-foreground">
								<input
									type="checkbox"
									name={field.name}
									checked={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.checked)}
									required
									disabled={atLimit}
									className="mt-0.5 size-4 rounded border-input"
								/>
								<span>
									I understand this token can send, sign, decline, cancel, and delete as my verified
									email.
								</span>
							</label>
						)}
					</form.Field>
					<Button type="submit" disabled={generation.isPending || atLimit}>
						{generation.isPending ? "Generating..." : "Generate token"}
					</Button>
					{atLimit && listing.data ? (
						<p className="text-sm text-muted-foreground">Revoke a token to create another.</p>
					) : null}
				</form>

				{generation.isError ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>Token generation failed</AlertTitle>
						<AlertDescription>{generation.error.message}</AlertDescription>
					</Alert>
				) : null}

				{generation.data ? (
					<Alert role="status">
						<AlertTitle>Copy this token now</AlertTitle>
						<AlertDescription className="space-y-3">
							<p>This secret is shown once and cannot be recovered after this page reloads.</p>
							<code className="block overflow-wrap-anywhere rounded bg-muted p-3 font-mono text-sm">
								{generation.data.secret}
							</code>
							<Button
								type="button"
								variant="outline"
								onClick={() =>
									copy(`export SIGNMOS_TOKEN='${generation.data.secret}'`, "Token setup copied.")
								}
							>
								Copy token setup
							</Button>
						</AlertDescription>
					</Alert>
				) : null}

				<section aria-labelledby="agent-prompt-title" className="space-y-3 rounded-lg border p-5">
					<h2 id="agent-prompt-title" className="text-lg font-semibold">
						Agent prompt
					</h2>
					<pre
						data-testid="agent-prompt"
						className="whitespace-pre-wrap text-sm text-muted-foreground"
					>
						{agentPrompt}
					</pre>
					<nav aria-label="Agent API resources" className="flex flex-wrap gap-4 text-sm">
						<a className="font-medium text-primary underline" href="/agent.md">
							Open Agent guide
						</a>
						<a className="font-medium text-primary underline" href="/openapi.json">
							OpenAPI schema
						</a>
					</nav>
					<Button
						type="button"
						variant="outline"
						onClick={() => copy(agentPrompt, "Agent prompt copied.")}
					>
						Copy agent prompt
					</Button>
				</section>
				{copyStatus ? (
					<output aria-live="polite" className="block text-sm text-muted-foreground">
						{copyStatus}
					</output>
				) : null}
			</section>
			{pendingRevoke ? (
				<div
					role="alertdialog"
					aria-modal="true"
					aria-labelledby="revoke-token-title"
					className="fixed inset-0 grid place-items-center bg-black/40 p-6"
				>
					<div className="max-w-md space-y-4 rounded-lg bg-background p-6 shadow-lg">
						<h2 id="revoke-token-title" className="text-lg font-semibold">
							Revoke {pendingRevoke.name}?
						</h2>
						<p className="text-sm text-muted-foreground">
							This token will stop working immediately. Your other tokens remain active.
						</p>
						{revocation.isError ? <p role="alert">{revocation.error.message}</p> : null}
						<div className="flex gap-3">
							<Button type="button" variant="outline" onClick={() => setPendingRevoke(null)}>
								Cancel
							</Button>
							<Button
								type="button"
								variant="destructive"
								disabled={revocation.isPending}
								onClick={() => revocation.mutate(pendingRevoke)}
							>
								{revocation.isPending ? "Revoking..." : "Confirm revoke"}
							</Button>
						</div>
					</div>
				</div>
			) : null}
		</main>
	);
}

function TokenListing({
	listing,
	onRevoke,
}: {
	listing: ReturnType<typeof useQuery<{ activeLimit: number; tokens: AgenticTokenMetadata[] }>>;
	onRevoke: (token: AgenticTokenMetadata) => void;
}) {
	if (listing.isPending) return <output>Loading Agentic tokens…</output>;
	if (listing.isError) {
		const expired =
			listing.error instanceof AgenticConsoleError &&
			["AGENTIC_MANAGEMENT_SESSION_EXPIRED", "AGENTIC_MANAGEMENT_SESSION_REQUIRED"].includes(
				listing.error.code,
			);
		return (
			<Alert role="alert" variant="destructive">
				<AlertTitle>
					{expired ? "Agentic management session expired" : "Unable to load Agentic tokens"}
				</AlertTitle>
				<AlertDescription>
					{expired ? (
						<a href="/?task=agentic">Verify email again</a>
					) : (
						"Retry or verify your connection."
					)}
				</AlertDescription>
			</Alert>
		);
	}
	const activeCount = listing.data.tokens.filter((token) => token.status === "active").length;
	return (
		<section aria-labelledby="agentic-token-list-title" className="space-y-3 rounded-lg border p-5">
			<div className="flex items-center justify-between gap-4">
				<h2 id="agentic-token-list-title" className="text-lg font-semibold">
					Your Agentic tokens
				</h2>
				<p className="text-sm font-medium">
					{activeCount} of {listing.data.activeLimit} active
				</p>
			</div>
			{listing.data.tokens.length === 0 ? (
				<output className="block text-sm text-muted-foreground">No Agentic tokens yet.</output>
			) : (
				<ul className="space-y-3">
					{listing.data.tokens.map((token) => (
						<li key={token.id} className="space-y-2 rounded-md border p-4">
							<h3 className="font-medium">
								{token.name} — {token.status === "active" ? "Active" : "Revoked"}
							</h3>
							<code className="text-sm">{token.hint}</code>
							<p className="text-sm text-muted-foreground">Created {formatDate(token.createdAt)}</p>
							<p className="text-sm text-muted-foreground">
								{token.lastUsedAt ? `Last used ${formatDate(token.lastUsedAt)}` : "Never used"}
							</p>
							{token.status === "active" ? (
								<Button type="button" variant="outline" onClick={() => onRevoke(token)}>
									Revoke {token.name}
								</Button>
							) : token.revokedAt ? (
								<p className="text-sm text-muted-foreground">
									Revoked {formatDate(token.revokedAt)}
								</p>
							) : null}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

function formatDate(value: string): string {
	return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
		new Date(value),
	);
}

function consoleError(value: unknown, fallback: string): AgenticConsoleError {
	if (value && typeof value === "object" && "error" in value) {
		const error = value.error;
		if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
			const message =
				"message" in error && typeof error.message === "string" ? error.message : fallback;
			return new AgenticConsoleError(error.code, message);
		}
	}
	return new AgenticConsoleError("UNKNOWN", fallback);
}

function isTokenListingResponse(value: unknown): value is TokenListingResponse {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(
		data &&
			typeof data === "object" &&
			"activeLimit" in data &&
			typeof data.activeLimit === "number" &&
			"tokens" in data &&
			Array.isArray(data.tokens),
	);
}

function isTokenGenerationResponse(value: unknown): value is TokenGenerationResponse {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "secret" in data && "token" in data);
}
