import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface HistoryRequestFormProps {
	onBack: () => void;
}

export function HistoryRequestForm({ onBack }: HistoryRequestFormProps) {
	const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
	const requestMutation = useMutation({
		mutationFn: async (email: string) => {
			const response = await fetch("/api/history/access-requests", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"idempotency-key": idempotencyKey,
				},
				body: JSON.stringify({ email }),
			});
			if (!response.ok) throw new Error("Unable to request My documents access");
			return response;
		},
	});
	const form = useForm({
		defaultValues: { email: "" },
		onSubmit: ({ value }) => requestMutation.mutate(value.email),
	});

	function submitForm(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void form.handleSubmit();
	}

	return (
		<form
			aria-label="Request My documents access"
			onSubmit={submitForm}
			className="space-y-5 rounded-lg border bg-card p-5 shadow-sm"
		>
			<form.Field name="email">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor="history-email">Email</Label>
						<Input
							id="history-email"
							name={field.name}
							type="email"
							autoComplete="email"
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							required
						/>
					</div>
				)}
			</form.Field>

			{requestMutation.isSuccess ? (
				<Alert role="status">
					<AlertTitle>Check your email</AlertTitle>
					<AlertDescription>
						If documents match this address, a secure access link is on its way.
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
				<Button type="submit" disabled={requestMutation.isPending}>
					{requestMutation.isPending ? "Requesting..." : "Email me a secure link"}
				</Button>
				<Button type="button" variant="outline" onClick={onBack}>
					Back to task choices
				</Button>
			</div>
		</form>
	);
}
