import { createFileRoute } from "@tanstack/react-router";
import { HumanReviewPage } from "@/components/history/human-review-page";

export const Route = createFileRoute("/human-review/$reviewId")({
	component: HumanReviewRoute,
});

function HumanReviewRoute() {
	const { reviewId } = Route.useParams();
	return <HumanReviewPage reviewId={reviewId} />;
}
