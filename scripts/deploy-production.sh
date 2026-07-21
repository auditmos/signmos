#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

usage() {
	printf 'Usage: %s <--dry-run|--deploy>\n' "$0"
	printf '  --dry-run  Build the production environment and validate the generated deploy.\n'
	printf '  --deploy   Validate and publish the exact clean Git commit to https://signmos.com.\n'
}

if [[ $# -ne 1 ]]; then
	usage >&2
	exit 64
fi

mode="$1"
case "$mode" in
	--dry-run | --deploy) ;;
	--help | -h)
		usage
		exit 0
		;;
	*)
		usage >&2
		exit 64
		;;
esac

if [[ "$mode" == "--deploy" ]] && [[ -n "$(git status --porcelain --untracked-files=all)" ]]; then
	printf 'Error: Production deploy requires a clean working tree tied to one exact commit.\n' >&2
	exit 1
fi

candidate_sha="$(git rev-parse HEAD)"
production_origin="https://signmos.com"
production_vars_file="${SIGNMOS_PRODUCTION_VARS_FILE:-.production.vars}"
required_production_keys=(
	CLOUDFLARE_ENV
	DATABASE_HOST
	DATABASE_USERNAME
	DATABASE_PASSWORD
	APP_BASE_URL
	RESEND_API_KEY
	RESEND_FROM_EMAIL
	RESEND_REPLY_TO_EMAIL
	TURNSTILE_SITE_KEY
	TURNSTILE_SECRET_KEY
)
production_build_vars_file=".dev.vars.production"

read_var() {
	local key="$1"
	local value
	value="$(
		awk -v expected="$key" '
			{
				line = $0
				sub(/^[[:space:]]*/, "", line)
				candidate = line
				sub(/[[:space:]]*=.*/, "", candidate)
				if (candidate == expected) {
					sub(/^[^=]*=/, "", line)
					gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
					print line
					exit
				}
			}
		' "$production_vars_file"
	)"

	case "$value" in
		\"*\") value="${value:1:${#value}-2}" ;;
		\'*\') value="${value:1:${#value}-2}" ;;
	esac
	printf '%s' "$value"
}

validate_production_vars() {
	if [[ ! -f "$production_vars_file" ]]; then
		printf 'Error: production variables file %s was not found.\n' "$production_vars_file" >&2
		exit 1
	fi

	if rg -q '^[[:space:]]*(CLOUDFLARE_ACCOUNT_ID|CLOUDFLARE_API_TOKEN)[[:space:]]*=' "$production_vars_file"; then
		printf 'Error: keep Cloudflare account credentials outside %s.\n' "$production_vars_file" >&2
		exit 1
	fi

	local key
	local value
	for key in "${required_production_keys[@]}"; do
		value="$(read_var "$key")"
		if [[ -z "$value" ]]; then
			printf 'Error: %s is missing or empty in %s.\n' "$key" "$production_vars_file" >&2
			exit 1
		fi
	done

	if [[ "$(read_var CLOUDFLARE_ENV)" != "production" ]]; then
		printf 'Error: CLOUDFLARE_ENV must be production in %s.\n' "$production_vars_file" >&2
		exit 1
	fi
	if [[ "$(read_var APP_BASE_URL)" != "$production_origin" ]]; then
		printf 'Error: APP_BASE_URL must be %s in %s.\n' "$production_origin" "$production_vars_file" >&2
		exit 1
	fi
}

cleanup_production_build_vars() {
	rm -f "$production_build_vars_file"
}

prepare_production_build_vars() {
	if [[ -e "$production_build_vars_file" ]]; then
		printf 'Error: remove %s; production builds create an isolated placeholder file.\n' "$production_build_vars_file" >&2
		exit 1
	fi

	umask 077
	local key
	for key in "${required_production_keys[@]}"; do
		case "$key" in
			CLOUDFLARE_ENV) printf '%s="production"\n' "$key" >>"$production_build_vars_file" ;;
			APP_BASE_URL) printf '%s="%s"\n' "$key" "$production_origin" >>"$production_build_vars_file" ;;
			*) printf '%s="build-only-placeholder"\n' "$key" >>"$production_build_vars_file" ;;
		esac
	done
}

# The Vite plugin selects and flattens the named environment at build time.
# Wrangler must not try to select that environment again from the generated file.
unset CLOUDFLARE_ENV

if [[ "$mode" == "--deploy" ]]; then
	validate_production_vars
	printf 'Checking Cloudflare authentication and production R2 binding\n'
	pnpm exec wrangler whoami >/dev/null
	pnpm exec wrangler r2 bucket info signmos-documents-production >/dev/null
fi

printf 'Building Signmos production candidate %s for %s\n' "$candidate_sha" "$production_origin"
prepare_production_build_vars
trap cleanup_production_build_vars EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
CLOUDFLARE_ENV=production pnpm build
cleanup_production_build_vars
trap - EXIT HUP INT TERM
rm -f dist/server/.dev.vars

printf 'Validating generated production deployment with Wrangler\n'
pnpm exec wrangler deploy --config dist/server/wrangler.json --dry-run

if [[ "$mode" == "--dry-run" ]]; then
	printf 'Production deploy dry run passed for %s; no remote state changed.\n' "$candidate_sha"
	exit 0
fi

printf 'Publishing production candidate %s with validated Worker secrets\n' "$candidate_sha"
pnpm exec wrangler deploy \
	--config dist/server/wrangler.json \
	--secrets-file "$production_vars_file" \
	--yes \
	--message "git:$candidate_sha"

printf 'Checking public production endpoints\n'
for url in \
	"$production_origin/" \
	"$production_origin/agent.md" \
	"$production_origin/openapi.json"; do
	curl \
		--fail \
		--silent \
		--show-error \
		--location \
		--retry 3 \
		--retry-all-errors \
		--max-time 30 \
		--output /dev/null \
		"$url"
done

printf 'Deployed candidate %s to %s\n' "$candidate_sha" "$production_origin"
printf 'Rollback if required: pnpm exec wrangler rollback --config wrangler.jsonc --env production\n'
