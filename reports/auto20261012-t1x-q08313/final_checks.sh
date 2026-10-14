#!/bin/bash
set -u
cd /Users/masahiroyasu/Scripts/keiri-tools-astra-auto20261012-t1x-q08313
REPORT=reports/auto20261012-t1x-q08313
while [ ! -f "$REPORT/tests-full.exit" ]; do sleep 2; done
while [ ! -f "$REPORT/source-final.ready" ]; do sleep 2; done
node tests/break_zengin_layout.mjs > "$REPORT/retest-break-zengin.log" 2>&1
echo $? > "$REPORT/retest-break-zengin.exit"
node tests/test_condition_tables.mjs > "$REPORT/retest-condition-tables.log" 2>&1
echo $? > "$REPORT/retest-condition-tables.exit"
export PLAYWRIGHT_PATH=/Users/masahiroyasu/Scripts/x-bot/node_modules/playwright/index.js
node tests/test_retention_pages.mjs > "$REPORT/retest-retention.log" 2>&1
echo $? > "$REPORT/retest-retention.exit"
node tools/gen_index_sitemap.mjs > "$REPORT/generators-final.log" 2>&1
echo $? > "$REPORT/generators-final.exit"
node tests/test_generators_fresh.mjs > "$REPORT/retest-generators-fresh.log" 2>&1
echo $? > "$REPORT/retest-generators-fresh.exit"
node tools/check_claims.mjs --changed origin/main > "$REPORT/claims-final.log" 2>&1
echo $? > "$REPORT/claims-final.exit"
touch "$REPORT/final-checks.finished"
