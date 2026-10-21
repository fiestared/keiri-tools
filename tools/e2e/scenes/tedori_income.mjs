export const scenes=[{name:'tedori_income',expect:s=>s.annual==='年額3,942,183円'&&s.monthly==='平均月額328,515円'&&s.tax==='89,800円'&&s.rows===4&&s.prints===1&&s.summaryRows===13&&s.links&&s.nextGross&&s.modelLink&&s.reverseLink&&s.adjustment&&s.overflow===0}];
export const harness=H=>({async tedori_income(){
 let doc=await H.open('/docs/tedori/nenshu/500/');
 const result={annual:H.text(doc,'income-annual'),monthly:H.text(doc,'income-monthly'),tax:doc.querySelector('[data-part="tax"] td').textContent,rows:doc.querySelectorAll('#income-comparison tbody tr').length,links:!!doc.querySelector('a[href="/tedori/nenshu/450/"]')&&!!doc.querySelector('a[href="/tedori/nenshu/600/"]')};
 result.nextGross=doc.querySelector('#income-observation-2').textContent.includes('5,260,000円');
 result.modelLink=!!doc.querySelector('#income-conditions a[href="/nenshu/"]');
 let prints=0;doc.defaultView.print=()=>prints++;H.click(doc,'income-print');result.prints=prints;
 for(const width of [1280,390]){document.getElementById('f').style.width=width+'px';await H.sleep(100);result.overflow=Math.max(result.overflow||0,doc.documentElement.scrollWidth-doc.documentElement.clientWidth);}
 doc=await H.open('/docs/tedori/nenshu/');result.summaryRows=doc.querySelectorAll('#income-summary tbody tr').length;
 doc=await H.open('/docs/nenshu/');result.reverseLink=!!doc.querySelector('#annual-income-guide a[href="/tedori/nenshu/"]');
 doc=await H.open('/docs/tedori/nenshu/450/');result.adjustment=doc.querySelector('#income-observation-1').textContent.includes('2,060,000円')&&doc.querySelector('#income-observation-2').textContent.includes('1,730,000円');
 return result;
}});
