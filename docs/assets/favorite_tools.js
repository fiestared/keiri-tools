import {TOOLS,FAVORITES_KEY,favoriteIDs,readJSON,writeJSON,removeStored,trackRetention,recordUse,forgetUse,favoriteEntry} from './retention.js';
const root = document.querySelector('#favorite-tools'), bar = document.querySelector('#persona-bar');
if (root && bar) {
  const r = readJSON(FAVORITES_KEY, []); let ids = favoriteIDs(r.value);
  const status = root.querySelector('[role=status]'), list = root.querySelector('#favorite-list');
  function render() {
    list.innerHTML = ids.length ? ids.map(id=>`<li><a href="/${id}/" data-favorite-link="${id}">${TOOLS[id]}</a></li>`).join('') : '<li class="hint">まだ登録していません。下から、繰り返し使う道具を選べます。</li>';
    root.querySelectorAll('[data-favorite]').forEach(b=>{const yes=ids.includes(b.dataset.favorite);b.setAttribute('aria-pressed',String(yes));b.textContent=`${yes?'登録済み・外す':'追加'}：${TOOLS[b.dataset.favorite]}`;});
  }
  const persona = () => { root.hidden = bar.querySelector('[data-p="keiri"]').getAttribute('aria-pressed') !== 'true'; };
  new MutationObserver(persona).observe(bar,{attributes:true,subtree:true,attributeFilter:['aria-pressed']});
  root.addEventListener('click', e=>{
    const b=e.target.closest('[data-favorite]'), a=e.target.closest('[data-favorite-link]');
    if(a) favoriteEntry(a.dataset.favoriteLink);
    if(b){ const id=b.dataset.favorite, adding=!ids.includes(id), next=adding?[...ids,id]:ids.filter(x=>x!==id);
      if(!writeJSON(FAVORITES_KEY,next)){status.textContent='保存できませんでした。道具は通常のリンクから使えます。';return;}
      ids=next;render();status.textContent=adding?'このブラウザの道具箱に追加しました。':'道具箱から外しました。';
      if(adding){trackRetention('retention_favorite_add','favorites',id,'add');recordUse('favorites',id,{baseline:true});}else forgetUse('favorites',id);
    }
    if(e.target.closest('#favorite-clear')){
      if(!removeStored(FAVORITES_KEY)){status.textContent='道具箱を消せませんでした。ブラウザのサイトデータ設定も確認してください。';return;}
      Object.keys(TOOLS).forEach(id=>forgetUse('favorites',id));ids=[];render();status.textContent='道具箱をすべて消しました。';trackRetention('retention_clear','favorites','home','clear');
    }
  });
  if(!r.ok)status.textContent='道具箱の保存記録を読み取れませんでした。通常のリンクは使えます。';
  render();persona();
}
