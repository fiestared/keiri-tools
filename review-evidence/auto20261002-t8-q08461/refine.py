from pathlib import Path
p=Path('tools/gen_bank_sections.mjs');s=p.read_text();s=s.replace('publicNote: b.public_note || null,','publicNote: b.public_note || null,\n      scoped: Boolean(b.scope_note),')
s=s.replace('notes.push(`上表の宛先・対象サービス条件に限った他行宛ネット振込の3万円以上では、法人は個人の','notes.push(`${base === "みずほ銀行" ? "" : (list.some(r => r.scoped) ? "上表の宛先・対象サービス条件に限った" : "") + "他行宛ネット振込の3万円以上では、"}法人は個人の')
s=s.replace('出典の確認範囲は調査方法と出典をご参照ください。','出典欄には参照した資料の取得日、または未確認の表示を付けています。')
s=s.replace('この表に当てはめず、通帳の摘要欄や銀行の料金ページでご確認ください。','主要5行については<a href="#keiro">窓口・ATM・同じ銀行あての実額</a>を別に載せています。それでも合わない場合はこの表に当てはめず、通帳の摘要欄や銀行の料金ページでご確認ください。')
p.write_text(s)
p=Path('docs/column/furikomi-tesuryo-hikaku/index.html');s=p.read_text().replace('フィンサーバンク・ラクスルバンクを含むネット銀行系の6サービスが100〜229円に収まる一方、メガバンク・地銀は3万円以上で550〜660円と、はっきり階層が分かれています。','上表の宛先・対象サービス条件で比較した掲載ネット単価では、フィンサーバンク・ラクスルバンクを含むネット銀行系の6サービスが100〜229円、メガバンク・地銀の3万円以上が550〜660円です（未確認区分の掲載額は公式確認が必要です）。')
s=s.replace('上記の料金表は、この法人通常振込について2026年10月1日からの100円を反映しています。','上記の料金表は、提携サービスを除く法人通常振込について2026年10月1日以後の受付に適用する100円を反映しています。')
# preserve existing OC parenthesis, scope correction stays in preceding claim
s=s.replace('（税込・無料回数や会員優遇を除く。SMTB法人は2026年10月1日以後受付の通常振込で、総合振込・提携サービスを除く）','（税込・SMTB法人は2026年10月1日以後受付の通常振込で、総合振込・提携サービスを除く。無料回数などの優遇を使い切った通常料金）')
p.write_text(s)
p=Path('docs/assets/bank_presets.js');s=p.read_text().replace('if (bank.public_note) notice(bank.public_note);','if (bank.scope_note || bank.public_note) notice([bank.scope_note, bank.public_note].filter(Boolean).join("。"));');s=s.replace('差引方式を確認してください。`);','差引方式を確認してください。${[bank.scope_note, bank.public_note].filter(Boolean).join("。")}`);');p.write_text(s)
