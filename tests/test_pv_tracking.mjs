import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const dom=new JSDOM(`<p class="workflow-next" data-workflow-slot="bank_preset_v1"><a href="/senpou-futan/#bank=mizuho-eb">bank</a></p><p class="workflow-next" data-workflow-slot="bank_preset_v1"><a href="/senpou-futan/#bank=mufg-bizstation">bank2</a></p><p class="workflow-next" data-workflow-slot="result_next_v1" hidden><a href="/column/test/?salary=123#private">next</a></p>`,{url:'https://keiri-tools.com/column/test/?private=secret#secret',runScripts:'outside-only'});
const w=dom.window,events=[],observers=[],timers=new Map();let id=0;
w.gtag=(...args)=>events.push(args);w.setTimeout=(fn,ms)=>{assert.equal(ms,1000);timers.set(++id,fn);return id;};w.clearTimeout=id=>timers.delete(id);
Object.defineProperty(w.document,'hidden',{configurable:true,value:false});
w.IntersectionObserver=class{constructor(cb){this.cb=cb;this.els=[];observers.push(this);}observe(el){this.els.push(el);}disconnect(){}};
w.eval(readFileSync(new URL('../docs/assets/track.js',import.meta.url),'utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
const obs=observers.find(o=>o.els.some(el=>el.matches('.workflow-next')));assert(obs);
const [a,b,result]=w.document.querySelectorAll('.workflow-next');
const intersect=(el,ratio)=>obs.cb([{target:el,intersectionRatio:ratio,isIntersecting:ratio>0}]);
const fire=()=>{const fns=[...timers.values()];timers.clear();fns.forEach(fn=>fn());};
intersect(a,.49);fire();assert.equal(events.length,0);
intersect(a,.5);assert.equal(timers.size,1);intersect(a,.2);fire();assert.equal(events.length,0);
intersect(a,.6);Object.defineProperty(w.document,'hidden',{configurable:true,value:true});w.document.dispatchEvent(new w.Event('visibilitychange'));fire();assert.equal(events.length,0);
Object.defineProperty(w.document,'hidden',{configurable:true,value:false});w.document.dispatchEvent(new w.Event('visibilitychange'));fire();assert.equal(events.length,1);
intersect(b,1);fire();assert.equal(events.length,1,'same page/slot is deduplicated');
result.hidden=false;intersect(result,1);result.hidden=true;fire();assert.equal(events.length,1,'hidden results never qualify');
result.hidden=false;intersect(result,1);fire();assert.equal(events.length,2);
assert.deepEqual(events.map(e=>JSON.parse(JSON.stringify(e[2]))),[
 {from:'column/test',slot:'bank_preset_v1',link_url:'https://keiri-tools.com/senpou-futan/#bank=mizuho-eb'},
 {from:'column/test',slot:'result_next_v1',link_url:'https://keiri-tools.com/column/test/'}
]);
for(const el of [a,b,result]){el.querySelector('a').addEventListener('click',e=>e.preventDefault());el.querySelector('a').click();}
assert.equal(events.filter(e=>e[1]==='workflow_click').length,3);
assert(!JSON.stringify(events).includes('secret'));assert(!JSON.stringify(events).includes('salary'));
w.close();console.log('✓ PV telemetry: 50%/1s, cancellation, background/hidden exclusion, per-slot deduplication, public URL allowlist');
