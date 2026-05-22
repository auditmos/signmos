import { createFileRoute } from "@tanstack/react-router";
import { StartEnvelopePage } from "@/components/sender/start-envelope-page";

export const Route = createFileRoute("/")({
	component: IndexPage,
});

function IndexPage() {
	return (
		<StartEnvelopePage turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || undefined} />
	);
}
