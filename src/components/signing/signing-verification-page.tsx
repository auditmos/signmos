import { Check, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface SigningVerificationPageProps {
	token: string;
	onVerified?: (url: string) => void;
}

type VerificationState =
	| { status: "verifying" }
	| { status: "verified"; signingUrl: string }
	| { status: "error"; message: string };

type SigningVerificationSuccess = {
	data: {
		signingLink: {
			url: string;
		};
	};
};

type SigningVerificationError = {
	error: {
		message: string;
	};
};

const defaultOnVerified = (url: string) => {
	window.location.assign(url);
};

export function SigningVerificationPage({
	token,
	onVerified = defaultOnVerified,
}: SigningVerificationPageProps) {
	const [state, setState] = useState<VerificationState>({ status: "verifying" });
	const apiUrl = useMemo(() => `/api/signing/verifications/${encodeURIComponent(token)}`, [token]);

	useEffect(() => {
		let cancelled = false;

		async function verify() {
			const response = await fetch(apiUrl);
			const json: unknown = await response.json().catch(() => null);
			if (cancelled) return;
			if (!response.ok || !isSigningVerificationSuccess(json)) {
				const message = isSigningVerificationError(json)
					? json.error.message
					: "Unable to verify this signing link";
				setState({ status: "error", message });
				return;
			}

			const signingUrl = json.data.signingLink.url;
			setState({ status: "verified", signingUrl });
			onVerified(signingUrl);
		}

		verify().catch(() => {
			if (!cancelled) setState({ status: "error", message: "Unable to verify this signing link" });
		});

		return () => {
			cancelled = true;
		};
	}, [apiUrl, onVerified]);

	return (
		<main className="min-h-dvh bg-background px-6 py-10">
			<section className="mx-auto max-w-xl space-y-6">
				<div>
					<p className="text-sm font-medium text-primary">Signmos</p>
					<h1 className="mt-3 text-3xl font-semibold text-foreground">Signing verification</h1>
				</div>

				{state.status === "verifying" ? (
					<Alert>
						<Loader2 className="size-4 animate-spin" />
						<AlertTitle>Verifying email</AlertTitle>
						<AlertDescription>Checking this signing link.</AlertDescription>
					</Alert>
				) : null}

				{state.status === "verified" ? (
					<Alert>
						<Check className="size-4" />
						<AlertTitle>Email verified</AlertTitle>
						<AlertDescription>You can now open the signing page.</AlertDescription>
					</Alert>
				) : null}

				{state.status === "error" ? (
					<Alert variant="destructive" role="alert">
						<AlertTitle>Verification failed</AlertTitle>
						<AlertDescription>{state.message}</AlertDescription>
					</Alert>
				) : null}

				{state.status === "verified" ? (
					<Button asChild>
						<a href={state.signingUrl}>Continue to sign</a>
					</Button>
				) : null}
			</section>
		</main>
	);
}

function isSigningVerificationSuccess(value: unknown): value is SigningVerificationSuccess {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "signingLink" in data);
}

function isSigningVerificationError(value: unknown): value is SigningVerificationError {
	if (!value || typeof value !== "object" || !("error" in value)) return false;
	const error = value.error;
	return Boolean(error && typeof error === "object" && "message" in error);
}
