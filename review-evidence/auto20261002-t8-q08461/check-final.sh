#!/bin/bash
set -e
node tests/test_fee_article.mjs > review-evidence/auto20261002-t8-q08461/test_fee_article.log 2>&1
node tests/test_furikomi_amount_index.mjs > review-evidence/auto20261002-t8-q08461/test_furikomi_amount_index.log 2>&1
node tests/test_furikomi_bank_sections.mjs > review-evidence/auto20261002-t8-q08461/test_furikomi_bank_sections.log 2>&1
node tests/test_pv_workflows.mjs > review-evidence/auto20261002-t8-q08461/test_pv_workflows.log 2>&1
node tests/test_faq_visible.mjs > review-evidence/auto20261002-t8-q08461/test_faq_visible.log 2>&1
node tests/test_generators_fresh.mjs > review-evidence/auto20261002-t8-q08461/test_generators_fresh.log 2>&1
node tools/check_claims.mjs --changed origin/main > review-evidence/auto20261002-t8-q08461/claims-changed.log 2>&1
node tools/check_claims.mjs --segments docs/column/furikomi-tesuryo-hikaku/index.html > review-evidence/auto20261002-t8-q08461/segments-after.log 2>&1
node review-evidence/auto20261002-t8-q08461/final-audit.mjs > review-evidence/auto20261002-t8-q08461/final-audit.log 2>&1
node tests/test_hojokin_sources.mjs > review-evidence/auto20261002-t8-q08461/test_hojokin_sources.log 2>&1
