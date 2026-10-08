/**
 * 「左だけ太い色線のカード」（left accent border card）を computed style で拾う。page.evaluate に渡す自己完結の関数。
 *
 * 方針の正本: gbrain design/ui-no-left-accent-border-cards（2026-08-26 の恒久方針）。
 *   例外は「ユーザーが明示的に指定したもの」と「タイムライン軸など情報構造上の意味を持つ線」だけ。
 *   ★例外をここで勝手に増やさないこと。増やすなら方針のページを先に直す。
 *
 * 判定: 見えている要素で、border-left が実線・2px 以上・他の3辺のどれよりも太く、色に彩度がある（灰色ではない）。
 *   - 引用（blockquote）の灰色の線は「灰色」なので元から当たらない。色が付いても blockquote は引用の印として除く。
 *   - 表のセル区切り（td/th）は情報構造上の線なので除く。
 *   2026-10-08: .rail-next（あわせて読む）が 1px の四辺の指定を後段で border-left: 4px accent に上書きされていたのを、
 *   宣言（CSS の文字列）ではなく computed で見るのはこのため（上書きはファイルを読んでも気づきにくい）。
 */
export function measureLeftAccent() {
 const issues=[];
 const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
 const colored=c=>{const [r,g,b,a=1]=rgb(c);if(a<.3)return false;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return mx>0&&(mx-mn)/mx>.15;};
 for(const e of document.body.querySelectorAll('*')){
  if(e.closest('blockquote')||/^(TD|TH|TR|TABLE|TBODY|THEAD|COL|COLGROUP)$/.test(e.tagName))continue;
  const cs=getComputedStyle(e);
  if(cs.borderLeftStyle==='none'||cs.borderLeftStyle==='hidden')continue;
  const l=parseFloat(cs.borderLeftWidth);if(!(l>=2))continue;
  const others=Math.max(parseFloat(cs.borderTopWidth)||0,parseFloat(cs.borderRightWidth)||0,parseFloat(cs.borderBottomWidth)||0);
  if(l<=others+.5||!colored(cs.borderLeftColor))continue;
  if(!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))continue;
  const r=e.getBoundingClientRect();if(r.width<40||r.height<10)continue;
  issues.push({kind:'left-accent-border',tag:e.tagName,cls:String(e.className||'').slice(0,60),text:e.textContent.trim().slice(0,60),left:l,others,color:cs.borderLeftColor});
 }
 return issues;
}
