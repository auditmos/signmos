import { Send } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StartEnvelopePageProps {
	turnstileSiteKey?: string;
	testTurnstileToken?: string;
}

type StartState =
	| { status: "idle" }
	| { status: "submitting" }
	| { status: "success"; response: SenderStartSuccess["data"] }
	| { status: "error"; message: string };

type SenderStartSuccess = {
	data: {
		envelopeId: string;
		status: "awaiting_verification";
		sender: {
			name: string;
			email: string;
		};
		verification: {
			fallbackUrl: string;
			email: string;
			expiresAt: string;
		};
	};
};

type SenderStartError = {
	error: {
		code: string;
		message: string;
		providerMessage?: string;
	};
};

export function StartEnvelopePage({
	turnstileSiteKey,
	testTurnstileToken = "",
}: StartEnvelopePageProps) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [state, setState] = useState<StartState>({ status: "idle" });
	const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

	async function submitStart(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setState({ status: "submitting" });
		const formData = new FormData(event.currentTarget);
		const widgetToken = formData.get("cf-turnstile-response");
		const turnstileToken = typeof widgetToken === "string" ? widgetToken : testTurnstileToken;

		try {
			const response = await fetch("/api/envelopes/sender-start", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"idempotency-key": idempotencyKey,
				},
				body: JSON.stringify({ name, email, turnstileToken }),
			});
			const json: unknown = await response.json().catch(() => null);
			if (!response.ok || !isSenderStartSuccess(json)) {
				const message = isSenderStartError(json)
					? (json.error.providerMessage ?? json.error.message)
					: "Unable to start the envelope";
				setState({ status: "error", message });
				return;
			}

			setState({ status: "success", response: json.data });
		} catch {
			setState({ status: "error", message: "Unable to start the envelope" });
		}
	}

	return (
		<main className="min-h-dvh bg-background px-6 py-10">
			<section className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_420px] lg:items-start">
				<div className="pt-8 lg:pt-20">
					<p className="text-sm font-medium text-primary">Signmos</p>
					<h1 className="mt-4 max-w-2xl text-balance text-4xl font-semibold text-foreground sm:text-5xl">
						Start a PDF signature envelope
					</h1>
					<p className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground">
						Enter your sender details, verify your email, then upload and prepare the document.
					</p>
				</div>

				<form
					aria-label="Start envelope"
					onSubmit={submitStart}
					className="rounded-lg border bg-card p-5 shadow-sm"
				>
					<div className="space-y-5">
						<div className="space-y-2">
							<Label htmlFor="sender-name">Name</Label>
							<Input
								id="sender-name"
								name="name"
								autoComplete="name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="sender-email">Email</Label>
							<Input
								id="sender-email"
								name="email"
								type="email"
								autoComplete="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								required
							/>
						</div>

						{turnstileSiteKey ? (
							<div className="min-h-16">
								<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
								<div className="cf-turnstile" data-sitekey={turnstileSiteKey} />
							</div>
						) : null}

						{state.status === "error" ? (
							<Alert variant="destructive" role="alert">
								<AlertTitle>Start failed</AlertTitle>
								<AlertDescription>{state.message}</AlertDescription>
							</Alert>
						) : null}

						{state.status === "success" ? (
							<Alert>
								<AlertTitle>Check your email</AlertTitle>
								<AlertDescription>
									Verification was created for {state.response.sender.email}.{" "}
									<a
										className="font-medium underline"
										href={state.response.verification.fallbackUrl}
									>
										Open verification link
									</a>
								</AlertDescription>
							</Alert>
						) : null}

						<Button type="submit" className="w-full" disabled={state.status === "submitting"}>
							<Send className="mr-2 size-4" />
							{state.status === "submitting" ? "Starting..." : "Start envelope"}
						</Button>
					</div>
				</form>
			</section>
		</main>
	);
}

function isSenderStartSuccess(value: unknown): value is SenderStartSuccess {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "verification" in data);
}

function isSenderStartError(value: unknown): value is SenderStartError {
	if (!value || typeof value !== "object" || !("error" in value)) return false;
	const error = value.error;
	return Boolean(error && typeof error === "object" && "message" in error);
}
