import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { readTurnstileToken, TurnstileWidget } from "@/components/turnstile-widget";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AgenticAccessRequestFormProps {
	onBack: () => void;
	turnstileSiteKey: string;
	testTurnstileToken: string;
}

export function AgenticAccessRequestForm({
	onBack,
	turnstileSiteKey,
	testTurnstileToken,
}: AgenticAccessRequestFormProps) {
	const [idempotencyKey] = useState(() => crypto.randomUUID());
	const pendingTurnstileTokenRef = useRef("");
	const [turnstileError, setTurnstileError] = useState("");
	const hasTurnstileConfig = Boolean(turnstileSiteKey || testTurnstileToken);
	const requestMutation = useMutation({
		mutationFn: async (input: { email: string; turnstileToken: string }) => {
			const response = await fetch("/api/agentic/access-requests", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"idempotency-key": idempotencyKey,
				},
				body: JSON.stringify(input),
			});
			if (!response.ok) throw new Error("Unable to request Agentic access");
			return response;
		},
	});
	const form = useForm({
		defaultValues: { email: "" },
		onSubmit: ({ value }) =>
			requestMutation.mutate({
				email: value.email,
				turnstileToken: pendingTurnstileTokenRef.current,
			}),
	});

	function submitForm(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const turnstileToken = readTurnstileToken(
			formData.get("cf-turnstile-response"),
			testTurnstileToken,
		);
		if (!turnstileToken) {
			setTurnstileError("Complete the Turnstile challenge before requesting access.");
			return;
		}
		setTurnstileError("");
		pendingTurnstileTokenRef.current = turnstileToken;
		void form.handleSubmit();
	}

	return (
		<form
			aria-label="Request Agentic access"
			onSubmit={submitForm}
			className="space-y-5 rounded-lg border bg-card p-5 shadow-sm"
		>
			<form.Field
				name="email"
				validators={{
					onSubmit: ({ value }) =>
						isValidEmail(value) ? undefined : "Enter a valid email address",
				}}
			>
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor="agentic-email">Email</Label>
						<Input
							id="agentic-email"
							name={field.name}
							type="email"
							autoComplete="email"
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							aria-invalid={field.state.meta.errors.length > 0}
						/>
						{field.state.meta.errors.length > 0 ? (
							<p role="alert" className="text-sm text-destructive">
								Enter a valid email address
							</p>
						) : null}
					</div>
				)}
			</form.Field>

			{turnstileSiteKey ? <TurnstileWidget siteKey={turnstileSiteKey} /> : null}
			{!hasTurnstileConfig ? (
				<Alert role="alert" variant="destructive">
					<AlertTitle>Turnstile is not configured</AlertTitle>
					<AlertDescription>Agentic access is unavailable right now.</AlertDescription>
				</Alert>
			) : null}
			{turnstileError ? (
				<Alert role="alert" variant="destructive">
					<AlertTitle>Complete the security check</AlertTitle>
					<AlertDescription>{turnstileError}</AlertDescription>
				</Alert>
			) : null}
			{requestMutation.isSuccess ? (
				<Alert role="status">
					<AlertTitle>Check your email</AlertTitle>
					<AlertDescription>
						If the request can be completed, a secure single-use link is on its way.
					</AlertDescription>
				</Alert>
			) : null}
			{requestMutation.isError ? (
				<Alert role="alert" variant="destructive">
					<AlertTitle>Request failed</AlertTitle>
					<AlertDescription>Unable to request Agentic access.</AlertDescription>
				</Alert>
			) : null}

			<div className="flex flex-wrap gap-3">
				<Button type="submit" disabled={requestMutation.isPending || !hasTurnstileConfig}>
					{requestMutation.isPending ? "Requesting..." : "Email me an Agentic link"}
				</Button>
				<Button type="button" variant="outline" onClick={onBack}>
					Back to task choices
				</Button>
			</div>
		</form>
	);
}

function isValidEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
