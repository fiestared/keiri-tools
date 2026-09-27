/* Progressive enhancement: the original TOC and links remain readable without JS. */
(function () {
  'use strict';
  const rail = document.querySelector('.side-rail:has(.rail-next)');
  const toc = rail?.querySelector('nav.toc');
  const list = toc?.querySelector(':scope > ol, :scope > ul');
  const heading = toc?.querySelector('.toc-title, :scope > b, :scope > strong');
  const main = document.querySelector('main');
  if (!list || !heading || !main) return;
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
  const count = list.querySelectorAll('a').length;
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
    state(long ? (chosen ?? false) : true);
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
