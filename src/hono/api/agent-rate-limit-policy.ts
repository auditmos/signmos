export const agentApiRateLimitPolicy = {
	windowSeconds: 60,
	token: { limit: 30 },
	ip: { limit: 150 },
	calibrationEvidence: "/plans/evidence/agentic-mode-release/calibration.md",
} as const;
