import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface HistoryAccessConfirmationPageProps {
	credential: string;
	onAuthenticated?: (url: string) => void;
}

interface LinkInspectionResponse {
	data: {
		state: "confirm" | "unknown" | "consumed" | "expired" | "revoked";
		expiresAt?: string;
	};
}

interface RedemptionResponse {
	data: { status: "authenticated"; redirectUrl: string };
}

const defaultOnAuthenticated = (url: string) => window.location.assign(url);

export function HistoryAccessConfirmationPage({
	credential,
	onAuthenticated = defaultOnAuthenticated,
}: HistoryAccessConfirmationPageProps) {
	const encodedCredential = encodeURIComponent(credential);
	const inspection = useQuery({
		queryKey: ["history-access-link", credential],
		queryFn: async () => {
			const response = await fetch(`/api/history/access-links/${encodedCredential}`, {
				method: "GET",
				credentials: "same-origin",
			});
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok || !isLinkInspectionResponse(body)) {
				throw new Error("Unable to inspect My documents link");
			}
			return body.data;
		},
	});
	const redemption = useMutation({
		mutationFn: async () => {
			const response = await fetch(`/api/history/access-links/${encodedCredential}/redeem`, {
				method: "POST",
				credentials: "same-origin",
			});
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok || !isRedemptionResponse(body)) {
				throw new Error("Unable to redeem My documents link");
			}
			return body.data;
		},
		onSuccess: (data) => onAuthenticated(data.redirectUrl),
	});

	return (
		<main className="min-h-dvh bg-background px-6 py-10">
			<section className="mx-auto max-w-xl space-y-6">
				<p className="text-sm font-medium text-primary">Signmos</p>
				<h1 className="text-3xl font-semibold text-foreground">Confirm My documents access</h1>

				{inspection.isPending ? (
					<output aria-live="polite" className="block text-muted-foreground">
						Checking this secure link…
					</output>
				) : null}
				{inspection.data?.state === "confirm" ? (
					<>
						<p className="text-muted-foreground">
							Continue only if you requested access to your Signmos documents.
						</p>
						<Button
							type="button"
							onClick={() => redemption.mutate()}
							disabled={redemption.isPending}
						>
							{redemption.isPending ? "Confirming..." : "Continue to My documents"}
						</Button>
					</>
				) : null}
				{inspection.isError ||
				(inspection.data && inspection.data.state !== "confirm") ||
				redemption.isError ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>This link cannot be used</AlertTitle>
						<AlertDescription>
							Return to Signmos and request a new My documents link.
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
