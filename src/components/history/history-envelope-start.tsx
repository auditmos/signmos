import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type HistoryStartSigningMode = "only_me" | "me_and_another_signer";

export interface HistorySessionIdentity {
	email: string;
	suggestedName: string | null;
}

interface HistoryEnvelopeStartProps {
	identity: HistorySessionIdentity;
	initialSigningMode?: HistoryStartSigningMode;
	onStarted?: (redirectUrl: string) => void;
}

interface HistoryEnvelopeStartResponse {
	data: {
		envelopeId: string;
		status: "draft";
		signingMode: HistoryStartSigningMode;
		sender: { name: string; email: string };
		redirectUrl: string;
	};
}

interface HistoryEnvelopeStartError {
	error: { code: string; message: string };
}

const defaultOnStarted = (redirectUrl: string) => window.location.assign(redirectUrl);

export function HistoryEnvelopeStart({
	identity,
	initialSigningMode,
	onStarted = defaultOnStarted,
}: HistoryEnvelopeStartProps) {
	const [open, setOpen] = useState(Boolean(initialSigningMode));
	const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
	const mutation = useMutation({
		mutationFn: async (values: { name: string; signingMode: HistoryStartSigningMode }) => {
			const response = await fetch("/api/history/envelopes", {
				method: "POST",
				credentials: "same-origin",
				headers: {
					"content-type": "application/json",
					"idempotency-key": idempotencyKey,
				},
				body: JSON.stringify(values),
			});
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok || !isHistoryEnvelopeStartResponse(body)) {
				throw new Error(
					isHistoryEnvelopeStartError(body) ? body.error.message : "Unable to start a new document",
				);
			}
			return body.data;
		},
		onSuccess: (data) => onStarted(data.redirectUrl),
	});
	const form = useForm({
		defaultValues: {
			name: identity.suggestedName ?? "",
			signingMode: initialSigningMode ?? ("" as const),
		},
		onSubmit: ({ value }) => {
			if (!value.signingMode) return;
			mutation.mutate({ name: value.name.trim(), signingMode: value.signingMode });
		},
	});

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void form.handleSubmit();
	}

	if (!open) {
		return (
			<Button type="button" onClick={() => setOpen(true)}>
				Start a new document
			</Button>
		);
	}

	return (
		<form
			aria-label="Start a new document"
			className="space-y-5 rounded-lg border bg-card p-5 shadow-sm"
			onSubmit={submit}
		>
			<div>
				<h2 className="font-semibold text-foreground">Start a new document</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Your verified My Documents session replaces another email verification step.
				</p>
			</div>
			<div className="space-y-1">
				<p className="font-medium text-sm">Your verified email</p>
				<output aria-label="Your verified email" className="block text-muted-foreground text-sm">
					{identity.email}
				</output>
			</div>
			<form.Field name="name">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor="history-start-name">Your name</Label>
						<Input
							id="history-start-name"
							name={field.name}
							autoComplete="name"
							maxLength={120}
							required
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					</div>
				)}
			</form.Field>
			<form.Field name="signingMode">
				{(field) => (
					<fieldset className="space-y-3">
						<legend className="font-medium text-sm">Who will sign?</legend>
						{signingModeOptions.map(([value, label]) => (
							<label key={value} className="flex items-center gap-3 text-sm">
								<input
									type="radio"
									name={field.name}
									value={value}
									checked={field.state.value === value}
									onChange={() => field.handleChange(value)}
									required
									className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								/>
								{label}
							</label>
						))}
					</fieldset>
				)}
			</form.Field>
			{mutation.isError ? (
				<Alert role="alert" variant="destructive">
					<AlertTitle>Unable to start document</AlertTitle>
					<AlertDescription>{mutation.error.message}</AlertDescription>
				</Alert>
			) : null}
			<div className="flex flex-wrap gap-3">
				<Button type="submit" disabled={mutation.isPending}>
					{mutation.isPending ? "Starting…" : "Start and upload PDF"}
				</Button>
				<Button type="button" variant="outline" onClick={() => setOpen(false)}>
					Cancel
				</Button>
			</div>
		</form>
	);
}

const signingModeOptions = [
	["only_me", "Sign by myself"],
	["me_and_another_signer", "Sign with someone else"],
] as const;

function isHistoryEnvelopeStartResponse(value: unknown): value is HistoryEnvelopeStartResponse {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "redirectUrl" in data);
}

function isHistoryEnvelopeStartError(value: unknown): value is HistoryEnvelopeStartError {
	if (!value || typeof value !== "object" || !("error" in value)) return false;
	const error = value.error;
	return Boolean(error && typeof error === "object" && "message" in error);
}
