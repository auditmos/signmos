#!/usr/bin/env bash

set -euo pipefail

usage() {
	printf 'Usage: %s <dev|staging|production>\n' "$0"
	printf 'Example: %s staging\n' "$0"
}

if [[ $# -ne 1 ]]; then
	usage
	exit 1
fi

target_env="$1"
case "$target_env" in
	dev | staging | production) ;;
	*)
		printf 'Error: unknown environment "%s"\n\n' "$target_env" >&2
		usage >&2
		exit 1
		;;
esac

vars_file=".${target_env}.vars"
example_file=".example.vars"

if [[ ! -f "$vars_file" ]]; then
	printf 'Error: %s not found\n' "$vars_file" >&2
	exit 1
fi

extract_keys() {
	awk -F= '/^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=/ {
		key=$1
		gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
		print key
	}' "$1"
}

if grep -Eq '^[[:space:]]*(CLOUDFLARE_ACCOUNT_ID|CLOUDFLARE_API_TOKEN)[[:space:]]*=' "$vars_file"; then
	printf 'Error: %s contains Cloudflare account credentials. Keep those in .env or CI, not Worker secrets.\n' "$vars_file" >&2
	exit 1
fi

if [[ -f "$example_file" ]]; then
	missing_keys=0
	while IFS= read -r required_key; do
		if ! extract_keys "$vars_file" | grep -qx "$required_key"; then
			printf 'Error: %s is missing required key %s from %s\n' "$vars_file" "$required_key" "$example_file" >&2
			missing_keys=1
		fi
	done < <(extract_keys "$example_file")

	if [[ "$missing_keys" -ne 0 ]]; then
		exit 1
	fi
fi

target_label="$target_env"
if [[ "$target_env" == "dev" ]]; then
	target_label="default/dev"
fi

printf 'Syncing Worker secrets from %s to Cloudflare environment: %s\n' "$vars_file" "$target_label"
printf 'Keys:\n'
extract_keys "$vars_file" | sed 's/^/  - /'

wrangler_args=()
if [[ "$target_env" != "dev" ]]; then
	wrangler_args=(--env "$target_env")
fi

pnpm wrangler secret bulk "$vars_file" "${wrangler_args[@]}"

printf 'Done. If wrangler.jsonc bindings or required secrets changed, run: pnpm run cf-typegen\n'
