import { useEffect, useRef } from "react";

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

export function TurnstileWidget({ siteKey }: { siteKey: string }) {
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

export function readTurnstileToken(
	widgetToken: FormDataEntryValue | null,
	fallbackToken: string,
): string {
	const completedWidgetToken = typeof widgetToken === "string" ? widgetToken.trim() : "";
	return completedWidgetToken || fallbackToken;
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
