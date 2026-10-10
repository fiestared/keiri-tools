#!/bin/bash
set -euo pipefail
cd /Users/masahiroyasu/Scripts/keiri-tools-astra-auto20261008-t3x-q08381
python3 review-evidence/auto20261008-t3x-q08381/card-scope.py
node review-evidence/auto20261008-t3x-q08381/teiji-scope.mjs
node review-evidence/auto20261008-t3x-q08381/grounding.mjs
git add docs/column/yakuin-shakai-hoken/index.html claims/column/yakuin-shakai-hoken.json docs/column/hyojun-hoshu-gakuhyo/index.html claims/column/hyojun-hoshu-gakuhyo.json
git commit -m '適用条件の追加説明と一覧カードの根拠を補完'
for name in gen_datemodified gen_trust_footer gen_data_source_note gen_domain_bridge gen_index_sitemap gen_faq_jsonld gen_layout_markup gen_presentation_markup gen_qa_index; do
  node "tools/${name}.mjs"
done
node review-evidence/auto20261008-t3x-q08381/refresh-share.mjs
node tools/check_claims.mjs --changed origin/main > review-evidence/auto20261008-t3x-q08381/check-claims-final.log 2>&1
node tools/check_claims.mjs --segments docs/column/hyojun-hoshu-gakuhyo/index.html docs/column/kyushoku-shakai-hokenryo/index.html > review-evidence/auto20261008-t3x-q08381/segments-check.log 2>&1
node tests/test_generators_fresh.mjs > review-evidence/auto20261008-t3x-q08381/generators-final.log 2>&1
node review-evidence/auto20261008-t3x-q08381/final-audit.mjs
