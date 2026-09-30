from pathlib import Path
import json
p=Path('docs/assets/iryohi_core.js');s=p.read_text()
s=s.replace('kyuyoShotoku, kyuyoShotokuR8','kyuyoShotoku, kyuyoShotokuR8, shotokuzeiKisoKojo')
s=s.replace("  const taisho = hotenTaisho != null && hotenTaisho !== '' ? yen(hotenTaisho) : hi;", """  if (yen(hoten) > 0 && (hotenTaisho == null || hotenTaisho === '' || !Number.isFinite(Number(hotenTaisho)) || Number(hotenTaisho) < 0)) {
    throw new Error('補填金がある場合は、その給付の対象医療費を入力してください');
  }
  const taisho = hotenTaisho != null && hotenTaisho !== '' ? yen(hotenTaisho) : 0;""")
s=s.replace('v < b.kazei_upto','v <= b.kazei_upto')
s=s.replace('  const rate = i.shotokuzeiRate;',"""  // 給与所得のみのR8換算で基礎控除だけでも非課税なら、選択税率で還付を作らない。
  const noIncomeTax = !hasSoto && i.zeisei === 'r8' && sotoShotoku <= shotokuzeiKisoKojo(sotoShotoku, D, 'r8');
  const rate = noIncomeTax && isValidRate(i.shotokuzeiRate, I) ? 0 : i.shotokuzeiRate;""")
s=s.replace('省略時は医療費全体から引く（＝多めに引く・控除額を小さめに出す保守側）。','補填金がある場合の対象医療費の省略はエラーとする。')
s=s.replace('（省略時は医療費全体を対象＝補填を全体から引く保守側）','（補填金がある場合は必須）')
s=s.replace('ひも付き医療費が不明なら医療費全体を限度とする。','ひも付き医療費が不明なら計算を止める。')
s=s.replace('（任意）補填金がひも付く医療費','（補填金がある場合必須）補填金がひも付く医療費')
s=s.replace('給与収入およそ297万円以下','令和8年分の給与所得のみなら給与収入2,972,000円未満')
p.write_text(s)
p=Path('docs/assets/iryohi_r08.json');d=json.loads(p.read_text());d['keigen']['shotokuzei_brackets'][0]['kazei_upto']=0
ns={};exec(Path('reports/r16-t14-a/edit.py').read_text().split("if __name__=='__main__':")[0],ns)
for b in d['keigen']['shotokuzei_brackets']:
 for old,new in ns['bands']:b['label']=b['label'].replace(old,new)
d['keigen']['_brackets_note']='所得税法89条1項の以下／超えるに合わせた税率区分。控除全額が同率で効く場合の概算用であり、税額そのものは区分ごとに累進計算する。'
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
