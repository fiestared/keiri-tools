from pathlib import Path
import json
E=Path('review-evidence/auto20261010-t8-q08351')
pages=['docs/senpou-futan/index.html','docs/column/senpou-futan-3hoshiki/index.html','docs/column/kumimodoshi/index.html']
notes={
 '三菱UFJ銀行（個人IB）':'個人の三菱UFJダイレクトの他行宛。三菱UFJ信託・auじぶん銀行宛とメインバンク プラスの無料優遇を除く',
 '三菱UFJ銀行（法人・BizSTATION）':'他行宛の通常料金',
 '三井住友銀行（法人・Web21エキスパート等）':'他行宛の一般振込。給与・賞与振込とWeb21ライトは別料金',
 '千葉銀行（個人IB）':'個人マイアクセスの他行宛。同一店内・当行本支店宛は無料',
 'りそな銀行（個人IB）':'個人マイゲートのスタンダード・パールの他行宛。りそな・埼玉りそな・関西みらい・みなと銀行宛を除く',
 'ゆうちょ銀行':'個人ゆうちょダイレクトの他金融機関宛・居住者による送金。非居住者による送金は1回3,000円、他行の非居住者宛は所定窓口のみ',
 'ゆうちょダイレクト':'他金融機関宛・居住者による送金',
}
for page in pages:
 p=Path(page);s=p.read_text();(E/(page.split('/')[-2]+'-before.html')).write_text(s)
 if 'kumimodoshi' not in page:
  for n,note in notes.items():s=s.replace('<td>'+n+'</td>','<td>'+n+'<span class="cell-note">'+note+'</span></td>')
 else:
  s=s.replace('個人のインターネットバンキングで他行あてに3万円未満を振り込んで間違えると','個人の三菱UFJダイレクトで他行あて（三菱UFJ信託銀行・auじぶん銀行あてとメインバンク プラスの無料優遇を除く）に3万円未満を振り込んで間違えると')
  s=s.replace('<p>三菱UFJ銀行・個人のインターネットバンキングで、他行あてに3万円未満を振り込んだ場合の実額で数えます。</p>','<p data-review-context="before-table">三菱UFJ銀行・個人の三菱UFJダイレクトで、他行あて（三菱UFJ信託銀行・auじぶん銀行あてとメインバンク プラスの無料優遇を除く）に3万円未満を振り込んだ場合の実額で数えます。</p>')
  s=s.replace('三菱UFJ銀行・個人のインターネットバンキングで他行あて3万円未満を振り込んだ場合の実額。','三菱UFJ銀行・個人の三菱UFJダイレクトで他行あて（三菱UFJ信託銀行・auじぶん銀行あてとメインバンク プラスの無料優遇を除く）3万円未満を振り込んだ場合の実額。')
 p.write_text(s)
