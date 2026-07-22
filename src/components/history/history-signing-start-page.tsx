import { useQuery } from "@tanstack/react-query";
import { AuthenticatedProductNavigation } from "@/components/navigation/product-mode-navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	HistoryEnvelopeStart,
	type HistorySessionIdentity,
	type HistoryStartSigningMode,
} from "./history-envelope-start";

interface HistoryIdentityResponse {
	data: { identity: HistorySessionIdentity };
}

const signingModeContent = {
	only_me: {
		heading: "Sign a PDF by yourself",
		description: "Start a new document using your verified My Documents identity.",
	},
	me_and_another_signer: {
		heading: "Sign a PDF with someone else",
		description: "Start a new document and add one other signer after uploading your PDF.",
	},
} as const;

export function HistorySigningStartPage({ signingMode }: { signingMode: HistoryStartSigningMode }) {
	const identity = useQuery({
		queryKey: ["history-start-identity"],
		queryFn: fetchHistoryIdentity,
	});
	const content = signingModeContent[signingMode];

	return (
		<main className="min-h-dvh bg-background px-6 py-10">
			<section className="mx-auto max-w-3xl space-y-8">
				<AuthenticatedProductNavigation activeMode={signingMode} />
				<div>
					<p className="text-sm font-medium text-primary">Signmos</p>
					<h1 className="mt-3 text-balance text-3xl font-semibold text-foreground">
						{content.heading}
					</h1>
					<p className="mt-3 text-pretty text-muted-foreground">{content.description}</p>
				</div>

				{identity.isPending ? (
					<output aria-live="polite" className="block rounded-lg border p-5 text-muted-foreground">
						Loading your verified identity…
					</output>
				) : null}
				{identity.isError ? (
					<Alert role="alert" variant="destructive">
						<AlertTitle>My Documents access required</AlertTitle>
						<AlertDescription>
							<a className="font-medium underline" href="/?task=my-documents">
								Verify your email to continue
							</a>
						</AlertDescription>
					</Alert>
				) : null}
				{identity.data ? (
					<HistoryEnvelopeStart
						identity={identity.data}
						initialSigningMode={signingMode}
						collapsible={false}
					/>
				) : null}
			</section>
		</main>
	);
}

async function fetchHistoryIdentity(): Promise<HistorySessionIdentity> {
	const response = await fetch("/api/history/documents?page=1", { credentials: "same-origin" });
	const body: unknown = await response.json().catch(() => null);
	if (!response.ok || !isHistoryIdentityResponse(body)) {
		throw new Error("My Documents access is required");
	}
	return body.data.identity;
}

function isHistoryIdentityResponse(value: unknown): value is HistoryIdentityResponse {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "identity" in data);
}
