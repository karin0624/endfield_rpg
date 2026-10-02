#!/bin/sh
set -eu

case "${1:-}" in
  e2e) inside_script=test:e2e:inside ;;
  ui) inside_script=test:ui:inside ;;
  editor) inside_script=test:editor:inside ;;
  *) echo "Usage: $0 {e2e|ui|editor} [Playwright options]" >&2; exit 2 ;;
esac
shift

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
set -- mcr.microsoft.com/playwright:v1.63.0-noble \
  sh -c 'npm ci && inside_script=$1 && shift && npm run "$inside_script" -- "$@"' \
  sh "$inside_script" "$@"

# The cloud host already trusts this proxy CA; Node in Docker needs it too.
environment_ca=/usr/local/share/ca-certificates/environment-proxy-ca.crt
if [ "${NODE_EXTRA_CA_CERTS:-}" = "$environment_ca" ] && [ -r "$environment_ca" ]; then
  set -- -v "$environment_ca:/run/environment-proxy-ca.crt:ro" \
    -e NODE_EXTRA_CA_CERTS=/run/environment-proxy-ca.crt "$@"
fi

docker run --rm --init --ipc=host \
  --user "$(id -u):$(id -g)" \
  -v "$repo_root:/work" -w /work "$@"
