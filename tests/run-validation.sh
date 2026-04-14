#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# ENAZIZI — Full Validation Suite Runner
# Usage: bash tests/run-validation.sh
# ─────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPORTS_DIR="$SCRIPT_DIR/reports"

# Load env if present
if [ -f "$SCRIPT_DIR/config/.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/config/.env" | xargs)
fi

echo "══════════════════════════════════════════"
echo "  ENAZIZI Validation Suite"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════"
echo ""

mkdir -p "$REPORTS_DIR"

LOAD_OK=true
E2E_OK=true

# ─── Step 1: K6 Load Test ───
echo "📦 [1/3] Running k6 load test..."
if command -v k6 &>/dev/null; then
  k6 run "$SCRIPT_DIR/load/k6-load-test.js" \
    --summary-export="$REPORTS_DIR/k6-summary.json" \
    --out json="$REPORTS_DIR/k6-raw.json" \
    2>&1 | tee "$REPORTS_DIR/k6-output.log" || LOAD_OK=false
  echo ""
  echo "  ✅ k6 complete"
else
  echo "  ⚠️  k6 not installed. Skipping load tests."
  echo "  Install: https://k6.io/docs/get-started/installation/"
  LOAD_OK=false
fi
echo ""

# ─── Step 2: Playwright E2E ───
echo "🎭 [2/3] Running Playwright E2E tests..."
if npx playwright --version &>/dev/null 2>&1; then
  npx playwright test "$SCRIPT_DIR/e2e/" \
    --reporter=json \
    --output="$REPORTS_DIR/pw-traces" \
    > "$REPORTS_DIR/playwright-results.json" 2>&1 || E2E_OK=false
  echo "  ✅ Playwright complete"
else
  echo "  ⚠️  Playwright not installed. Skipping E2E tests."
  echo "  Install: npx playwright install"
  E2E_OK=false
fi
echo ""

# ─── Step 3: Generate Report ───
echo "📊 [3/3] Generating consolidated report..."
node "$SCRIPT_DIR/reports/generate-report.js"
echo ""

# ─── Final Summary ───
echo "══════════════════════════════════════════"
echo "  Results"
echo "══════════════════════════════════════════"
echo "  Load test:  $([ "$LOAD_OK" = true ] && echo '✅ Passed' || echo '⚠️ Issues')"
echo "  E2E tests:  $([ "$E2E_OK" = true ] && echo '✅ Passed' || echo '⚠️ Issues')"
echo "  Report:     $REPORTS_DIR/test-report.md"
echo "══════════════════════════════════════════"
