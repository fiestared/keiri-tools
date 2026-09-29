/* Progressive enhancement: the original TOC and links remain readable without JS. */
(function () {
  'use strict';
  const rail = document.querySelector('.side-rail:has(.rail-next)');
  const toc = rail?.querySelector('nav.toc');
  const list = toc?.querySelector(':scope > ol, :scope > ul');
  const heading = toc?.querySelector('.toc-title, :scope > b, :scope > strong');
  const main = document.querySelector('main');
  if (!list || !heading || !main) return;
  // Older generated labels can contain an extra escaped entity. Only repair
  // when decoding exactly reproduces the linked heading; preserve custom labels.
  for (const link of list.querySelectorAll('a[href^="#"]')) {
    if (!/&(?:amp|quot|lt|gt|#\d+|#x[\da-f]+);/i.test(link.textContent)) continue;
    const target = document.getElementById(link.hash.slice(1));
    const decoder = document.createElement('textarea');
    decoder.innerHTML = link.textContent;
    if (target && decoder.value.trim() === target.textContent.trim()) link.textContent = decoder.value;
  }
  heading.classList.add('toc-title');
  const anchor = document.createComment('toc-rail-position');
  rail.before(anchor);
  const track = document.createElement('div');
  track.className = 'toc-rail-track';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'toc-toggle';
  button.setAttribute('data-toc-control', '');
  if (!list.id) list.id = 'toc-sections';
  button.setAttribute('aria-controls', list.id);
  button.setAttribute('aria-expanded', 'true');
  button.hidden = true;
  heading.after(button);
  // 表示する件数は大見出しだけ。入れ子の小見出しまで数えると、開いたときに見える番号と合わない。
  const count = list.querySelectorAll(':scope > li').length;
  let chosen = null;
  function state(open) {
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? '目次を閉じる' : `目次を開く（${count}項目）`;
    list.hidden = !open;
    toc.classList.toggle('toc-collapsed', !open);
  }
  function layout() {
    const focused = document.activeElement === button;
    const desktop = matchMedia('(min-width: 1200px)').matches;
    if (desktop && !track.isConnected) { main.append(track); track.append(rail); }
    if (!desktop && track.isConnected) { anchor.after(rail); track.remove(); }
    rail.classList.add('toc-rail-ready');
    list.hidden = false;
    list.style.removeProperty('max-height');
    button.hidden = true;
    heading.hidden = false;
    const full = list.getBoundingClientRect().height;
    const other = [...rail.children].filter(e => e !== toc).reduce((s,e) => s + e.getBoundingClientRect().height, 0);
    const gaps = (rail.children.length - 1) * 12;
    // 48px button + 8px list gap + 4px bottom padding + 2px border.
    const room = desktop ? innerHeight - 104 - other - gaps - 62 : Math.min(320, innerHeight * 0.4);
    const long = count > 6 || full > Math.min(320, room);
    button.hidden = !long;
    heading.hidden = long;
    if (desktop && long) list.style.maxHeight = Math.max(96, room) + 'px';
    // 長い目次も、PCでは最初から開いておく（右レールに場所があるので、読者が開く手間を省く。2026-09-29）。
    // スマホは目次が本文の前に並ぶので、開くと本文が下へ押し出される。最初は閉じたままにする。
    state(long ? (chosen ?? desktop) : true);
    rail.classList.toggle('toc-rail-tall', rail.getBoundingClientRect().height > innerHeight - 104);
    if (focused) button.focus({preventScroll:true});
  }
  button.addEventListener('click', () => {
    chosen = button.getAttribute('aria-expanded') !== 'true';
    state(chosen);
    layout();
    // A shared tracking listener handles this event; no free text or form values.
    document.dispatchEvent(new CustomEvent('toc-toggle', {detail:{expanded:chosen}}));
  });
  let pending = false;
  addEventListener('resize', () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; layout(); }); } });
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(layout);
    [...rail.children].filter(e => e !== toc).forEach(e => observer.observe(e));
  }
  document.fonts?.ready.then(layout);
  layout();
})();
