#!/bin/sh
set -eu

mode=${1:-}
case "$mode" in
  e2e) report=playwright; gate_mode= ;;
  coverage) report=playwright-coverage; gate_mode=coverage; export COVERAGE_BROWSER=1 ;;
  long) report=playwright-long; gate_mode=long ;;
  *) echo "Usage: $0 {e2e|coverage|long} [Playwright options]" >&2; exit 2 ;;
esac
shift

# Always collect the whole quality suite. CLI filters cannot turn a partial run into a full pass.
if [ "$mode" = long ]; then
  PLAYWRIGHT_JSON_OUTPUT_FILE="test-results/$report-discovery.json" \
    playwright test --config playwright.long.config.ts --list --reporter=json
  playwright test --config playwright.long.config.ts "$@"
else
  PLAYWRIGHT_JSON_OUTPUT_FILE="test-results/$report-discovery.json" playwright test --list --reporter=json
  playwright test "$@"
fi
node scripts/check-test-execution.mjs playwright \
  "test-results/$report-discovery.json" "test-results/$report.json" $gate_mode
