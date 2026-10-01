#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if kill -0 28263 2>/dev/null; then echo 'Full test runner is still active'; exit 1; fi
python3 review/r16-t12-a/restore-table-meta.py
python3 review/r16-t12-a/fix-svg-layout.py
git add docs/fudosan-shutoku/index.html docs/jidoshazei/index.html docs/column/fudosan-shutokuzei-shiwake/index.html docs/column/shunyu-inshi-warihan/index.html docs/column/toroku-menkyozei-nofu/index.html tests/test_jidoshazei_article.mjs
git commit -m 'fix: retain tax table description and fit corrected SVG label'
: > review/r16-t12-a/generators-last.log
for script in gen_toc_related gen_tool_related gen_datemodified gen_index_sitemap gen_trust_footer gen_data_source_note gen_domain_bridge gen_qa_index; do
 node "tools/$script.mjs" >> review/r16-t12-a/generators-last.log 2>&1
done
if ! git diff --quiet -- docs; then
 git add docs
 git commit -m 'chore: refresh generated metadata after layout correction'
fi
node review/r16-t12-a/audit-ok.mjs > review/r16-t12-a/audit-ok.log
node review/r16-t12-a/audit-preservation.mjs > review/r16-t12-a/preservation.log
node review/r16-t12-a/build-ledgers.mjs > review/r16-t12-a/ledger-build.log
node review/r16-t12-a/finish-ledgers.mjs >> review/r16-t12-a/ledger-build.log
node tools/check_claims.mjs --changed origin/main > review/r16-t12-a/claims-changed.log 2>&1
node review/r16-t12-a/coverage.mjs after > review/r16-t12-a/coverage-after-summary.log
python3 review/r16-t12-a/report-metrics.py > review/r16-t12-a/metrics.txt
bash review/r16-t12-a/validate-fixes.sh > review/r16-t12-a/final-validation.log 2>&1
