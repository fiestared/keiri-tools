#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/../.."
export PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js
failed=0
files=(
 tests/test_generators_fresh.mjs
 tests/test_qa.mjs
 tests/test_toc_related.mjs
 tests/test_tool_related.mjs
 tests/test_fudosan_shutoku.mjs
 tests/break_fudosan_shutoku.mjs
 tests/test_jidoshazei_article.mjs
 tests/test_jidoshazei_static_table.mjs
 tests/break_jidoshazei_static_table.mjs
 tests/test_toroku_jutaku.mjs
 tests/break_toroku_jutaku.mjs
 tests/test_toroku_page.mjs
 tests/break_toroku_page.mjs
 tests/test_year_staleness.mjs
 tests/break_izoku_page.mjs
 tests/test_boundary_cases.mjs
 tests/test_condition_tables.mjs
 tests/test_stale_values.mjs
 tests/test_check_claims.mjs
 tests/test_segment_claims.mjs
)
for f in "${files[@]}"; do
 log="review/r16-t12-a/final-$(basename "$f" .mjs).log"
 if node "$f" > "$log" 2>&1; then echo "GREEN $f"; else echo "RED $f"; tail -12 "$log"; failed=1; fi
done
if node review/r16-t12-a/ui-check.mjs > review/r16-t12-a/ui-check.log 2>&1; then echo 'GREEN real UI'; else echo 'RED real UI'; tail -15 review/r16-t12-a/ui-check.log; failed=1; fi
if WIRING_ONLY=toroku-menkyozei WIRING_STRICT=1 node tools/check_input_wiring.mjs > review/r16-t12-a/final-wiring-toroku.log 2>&1; then echo 'GREEN toroku input wiring'; else echo 'RED toroku input wiring'; tail -15 review/r16-t12-a/final-wiring-toroku.log; failed=1; fi
exit "$failed"
