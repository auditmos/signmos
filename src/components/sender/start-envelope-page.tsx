import { useForm } from "@tanstack/react-form";
import {
	ArrowRight,
	Bot,
	FileSignature,
	Files,
	type LucideIcon,
	Send,
	UsersRound,
} from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useRef, useState } from "react";
import { AgenticAccessRequestForm } from "@/components/agentic/agentic-access-request-form";
import { HistoryRequestForm } from "@/components/history/history-request-form";
import { readTurnstileToken, TurnstileWidget } from "@/components/turnstile-widget";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface StartEnvelopePageProps {
	initialTask?: "my_documents" | "agentic";
	historyReturnTo?: string;
	turnstileSiteKey?: string;
	testTurnstileToken?: string;
}

type SigningMode = "only_me" | "me_and_another_signer";
type LandingTask = SigningMode | "my_documents" | "agentic";

const landingTaskChoices = [
	{
		task: "only_me",
		label: "Sign by myself",
		description: "Upload and sign your PDF",
		icon: FileSignature,
	},
	{
		task: "me_and_another_signer",
		label: "Sign with someone else",
		description: "Add one other signer",
		icon: UsersRound,
	},
	{
		task: "my_documents",
		label: "My documents",
		description: "View and manage your PDFs",
		icon: Files,
	},
	{
		task: "agentic",
		label: "Agentic mode",
		description: "Connect Signmos to an agent",
		icon: Bot,
	},
] as const satisfies ReadonlyArray<{
	task: LandingTask;
	label: string;
	description: string;
	icon: LucideIcon;
}>;

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
	initialTask,
	historyReturnTo,
	turnstileSiteKey,
	testTurnstileToken = "",
}: StartEnvelopePageProps) {
	const [activeTask, setActiveTask] = useState<LandingTask | null>(initialTask ?? null);
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
		if (task === "only_me" || task === "me_and_another_signer") {
			form.setFieldValue("signingMode", task);
		}
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

	function returnToTaskChooser() {
		setActiveTask(null);
		setState({ status: "idle" });
	}

	const isTaskChooserVisible = activeTask === null;

	return (
		<main
			className={cn(
				"min-h-dvh bg-background px-6 py-10",
				isTaskChooserVisible && "flex items-center",
			)}
		>
			<section
				className={cn(
					"mx-auto grid w-full max-w-5xl gap-8",
					isTaskChooserVisible ? "max-w-3xl gap-10" : "lg:grid-cols-[1fr_420px] lg:items-start",
				)}
			>
				<div
					className={cn(isTaskChooserVisible ? "mx-auto max-w-2xl text-center" : "pt-8 lg:pt-20")}
				>
					<p className="text-sm font-medium text-primary">Signmos</p>
					<h1 className="mt-4 max-w-2xl text-balance text-4xl font-semibold text-foreground sm:text-5xl">
						{isTaskChooserVisible
							? "Sign a PDF without an account"
							: "Start a PDF signature envelope"}
					</h1>
					<p
						className={cn(
							"mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground",
							isTaskChooserVisible && "mx-auto",
						)}
					>
						{isTaskChooserVisible
							? "Choose how you’d like to get started."
							: "Enter your sender details, verify your email, then upload and prepare the document."}
					</p>
				</div>

				<LandingTaskPanel
					activeTask={activeTask}
					historyReturnTo={historyReturnTo}
					onBack={returnToTaskChooser}
					onChoose={chooseTask}
					turnstileSiteKey={activeTurnstileSiteKey}
					testTurnstileToken={activeTestTurnstileToken}
				>
					<form
						aria-label="Start envelope"
						onSubmit={submitForm}
						className="rounded-lg border bg-card p-5 shadow-sm"
					>
						<Button
							type="button"
							variant="outline"
							onClick={returnToTaskChooser}
							className="mb-4 cursor-pointer"
						>
							Back to task choices
						</Button>
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
	historyReturnTo,
	onBack,
	onChoose,
	turnstileSiteKey,
	testTurnstileToken,
}: {
	activeTask: LandingTask | null;
	children: ReactNode;
	historyReturnTo?: string;
	onBack: () => void;
	onChoose: (task: LandingTask) => void;
	turnstileSiteKey: string;
	testTurnstileToken: string;
}) {
	if (activeTask === null) return <LandingTaskChooser onChoose={onChoose} />;
	if (activeTask === "my_documents") {
		return (
			<HistoryRequestForm
				returnTo={historyReturnTo}
				onBack={onBack}
				turnstileSiteKey={turnstileSiteKey}
				testTurnstileToken={testTurnstileToken}
			/>
		);
	}
	if (activeTask === "agentic") {
		return (
			<AgenticAccessRequestForm
				onBack={onBack}
				turnstileSiteKey={turnstileSiteKey}
				testTurnstileToken={testTurnstileToken}
			/>
		);
	}
	return children;
}

function LandingTaskChooser({ onChoose }: { onChoose: (task: LandingTask) => void }) {
	return (
		<fieldset className="grid gap-3 sm:grid-cols-2">
			<legend className="sr-only">Choose a task</legend>
			{landingTaskChoices.map(({ task, label, description, icon: Icon }) => (
				<Button
					key={task}
					type="button"
					variant="outline"
					aria-label={label}
					onClick={() => onChoose(task)}
					className="h-auto min-h-28 cursor-pointer justify-between whitespace-normal rounded-xl border-border/80 bg-card p-5 text-left shadow-sm hover:border-foreground/30 hover:bg-accent/60"
				>
					<span className="flex min-w-0 items-start gap-4">
						<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
							<Icon aria-hidden="true" className="size-5" />
						</span>
						<span className="min-w-0">
							<span className="block text-base font-semibold text-foreground">{label}</span>
							<span className="mt-1 block text-pretty text-sm font-normal text-muted-foreground">
								{description}
							</span>
						</span>
					</span>
					<ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
				</Button>
			))}
		</fieldset>
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
