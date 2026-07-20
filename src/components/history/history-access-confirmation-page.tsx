import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface HistoryAccessConfirmationPageProps {
	credential: string;
	onAuthenticated?: (url: string) => void;
	returnTo?: string;
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
const recoveryByState = {
	unknown: {
		title: "Link not recognized",
		message: "This link is not available. Request a new secure link to continue.",
	},
	consumed: {
		title: "Link already used",
		message: "This one-time link was already used. Request a new link for this browser.",
	},
	expired: {
		title: "Link expired",
		message: "This secure link has expired. Request a new link to continue.",
	},
	revoked: {
		title: "Link replaced",
		message: "A newer access request replaced this link. Request another link if needed.",
	},
} as const;

export function HistoryAccessConfirmationPage({
	credential,
	onAuthenticated = defaultOnAuthenticated,
	returnTo,
}: HistoryAccessConfirmationPageProps) {
	const recoveryHeadingRef = useRef<HTMLHeadingElement>(null);
	const encodedCredential = encodeURIComponent(credential);
	const inspection = useQuery({
		queryKey: ["history-access-link"],
		gcTime: 0,
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
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ ...(returnTo ? { returnTo } : {}) }),
			});
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok || !isRedemptionResponse(body)) {
				throw new Error("Unable to redeem My documents link");
			}
			return body.data;
		},
		onSuccess: (data) => onAuthenticated(data.redirectUrl),
	});
	const recovery =
		inspection.data && inspection.data.state !== "confirm"
			? recoveryByState[inspection.data.state]
			: inspection.isError || redemption.isError
				? { title: "Link unavailable", message: "Request a new secure link to continue." }
				: null;

	useEffect(() => {
		if (recovery) recoveryHeadingRef.current?.focus();
	}, [recovery]);

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
				{recovery ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>
							<h2 ref={recoveryHeadingRef} tabIndex={-1}>
								{recovery.title}
							</h2>
						</AlertTitle>
						<AlertDescription>
							<p>{recovery.message}</p>
							<a
								className="mt-2 inline-flex rounded-sm font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								href="/?task=my-documents"
							>
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
