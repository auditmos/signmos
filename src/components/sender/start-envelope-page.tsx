import { useForm } from "@tanstack/react-form";
import { Send } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { HistoryRequestForm } from "@/components/history/history-request-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const turnstileScriptUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js";

type TurnstileApi = {
	render: (container: HTMLElement, options: { sitekey: string }) => string | undefined;
	remove?: (widgetId: string) => void;
};

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

interface StartEnvelopePageProps {
	turnstileSiteKey?: string;
	testTurnstileToken?: string;
}

type SigningMode = "only_me" | "me_and_another_signer";
type LandingTask = SigningMode | "my_documents";

type StartFormValues = {
	signingMode: SigningMode;
	name: string;
	email: string;
};

const startFormDefaults: StartFormValues = {
	signingMode: "only_me",
	name: "",
	email: "",
};

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
	const [activeTask, setActiveTask] = useState<LandingTask | null>(null);
	const [state, setState] = useState<StartState>({ status: "idle" });
	const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
	const pendingTurnstileTokenRef = useRef("");
	const activeTurnstileSiteKey = turnstileSiteKey?.trim() ?? "";
	const activeTestTurnstileToken = testTurnstileToken.trim();
	const hasTurnstileConfig =
		activeTurnstileSiteKey.length > 0 || activeTestTurnstileToken.length > 0;
	const form = useForm({
		defaultValues: startFormDefaults,
		onSubmit: ({ value }) => submitStart(value, pendingTurnstileTokenRef.current),
	});

	function chooseTask(task: LandingTask) {
		if (task !== "my_documents") form.setFieldValue("signingMode", task);
		setActiveTask(task);
	}

	function submitForm(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const widgetToken = formData.get("cf-turnstile-response");
		const turnstileToken = readTurnstileToken(widgetToken, activeTestTurnstileToken);
		if (!turnstileToken) {
			setState({
				status: "error",
				message: activeTurnstileSiteKey
					? "Complete the Turnstile challenge before starting."
					: "Turnstile is not configured for this environment.",
			});
			return;
		}

		pendingTurnstileTokenRef.current = turnstileToken;
		void form.handleSubmit();
	}

	async function submitStart(values: StartFormValues, turnstileToken: string) {
		setState({ status: "submitting" });
		try {
			const response = await fetch("/api/envelopes/sender-start", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"idempotency-key": idempotencyKey,
				},
				body: JSON.stringify({ ...values, turnstileToken }),
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

				<LandingTaskPanel
					activeTask={activeTask}
					onBack={() => setActiveTask(null)}
					onChoose={chooseTask}
				>
					<form
						aria-label="Start envelope"
						onSubmit={submitForm}
						className="rounded-lg border bg-card p-5 shadow-sm"
					>
						<div className="space-y-5">
							<form.Field name="name">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor="sender-name">Name</Label>
										<Input
											id="sender-name"
											name={field.name}
											autoComplete="name"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											required
										/>
									</div>
								)}
							</form.Field>
							<form.Field name="email">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor="sender-email">Email</Label>
										<Input
											id="sender-email"
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

							{activeTurnstileSiteKey ? <TurnstileWidget siteKey={activeTurnstileSiteKey} /> : null}

							{!hasTurnstileConfig ? (
								<Alert variant="destructive" role="alert">
									<AlertTitle>Turnstile is not configured</AlertTitle>
									<AlertDescription>
										Set TURNSTILE_SITE_KEY in .dev.vars and restart the dev server.
									</AlertDescription>
								</Alert>
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
										Verification was sent to {state.response.sender.email}.
									</AlertDescription>
								</Alert>
							) : null}

							<Button
								type="submit"
								className="w-full"
								disabled={state.status === "submitting" || !hasTurnstileConfig}
							>
								<Send className="mr-2 size-4" />
								{state.status === "submitting" ? "Starting..." : "Start envelope"}
							</Button>
						</div>
					</form>
				</LandingTaskPanel>
			</section>
		</main>
	);
}

function LandingTaskPanel({
	activeTask,
	children,
	onBack,
	onChoose,
}: {
	activeTask: LandingTask | null;
	children: ReactNode;
	onBack: () => void;
	onChoose: (task: LandingTask) => void;
}) {
	if (activeTask === null) return <LandingTaskChooser onChoose={onChoose} />;
	if (activeTask === "my_documents") return <HistoryRequestForm onBack={onBack} />;
	return children;
}

function LandingTaskChooser({ onChoose }: { onChoose: (task: LandingTask) => void }) {
	return (
		<fieldset className="grid gap-3">
			<legend className="sr-only">Choose a task</legend>
			<Button type="button" variant="outline" onClick={() => onChoose("only_me")}>
				Sign by myself
			</Button>
			<Button type="button" variant="outline" onClick={() => onChoose("me_and_another_signer")}>
				Sign with someone else
			</Button>
			<Button type="button" variant="outline" onClick={() => onChoose("my_documents")}>
				My documents
			</Button>
		</fieldset>
	);
}

function TurnstileWidget({ siteKey }: { siteKey: string }) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		let disposed = false;
		let widgetId: string | undefined;
		const renderTurnstile = () => {
			if (disposed || widgetId || !window.turnstile) return;
			widgetId = window.turnstile.render(container, { sitekey: siteKey });
		};
		const script = getOrCreateTurnstileScript();
		script.addEventListener("load", renderTurnstile);
		renderTurnstile();
		return () => {
			disposed = true;
			script.removeEventListener("load", renderTurnstile);
			if (widgetId) window.turnstile?.remove?.(widgetId);
		};
	}, [siteKey]);

	return (
		<div className="min-h-16">
			<div ref={containerRef} className="cf-turnstile" />
		</div>
	);
}

function getOrCreateTurnstileScript(): HTMLScriptElement {
	const existingScript = document.querySelector<HTMLScriptElement>(
		`script[src="${turnstileScriptUrl}"]`,
	);
	if (existingScript) return existingScript;

	const script = document.createElement("script");
	script.src = turnstileScriptUrl;
	script.async = true;
	script.defer = true;
	document.head.appendChild(script);
	return script;
}

function readTurnstileToken(widgetToken: FormDataEntryValue | null, fallbackToken: string): string {
	const completedWidgetToken = typeof widgetToken === "string" ? widgetToken.trim() : "";
	return completedWidgetToken || fallbackToken;
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
