import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, getGlobalStartContext } from "@tanstack/react-start";
import { StartEnvelopePage } from "@/components/sender/start-envelope-page";

const getStartEnvelopePageConfig = createServerFn({ method: "GET" }).handler(async () => {
	const context = getGlobalStartContext();
	return {
		turnstileSiteKey: normalizeOptionalValue(
			context?.turnstileSiteKey ?? import.meta.env.VITE_TURNSTILE_SITE_KEY,
		),
	};
});

export const Route = createFileRoute("/")({
	loader: () => getStartEnvelopePageConfig(),
	component: IndexPage,
});

function IndexPage() {
	const config = Route.useLoaderData();
	return <StartEnvelopePage turnstileSiteKey={config.turnstileSiteKey} />;
}

function normalizeOptionalValue(value: string | undefined): string | undefined {
	const normalized = value?.trim();
	return normalized ? normalized : undefined;
}
