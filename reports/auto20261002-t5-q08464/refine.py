from pathlib import Path
import re
pages=[Path('docs/furusato/index.html'),Path('docs/embed/furusato/index.html'),Path('docs/column/furusato-nozei-keisan/index.html')]
for p in pages:
 s=p.read_text().replace('対象寄附額は総所得金額等に対し所得税40％・住民税基本分30％','総所得金額等に対する所得税40％・住民税基本分30％')
 if 'column/' not in str(p):
  # Place full-width notes before the field grid, not as grid cells.
  pat=r'(  <div class="(?:grid|fee-pair) field-pair"[^>]*>\n)    (<p class="hint" id="family-eligibility">.*?</p>\n  <p class="hint" id="family-nonresident">.*?</p>)\n  <div>'
  s,n=re.subn(pat,lambda m:'  '+m[2]+'\n'+m[1]+'    <div>',s,flags=re.S)
  assert n==1,(p,n)
 if 'embed/' not in str(p):
  s=s.replace('山林・退職所得の区分では別計算となり、','課税総所得金額がないか人的控除差調整後が負で、課税山林所得または課税退職所得を有する区分は別計算となり、')
  s=s.replace('ふるさと納税の控除は、次の<b>3つの階</b>から成り立っています。','以下は2026年に寄附時点で総務大臣の指定を受けた自治体への対象寄附が年合計2,000円を超える場合の概算です。寄附によって設けられた設備の専属利用など、寄附者に特別の利益が及ぶ寄附は対象から除かれます。ふるさと納税の控除は、次の<b>3つの階</b>から成り立っています。')
  s=s.replace('「子1人（高校生）」は16〜18歳の一般扶養、「子2人（大学生＋高校生）」は19〜22歳の特定扶養＋16〜18歳の一般扶養。','「子1人」は16〜18歳の一般扶養、「子2人」は19〜22歳の特定扶養＋16〜18歳の一般扶養。2026年寄附では合計所得62万円以下で本人と生計を一にし、給与を受ける青色事業専従者・白色事業専従者を除き、他の納税者と重複算入しないことが前提です。非居住者の30〜69歳など、この表にない家族構成は表の対象外です。')
 p.write_text(s)
# Synchronize duplicate explanations, retain the column's distinct numerical reference table.
p=pages[2];s=p.read_text();main=pages[0].read_text()
for start,end in [('kekkaron','shikumi'),('shikumi','meyasu'),('onestop','gokai'),('gokai','faq')]:
 pat=rf'<h2 id="{start}">[\s\S]*?(?=<h2 id="{end}">)'
 replacement=re.search(pat,main).group()
 s,n=re.subn(pat,lambda m:replacement,s);assert n==1,start
# Exact corresponding FAQs for caps, exceedance, procedure, separate spouses.
for question in ['ふるさと納税の上限額は何で決まりますか？','上限を超えて寄附するとどうなりますか？','ワンストップ特例と確定申告のどちらが得ですか？','共働き夫婦は、2人分を合算して寄附できますか？']:
 pat=r'<h3 class="faq-question">'+re.escape(question)+r'</h3>\s*<p class="faq-answer">[\s\S]*?</p>'
 m=re.search(pat,main)
 s,n=re.subn(pat,lambda _:m.group(),s);assert n==1,question
s=s.replace('年収と家族構成を入れるだけで、<b>自己負担2,000円で収まる寄附額の上限</b>を自動計算。地方税法の<b>調整控除後の住民税所得割額の20％</b>から逆算し、復興特別所得税（×1.021）を織り込んだ正しい割合で算出します。寄附予定額を入れると「本当に2,000円で収まるか」も判定。','年収と家族構成から、<b>調整控除後の住民税所得割額の20％を逆算した寄附額の目安</b>を計算。指定自治体への対象寄附で、所得税と特例分の税率条件・各控除限度を満たすか確認が必要です。寄附予定額を入れると自己負担も概算します。')
s=s.replace('<b>15歳以下の子は上限額に影響しないため、列に含めていません</b>（扶養控除が0円のため。ただし所得の低い方は非課税の判定で効くことがあります）。','<b>15歳以下の扶養親族は扶養控除の対象外ですが、住民税の非課税判定の人数に含みます。</b>この表の列には含めていません。')
p.write_text(s)
