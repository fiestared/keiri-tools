#!/bin/bash
set -e
python3 review-evidence/auto20261002-t8-q08461/generator-refine.py
node tools/gen_bank_sections.mjs
node tools/gen_faq_jsonld.mjs
node tools/gen_layout_markup.mjs
node tools/gen_qa_index.mjs
node tools/segment_claims.mjs docs/column/furikomi-tesuryo-hikaku/index.html > review-evidence/auto20261002-t8-q08461/segments-after.json
python3 review-evidence/auto20261002-t8-q08461/ledger.py
node review-evidence/auto20261002-t8-q08461/finish-ledger.mjs
node tools/check_claims.mjs --changed origin/main
node tools/check_claims.mjs --segments docs/column/furikomi-tesuryo-hikaku/index.html
