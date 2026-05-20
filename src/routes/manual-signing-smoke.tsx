import { createFileRoute } from "@tanstack/react-router";
import { ManualSigningSmokePage } from "@/components/signing/manual-smoke-page";

export const Route = createFileRoute("/manual-signing-smoke")({
	component: ManualSigningSmokePage,
});
