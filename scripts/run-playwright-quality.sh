#!/bin/sh
set -eu

mode=${1:-}
case "$mode" in
  browser) report=playwright; config=playwright.config.ts ;;
  all) report=playwright; config=playwright.all.config.ts ;;
  editor) report=playwright-editor; config=playwright.editor.config.ts ;;
  *) echo "Usage: $0 {browser|all|editor} [Playwright options]" >&2; exit 2 ;;
esac
shift
export COVERAGE_BROWSER=1

# Reports must come from this invocation, even if CLI options replace configured reporters.
rm -f "test-results/$report-discovery.json" "test-results/$report.json"
# Discovery is unfiltered. A partial/list-only run cannot claim completion of this scope.
PLAYWRIGHT_JSON_OUTPUT_FILE="test-results/$report-discovery.json" \
  playwright test --config "$config" --list --reporter=json
playwright test --config "$config" "$@"
if [ ! -s "test-results/$report.json" ]; then
  echo "Playwright did not generate this run's result JSON: test-results/$report.json" >&2
  exit 1
fi
node scripts/check-test-execution.mjs playwright \
  "test-results/$report-discovery.json" "test-results/$report.json" "$mode"
