#!/bin/sh
set -eu

case "${1:-}" in
  browser) inside_script=test:browser:inside ;;
  editor) inside_script=test:editor:inside ;;
  all) inside_script=test:all:inside ;;
  storybook) inside_script=test:storybook:inside ;;
  *) echo "Usage: $0 {browser|editor|all|storybook} [Playwright options]" >&2; exit 2 ;;
esac
shift

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
container_user="$(id -u):$(id -g)"
browser_image=$(node --input-type=module -e 'import { DESIGN_IMAGE } from "./scripts/design-environment.mjs"; console.log(DESIGN_IMAGE)')
set -- "$browser_image" \
  sh -c 'npm ci && inside_script=$1 && shift && npm run "$inside_script" -- "$@"' \
  sh "$inside_script" "$@"

# The cloud host already trusts this proxy CA; Node in Docker needs it too.
environment_ca=/usr/local/share/ca-certificates/environment-proxy-ca.crt
if [ "${NODE_EXTRA_CA_CERTS:-}" = "$environment_ca" ] && [ -r "$environment_ca" ]; then
  set -- -v "$environment_ca:/run/environment-proxy-ca.crt:ro" \
    -e NODE_EXTRA_CA_CERTS=/run/environment-proxy-ca.crt "$@"
fi

docker run --rm --init --ipc=host \
  --user "$container_user" \
  -v "$repo_root:/work" -w /work "$@"
