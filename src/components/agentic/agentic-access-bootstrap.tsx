import { useEffect, useState } from "react";
import { AgenticAccessConfirmationPage } from "./agentic-access-confirmation-page";

export function AgenticAccessBootstrap() {
	const [credential, setCredential] = useState("");

	useEffect(() => {
		const rawFragment = window.location.hash.slice(1);
		if (rawFragment) {
			setCredential(decodeFragment(rawFragment));
			window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
		}
	}, []);

	if (!credential) {
		return (
			<main className="min-h-dvh bg-background px-6 py-10">
				<p className="mx-auto max-w-xl text-muted-foreground">Checking this secure link…</p>
			</main>
		);
	}
	return <AgenticAccessConfirmationPage credential={credential} />;
}

function decodeFragment(fragment: string): string {
	try {
		return decodeURIComponent(fragment);
	} catch {
		return "";
	}
}
