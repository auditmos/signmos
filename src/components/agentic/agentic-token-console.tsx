import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const agentPrompt =
	"Read /agent.md and /openapi.json. Use $SIGNMOS_TOKEN only in the Authorization Bearer header. Confirm the verified identity before acting, remain within the user's stated goal, and never place the token in prompts, URLs, logs, issues, or source control.";

interface TokenGenerationResponse {
	data: {
		secret: string;
		token: { id: string; name: string; hint: string; createdAt: string };
	};
}

export function AgenticTokenConsole() {
	const [copyStatus, setCopyStatus] = useState("");
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
				throw new Error("Unable to generate Agentic token");
			}
			return body.data;
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
						verified email.
					</p>
				</div>

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
									className="mt-0.5 size-4 rounded border-input"
								/>
								<span>
									I understand this token can send, sign, decline, cancel, and delete as my verified
									email.
								</span>
							</label>
						)}
					</form.Field>
					<Button type="submit" disabled={generation.isPending}>
						{generation.isPending ? "Generating..." : "Generate token"}
					</Button>
				</form>

				{generation.isError ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>Token generation failed</AlertTitle>
						<AlertDescription>Verify your email again and retry.</AlertDescription>
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
		</main>
	);
}

function isTokenGenerationResponse(value: unknown): value is TokenGenerationResponse {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "secret" in data && "token" in data);
}
