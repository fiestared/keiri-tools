export const scenes=[{name:'tedori_income',expect:s=>s.annual==='年額3,942,183円'&&s.monthly==='平均月額328,515円'&&s.tax==='89,800円'&&s.rows===4&&s.prints===1&&s.summaryRows===13&&s.links&&s.overflow===0}];
export const harness=H=>({async tedori_income(){
 let doc=await H.open('/docs/tedori/nenshu/500/');
 const result={annual:H.text(doc,'income-annual'),monthly:H.text(doc,'income-monthly'),tax:doc.querySelector('[data-part="tax"] td').textContent,rows:doc.querySelectorAll('#income-comparison tbody tr').length,links:!!doc.querySelector('a[href="/tedori/nenshu/450/"]')&&!!doc.querySelector('a[href="/tedori/nenshu/600/"]')};
 let prints=0;doc.defaultView.print=()=>prints++;H.click(doc,'income-print');result.prints=prints;
 for(const width of [1280,390]){document.getElementById('f').style.width=width+'px';await H.sleep(100);result.overflow=Math.max(result.overflow||0,doc.documentElement.scrollWidth-doc.documentElement.clientWidth);}
 doc=await H.open('/docs/tedori/nenshu/');result.summaryRows=doc.querySelectorAll('#income-summary tbody tr').length;
 return result;
}});
