/** Retention v1: only enumerated feature/tool/action values leave the browser. */
export const TOOLS = Object.freeze({
  'shiharai-site': '支払サイト・支払日', eigyobi: '営業日・期限',
  'gensen-choshu': '源泉徴収税額', yukyu: '有給休暇の付与日数',
});
export const USAGE_KEY = 'keiri_retention_usage_v1';
export const FAVORITES_KEY = 'keiri_favorites_v1';
const FEATURES = ['conditions', 'monthly', 'favorites', 'bookmark', 'calendar'];
const EVENTS = ['retention_save', 'retention_restore', 'retention_reuse', 'retention_check',
  'retention_favorite_add', 'retention_open', 'retention_use', 'retention_clear', 'retention_bookmark_hint', 'retention_ics_export'];
export function todayJst(now = new Date()) { return now.toLocaleDateString('sv-SE', {timeZone: 'Asia/Tokyo'}); }
export function readJSON(key, fallback) {
  try { const raw = window.localStorage.getItem(key); return {ok: true, value: raw === null ? fallback : JSON.parse(raw)}; }
  catch { return {ok: false, value: fallback}; }
}
export function writeJSON(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function removeStored(key) {
  try { window.localStorage.removeItem(key); return true; } catch { return false; }
}
export function trackRetention(name, feature, tool, action = 'use') {
  if (!EVENTS.includes(name) || !FEATURES.includes(feature)
      || !(Object.hasOwn(TOOLS, tool) || tool === 'keiri-nenkan-schedule' || tool === 'home')
      || !['use', 'check', 'uncheck', 'add', 'remove', 'clear', 'restore', 'save', 'open', 'calculate'].includes(action)) return;
  try { window.gtag?.('event', name, {feature, tool, action, retention_version: '1'}); } catch { /* no effect on work */ }
}
/** A daily flag is separate from existing condition schemas. No values/labels/dates go to GA4. */
export function recordUse(feature, tool, {baseline = false, day = todayJst()} = {}) {
  if (!FEATURES.includes(feature) || !(tool in TOOLS || tool === 'keiri-nenkan-schedule')) return;
  const r = readJSON(USAGE_KEY, {});
  const data = r.value && typeof r.value === 'object' && !Array.isArray(r.value) ? r.value : {};
  const key = `${feature}:${tool}`, previous = data[key];
  data[key] = day;
  if (writeJSON(USAGE_KEY, data) && !baseline && /^\d{4}-\d{2}-\d{2}$/.test(previous || '') && previous < day)
    trackRetention('retention_reuse', feature, tool);
}
export function forgetUse(feature, tool) {
  const r = readJSON(USAGE_KEY, {});
  if (!r.ok || !r.value || typeof r.value !== 'object') return;
  delete r.value[`${feature}:${tool}`];
  if (Object.keys(r.value).length) writeJSON(USAGE_KEY, r.value); else removeStored(USAGE_KEY);
}
export function favoriteIDs(value) { return Array.isArray(value) ? [...new Set(value.filter(id => Object.hasOwn(TOOLS, id)))]: []; }
export function favoriteEntry(tool) {
  try { window.sessionStorage.setItem('keiri_favorite_entry_v1', tool); } catch { /* navigation still works */ }
  trackRetention('retention_open', 'favorites', tool, 'open');
}
export function favoriteCalculated(tool) {
  try {
    if (window.sessionStorage.getItem('keiri_favorite_entry_v1') !== tool) return;
    window.sessionStorage.removeItem('keiri_favorite_entry_v1');
    trackRetention('retention_use', 'favorites', tool, 'calculate');
    recordUse('favorites', tool);
  } catch { /* storage blocked */ }
}
/** A quiet, fixed-URL hint after a successful calculation, never a bookmark-success claim. */
export function attachBookmarkHint(box, tool) {
  if (!box || !Object.hasOwn(TOOLS, tool)) return;
  const hint = document.createElement('details');
  hint.className = 'bookmark-hint'; hint.hidden = true; hint.dataset.retentionControl = '';
  hint.innerHTML = `<summary>次回も使う：このページをお気に入りへ</summary><p>ブラウザの星マーク、または Ctrl+D（Macは⌘D）で登録できます。入力条件はURLに含めません。</p><a href="https://keiri-tools.com/${tool}/">https://keiri-tools.com/${tool}/</a>`;
  // Keep the existing calculate → copy Tab order.
  const copy = box.parentElement.querySelector('button[id^="copy-"]');
  (copy?.closest('#memo-actions') || copy || box).after(hint);
  hint.addEventListener('toggle', () => { if (hint.open) trackRetention('retention_bookmark_hint', 'bookmark', tool, 'open'); });
  const sync = () => {
    const success = box.style.display !== 'none' && (box.hasAttribute('data-result-state')
      ? box.dataset.resultState === 'success' : !!box.querySelector('.big') && !box.querySelector(':scope > .warn'));
    hint.hidden = !success;
    if (success) favoriteCalculated(tool);
  };
  new MutationObserver(sync).observe(box, {attributes: true, attributeFilter: ['style', 'data-result-state'], childList: true, subtree: true});
  sync();
}
