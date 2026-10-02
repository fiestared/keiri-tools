from pathlib import Path
p=Path('tools/segment_claims.mjs');s=p.read_text();anchor='const excluded = '
func='''// Opt-in context for labels that cannot be adjudicated independently. Keep the
// visible answer/data units too; a change to either also invalidates this unit.
function reviewContextText(el) {
  const mode = el.getAttribute('data-review-context');
  if (!mode) return null;
  if (mode === 'next' && /^h[2-6]$/.test(el.localName)) {
    const answer = el.nextElementSibling;
    if (!answer?.matches('p.faq-answer')) throw Error('data-review-context=next requires an adjacent FAQ answer');
    return `【質問】${cellText(el)} 【回答】${cellText(answer)}`;
  }
  if (mode === 'row' && /^t[dh]$/.test(el.localName)) {
    const cells = [...el.parentElement.children].filter(c => /^t[dh]$/.test(c.localName));
    if (cells[0] !== el || cells.length < 2) throw Error('data-review-context=row requires a row label and data cells');
    return `【行】${cellText(el)} / ` + cells.slice(1).map(c => {
      const context = tableContext(c);
      return `【列】${context.col} 【値】${cellText(c)}`;
    }).join(' / ');
  }
  throw Error('Invalid data-review-context: ' + mode);
}
'''
assert anchor in s;s=s.replace(anchor,func+anchor)
s=s.replace("const kind = tag === 'meta'", "const reviewContext = reviewContextText(el);\n    if (reviewContext) text = reviewContext;\n    const kind = tag === 'meta'")
s=s.replace("(zone === 'summary' || (zone === 'faq'", "(!!reviewContext || zone === 'summary' || (zone === 'faq'")
s=s.replace("includes(tag) && !context ?", "includes(tag) && !context && !reviewContext ?")
p.write_text(s)
p=Path('docs/column/shogaku-genka-shokyaku/index.html');h=p.read_text()
for text in ['1年目の損金','2年目の損金','3年目の損金','3年間の損金 計','3年間の節税額（30%）','<b>償却資産税 3年 計','3年間の手残り']:
 a='<td>'+text;assert h.count(a)==1,a;h=h.replace(a,'<td data-review-context="row">'+text)
for q in ['10万円未満のものは、必ず「消耗品費」で処理しないといけませんか？','一括償却資産を3年の途中で捨てたら、残りは経費にできますか？','年間300万円の枠は、事業年度が1年未満でも300万円ですか？','償却資産税の申告は、いつまでにどこへ出すのですか？']:
 a='<h3 class="faq-question"><span class="faq-existing-marker" aria-hidden="true">Q. </span>'+q;assert a in h;h=h.replace(a,a.replace('class="faq-question"','class="faq-question" data-review-context="next"'))
p.write_text(h)
