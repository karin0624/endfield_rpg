#!/bin/sh
set -eu

case "${1:-}" in
  browser) inside_script=test:browser:inside ;;
  editor) inside_script=test:editor:inside ;;
  all) inside_script=test:all:inside ;;
  *) echo "Usage: $0 {browser|editor|all} [Playwright options]" >&2; exit 2 ;;
esac
shift

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
container_user="$(id -u):$(id -g)"
if [ "$inside_script" = test:browser:inside ]; then
  # The approved-image diagnostic runs in the same fixed container as CI.
  # Install its existing system dependency, then run checks as the workspace owner.
  set -- mcr.microsoft.com/playwright:v1.63.0-noble \
    sh -c 'apt-get update && apt-get install -y --no-install-recommends python3-pil && \
      run_uid=$1 && run_gid=$2 && shift 2 && \
      exec setpriv --reuid "$run_uid" --regid "$run_gid" --clear-groups \
        sh -c '\''npm ci && inside_script=$1 && shift && npm run "$inside_script" -- "$@"'\'' sh "$@"' \
    sh "$(id -u)" "$(id -g)" "$inside_script" "$@"
  container_user=0:0
else
  set -- mcr.microsoft.com/playwright:v1.63.0-noble \
    sh -c 'npm ci && inside_script=$1 && shift && npm run "$inside_script" -- "$@"' \
    sh "$inside_script" "$@"
fi

# The cloud host already trusts this proxy CA; Node in Docker needs it too.
environment_ca=/usr/local/share/ca-certificates/environment-proxy-ca.crt
if [ "${NODE_EXTRA_CA_CERTS:-}" = "$environment_ca" ] && [ -r "$environment_ca" ]; then
  set -- -v "$environment_ca:/run/environment-proxy-ca.crt:ro" \
    -e NODE_EXTRA_CA_CERTS=/run/environment-proxy-ca.crt "$@"
fi

docker run --rm --init --ipc=host \
  --user "$container_user" \
  -v "$repo_root:/work" -w /work "$@"
