import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { readTurnstileToken, TurnstileWidget } from "@/components/turnstile-widget";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface HistoryRequestFormProps {
	onBack: () => void;
	returnTo?: string;
	turnstileSiteKey: string;
	testTurnstileToken: string;
}

export function HistoryRequestForm({
	onBack,
	returnTo,
	turnstileSiteKey,
	testTurnstileToken,
}: HistoryRequestFormProps) {
	const [initialIdempotencyKey] = useState(() => crypto.randomUUID());
	const idempotencyKeyRef = useRef(initialIdempotencyKey);
	const emailInputRef = useRef<HTMLInputElement>(null);
	const acceptedStatusRef = useRef<HTMLDivElement>(null);
	const pendingTurnstileTokenRef = useRef("");
	const [turnstileError, setTurnstileError] = useState("");
	const hasTurnstileConfig = Boolean(turnstileSiteKey || testTurnstileToken);
	const requestMutation = useMutation({
		mutationFn: async (input: { email: string; turnstileToken: string }) => {
			const idempotencyKey = idempotencyKeyRef.current;
			const response = await fetch("/api/history/access-requests", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"idempotency-key": idempotencyKey,
				},
				body: JSON.stringify({ ...input, ...(returnTo ? { returnTo } : {}) }),
			});
			if (!response.ok) throw new Error("Unable to request My documents access");
			idempotencyKeyRef.current = crypto.randomUUID();
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

	useEffect(() => {
		if (requestMutation.isSuccess) acceptedStatusRef.current?.focus();
	}, [requestMutation.isSuccess]);

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
		void form.handleSubmit().then(() => {
			if (!isValidEmail(form.state.values.email)) emailInputRef.current?.focus();
		});
	}

	return (
		<form
			aria-label="Request My documents access"
			onSubmit={submitForm}
			className="rounded-lg border bg-card p-5 shadow-sm"
		>
			<Button type="button" variant="outline" onClick={onBack} className="mb-4 cursor-pointer">
				Back to task choices
			</Button>
			<div className="space-y-5">
				<form.Field
					name="email"
					validators={{
						onSubmit: ({ value }) =>
							isValidEmail(value) ? undefined : "Enter a valid email address",
					}}
				>
					{(field) => (
						<div className="space-y-2">
							<Label htmlFor="history-email">Email</Label>
							<Input
								ref={emailInputRef}
								id="history-email"
								name={field.name}
								type="email"
								autoComplete="email"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								aria-invalid={field.state.meta.errors.length > 0}
								aria-describedby={
									field.state.meta.errors.length > 0 ? "history-email-error" : undefined
								}
							/>
							{field.state.meta.errors.length > 0 ? (
								<p id="history-email-error" role="alert" className="text-sm text-destructive">
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
						<AlertDescription>Secure document access is unavailable right now.</AlertDescription>
					</Alert>
				) : null}
				{turnstileError ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>Complete the security check</AlertTitle>
						<AlertDescription>{turnstileError}</AlertDescription>
					</Alert>
				) : null}

				{requestMutation.isSuccess ? (
					<Alert ref={acceptedStatusRef} role="status" tabIndex={-1}>
						<AlertTitle>Check your email</AlertTitle>
						<AlertDescription>
							If eligible documents are associated with that address, a secure link is on its way.
							Check the spelling, look in spam, or try another email address. Completed and expired
							documents are retained for 90 days unless deleted earlier.
						</AlertDescription>
					</Alert>
				) : null}
				{requestMutation.isError ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>Request failed</AlertTitle>
						<AlertDescription>Unable to request My documents access.</AlertDescription>
					</Alert>
				) : null}

				<div className="flex flex-wrap gap-3">
					<Button type="submit" disabled={requestMutation.isPending || !hasTurnstileConfig}>
						{requestMutation.isPending ? "Requesting..." : "Email me a secure link"}
					</Button>
				</div>
			</div>
		</form>
	);
}

function isValidEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
