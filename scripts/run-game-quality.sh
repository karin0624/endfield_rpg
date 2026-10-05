#!/bin/sh
set -eu

# The CI and local Docker wrapper use the same workspace and command sequence.
# Clear this scope's previous reports so failures cannot summarize an older run.
rm -rf coverage/unit coverage/browser test-results/approved-comparison
rm -f test-results/vitest*.json test-results/playwright.json test-results/playwright-discovery.json
export COVERAGE_BROWSER=1
finish() {
  quality_status=$?
  trap - EXIT
  if node scripts/report-quality.mjs "$quality_status"; then
    exit "$quality_status"
  else
    summary_status=$?
    if [ "$quality_status" -ne 0 ]; then exit "$quality_status"; fi
    exit "$summary_status"
  fi
}
trap finish EXIT
npm run check
vite build --mode debug --outDir dist-debug
vite build --config vite.views.config.ts
sh scripts/run-playwright-quality.sh browser "$@"
python3 scripts/compare-party-ui.py test-results test-results/approved-comparison --metrics-only
