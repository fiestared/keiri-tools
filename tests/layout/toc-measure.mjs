export function measureToc(){
 const errors=[];const toc=document.querySelector('nav.toc');if(!toc)return errors;
 const related=document.querySelector('.rail-next');const rail=toc.parentElement;
 const visible=e=>e&&e.getBoundingClientRect().height>0&&getComputedStyle(e).display!=='none';
 if(!visible(related))errors.push('related-hidden');
 if(toc.nextElementSibling!==related)errors.push('related-position');
 const a=toc.getBoundingClientRect(),b=related?.getBoundingClientRect();
 if(b&&(Math.abs(a.left-b.left)>1||Math.abs(a.width-b.width)>1||Math.abs(b.top-a.bottom-12)>1))errors.push('related-alignment');
 const button=toc.querySelector('button');const list=toc.querySelector(':scope > ol, :scope > ul');
 if(!button||button.getAttribute('aria-controls')!==list?.id)errors.push('toggle-controls');
 if(button&&!button.hidden){
  if(button.getAttribute('aria-expanded')!==String(!list.hidden))errors.push('toggle-state');
  if(button.getBoundingClientRect().height<44)errors.push('toggle-target');
 }
 if(innerWidth>=1200){
  const r=rail.getBoundingClientRect();
  if(button?.getAttribute('aria-expanded')==='false'&&(r.top<60||r.bottom>innerHeight-16))errors.push('collapsed-rail-fit');
  if(r.left<document.querySelector('main').getBoundingClientRect().left+16+672+32)errors.push('rail-body-overlap');
 }
 if(document.documentElement.scrollWidth>innerWidth)errors.push('page-overflow');
 return errors;
}
