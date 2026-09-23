#!/bin/sh
set -eu

case "${1:-}" in
  e2e) inside_script=test:e2e:inside ;;
  editor) inside_script=test:editor:inside ;;
  *) echo "Usage: $0 {e2e|editor} [Playwright options]" >&2; exit 2 ;;
esac
shift

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
docker run --rm --init --ipc=host \
  --user "$(id -u):$(id -g)" \
  -v "$repo_root:/work" -w /work \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  sh -c 'npm ci && inside_script=$1 && shift && npm run "$inside_script" -- "$@"' \
  sh "$inside_script" "$@"
