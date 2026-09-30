import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
// Oracle: r16/t3-b fixed 算定ガイド PDF pp.27,30,39,43; 育児 pamphlet lines 367–368.
// Added primary sources for maternity exemption months and retirement are recorded in claims.
const open=p=>new JSDOM(readFileSync(`${process.env.REVIEW_DOCS_ROOT || "docs"}/${p}/index.html`,'utf8')).window.document;
const shoyo=open('column/shoyo-shakaihoken'),teiji=open('column/teiji-kettei'),zuiji=open('column/zuiji-kaitei'),hotei=open('hotei-fukuri');
const norm=s=>s.replace(/\s+/g,'');
const text=d=>norm(d.body.textContent);
const row=(d,start)=>[...d.querySelectorAll('tr')].find(r=>norm(r.cells[0]?.textContent||'')===start);
const failures=[];
function check(label,fn){try{fn();console.log('PASS '+label)}catch(e){failures.push(label);console.log('FAIL '+label+': '+e.message)}}
check('育休賞与: 1か月超でも賞与月末を含まなければ免除不可',()=>{const r=row(shoyo,'育休が1か月超');assert.match(r.cells[2].textContent,/賞与月末/);assert.match(r.cells[2].textContent,/連続.*1か月超/)});
check('産休賞与: 支給日だけでなく免除月と申出を示す',()=>{const r=row(shoyo,'産前産後休業中');assert.match(r.cells[2].textContent,/開始月.*翌日.*前月/);assert.match(r.cells[2].textContent,/申出/)});
check('定時決定: 等級が同じ場合・途中改定を除外しない',()=>{const lead=norm([...teiji.querySelectorAll('p')].find(p=>p.textContent.includes('4月〜6月')&&p.textContent.includes('残業')).textContent);assert.match(lead,/等級が上がる場合/);assert.match(lead,/随時改定/);assert.doesNotMatch(lead,/これは本当/)});
check('6月資格取得: 翌年まで等級固定としない',()=>{const a=[...teiji.querySelectorAll('.faq-answer')].find(p=>p.textContent.includes('資格取得時決定'));assert.match(a.textContent,/6月1日以降に資格取得/);assert.match(a.textContent,/随時改定.*途中/)});
check('随時改定: 比較表の短時間労働者は11日',()=>{const r=row(zuiji,'支払基礎日数');assert.match(r.cells[1].textContent,/17日以上.*短時間労働者.*11日以上/)});
check('賞与: その年限りの臨時支給を回数に含めない',()=>{const a=[...shoyo.querySelectorAll('.faq-answer')].find(p=>p.textContent.includes('年4回'));assert.match(a.textContent,/その年限り.*翌年以降未定.*回数に数えず/)});
check('令和8年3月: 支援金開始前の賞与60万円は84,450円',()=>{const fig=[...shoyo.querySelectorAll('figure')].find(f=>f.textContent.includes('資格喪失'));assert.match(text({body:fig}),/令和8年3月/);assert.match(fig.querySelector('figcaption').textContent,/84,450円/);assert.doesNotMatch(fig.textContent,/85,140円/)});
check('退職: 国保・国年1号への加入を一律化しない',()=>{const a=[...shoyo.querySelectorAll('.faq-answer')].find(p=>p.textContent.includes('資格喪失日は'));assert.match(a.textContent,/再就職先/);assert.match(a.textContent,/被扶養者.*第3号/)});
check('介護対象と給与上限',()=>{assert.doesNotMatch(text(shoyo),/40歳以上は90,000円|給与にはない上限/);assert.match(text(shoyo),/健康保険139万円・厚生年金65万円/)});
check('拠出金は全額会社負担・支援金は折半',()=>{const h=norm(hotei.getElementById('hyojun-hint').textContent);assert.match(h,/拠出金.*0.36%.*全額を会社/);assert.match(h,/支援金.*0.23%.*折半/)});
check('養育特例: FAQにも基準月と下回る対象月',()=>{const a=[...zuiji.querySelectorAll('.faq-answer')].find(p=>p.textContent.includes('養育期間の特例'));assert.match(a.textContent,/養育開始月の前月/);assert.match(a.textContent,/下回る対象月/)});
for(const d of [shoyo,teiji,zuiji,hotei])d.defaultView.close();
assert.deepEqual(failures,[],`regression failures: ${failures.join(', ')}`);
