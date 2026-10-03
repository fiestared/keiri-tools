#!/bin/bash
# Rebuild the 2026-10-03 fund comparison pages, run the site generators, keep only this batch's
# outputs (other pages' pre-existing generator drift is restored), then write claim ledgers.
set -u
cd "$(dirname "$0")/../.."
python3 reports/fund-vs-20261003/build.py || exit 1
before=$(git diff --name-only | tr "\n" " ")
for g in gen_faq_jsonld gen_qa_index gen_tool_related gen_ogp gen_x_share gen_x_link gen_article_next_read gen_toc_related \
         gen_trust_footer gen_data_source_note gen_domain_bridge gen_presentation_markup gen_layout_markup gen_datemodified gen_index_sitemap gen_index_sitemap; do
  node tools/$g.mjs >/dev/null 2>&1 || echo "generator failed: $g"
done
keep="docs/assets/qa_index.json docs/column/index.html docs/index.html docs/sitemap.xml docs/toushi/index.html tools/gen_index_sitemap.mjs"
for f in $(git diff --name-only); do
  case " $keep $before " in *" $f "*) ;; *) git checkout -q -- "$f";; esac
done
python3 reports/fund-vs-20261003/build.py --ledger
