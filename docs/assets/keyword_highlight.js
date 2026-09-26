const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Highlight text, not markup. The query is not a regular expression. */
export function highlightKeyword(text, query) {
  const source = String(text ?? ''), q = String(query ?? '').trim();
  if (!q) return escape(source);
  let from = 0, out = '', at;
  const lower = source.toLowerCase(), needle = q.toLowerCase();
  while ((at = lower.indexOf(needle, from)) !== -1) {
    out += escape(source.slice(from, at)) + '<mark>' + escape(source.slice(at, at + q.length)) + '</mark>';
    from = at + q.length;
  }
  return out + escape(source.slice(from));
}
