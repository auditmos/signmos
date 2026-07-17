import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface AgenticAccessConfirmationPageProps {
	credential: string;
	onAuthenticated?: (url: string) => void;
}

interface LinkInspectionResponse {
	data: { state: "confirm" | "unknown" | "consumed" | "expired"; expiresAt?: string };
}

interface RedemptionResponse {
	data: { status: "authenticated"; redirectUrl: string };
}

const defaultOnAuthenticated = (url: string) => window.location.assign(url);
const recoveryByState = {
	unknown: "This link is not recognized. Request a new Agentic link.",
	consumed: "This one-time link was already used. Request a new Agentic link.",
	expired: "This Agentic link expired. Request a new one to continue.",
} as const;

export function AgenticAccessConfirmationPage({
	credential,
	onAuthenticated = defaultOnAuthenticated,
}: AgenticAccessConfirmationPageProps) {
	const inspection = useQuery({
		queryKey: ["agentic-access-link"],
		gcTime: 0,
		queryFn: async () => {
			const response = await fetch("/api/agentic/access-links/inspect", {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ credential }),
			});
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok || !isLinkInspectionResponse(body)) {
				throw new Error("Unable to inspect Agentic link");
			}
			return body.data;
		},
	});
	const redemption = useMutation({
		mutationFn: async () => {
			const response = await fetch("/api/agentic/access-links/redeem", {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ credential }),
			});
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok || !isRedemptionResponse(body)) {
				throw new Error("Unable to redeem Agentic link");
			}
			return body.data;
		},
		onSuccess: (data) => onAuthenticated(data.redirectUrl),
	});
	const recovery =
		inspection.data && inspection.data.state !== "confirm"
			? recoveryByState[inspection.data.state]
			: inspection.isError || redemption.isError
				? "This Agentic link is unavailable. Request a new one to continue."
				: null;

	return (
		<main className="min-h-dvh bg-background px-6 py-10">
			<section className="mx-auto max-w-xl space-y-6">
				<p className="text-sm font-medium text-primary">Signmos Agentic mode</p>
				<h1 className="text-3xl font-semibold text-foreground">Confirm Agentic access</h1>
				{inspection.isPending ? (
					<output aria-live="polite" className="block text-muted-foreground">
						Checking this secure link…
					</output>
				) : null}
				{inspection.data?.state === "confirm" ? (
					<>
						<p className="text-muted-foreground">
							Continue only if you requested Agentic access for this browser.
						</p>
						<Button
							type="button"
							onClick={() => redemption.mutate()}
							disabled={redemption.isPending}
						>
							{redemption.isPending ? "Confirming..." : "Continue to token management"}
						</Button>
					</>
				) : null}
				{recovery ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>Link unavailable</AlertTitle>
						<AlertDescription>
							<p>{recovery}</p>
							<a className="mt-2 inline-flex font-medium underline" href="/?task=agentic">
								Request a new link
							</a>
						</AlertDescription>
					</Alert>
				) : null}
			</section>
		</main>
	);
}

function isLinkInspectionResponse(value: unknown): value is LinkInspectionResponse {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "state" in data);
}

function isRedemptionResponse(value: unknown): value is RedemptionResponse {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "redirectUrl" in data);
}
