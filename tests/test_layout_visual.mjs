/** Representative image comparison. Explicit update only; never auto-accept differences. */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';import {join} from 'node:path';import assert from 'node:assert/strict';
import {browserTools,serve,contextFor,ready,ROOT,outputDir} from './layout/browser.mjs';
const update=process.argv.includes('--update');const dir=join(ROOT,'tests/layout/baselines');
const specs=JSON.parse(readFileSync(join(ROOT,'tests/layout/visual-pages.json')));
const {chromium,PNG,version}=await browserTools();const server=await serve();let browser;try{browser=await chromium.launch();}catch(error){server.close();throw error;}
const env={platform:process.platform,arch:process.arch,playwright:version,browser:browser.version(),deviceScaleFactor:1};
const metadata=join(dir,'environment.json');const bad=[];
function compare(a,b){const x=PNG.sync.read(a),y=PNG.sync.read(b);if(x.width!==y.width||x.height!==y.height)return {reason:`dimensions ${x.width}x${x.height} vs ${y.width}x${y.height}`};let count=0;const diff=new PNG({width:x.width,height:x.height});for(let i=0;i<x.data.length;i+=4){const changed=Math.max(...[0,1,2].map(c=>Math.abs(x.data[i+c]-y.data[i+c])))>32;if(changed)count++;diff.data[i]=changed?230:y.data[i];diff.data[i+1]=changed?30:y.data[i+1];diff.data[i+2]=changed?70:y.data[i+2];diff.data[i+3]=255;}const ratio=count/(x.width*x.height);return ratio>.01?{reason:`${(ratio*100).toFixed(2)}% pixels changed (limit 1%)`,diff:PNG.sync.write(diff)}:null;}
try{
 if(update)mkdirSync(dir,{recursive:true});else {assert(existsSync(metadata),'Missing visual baselines. Review and run node tests/test_layout_visual.mjs --update');assert.deepEqual(JSON.parse(readFileSync(metadata)),env,'Different rendering environment; run the documented environment migration review instead of silently accepting images');}
 const context=await contextFor(browser,server.origin);const page=await context.newPage();
 // Stable clock for date/calendar widgets. No app data or ad slot markup is changed.
 await page.clock.setFixedTime(new Date('2026-09-27T00:00:00+09:00'));
 for(const spec of specs)for(const width of [1280,390]){await page.setViewportSize({width,height:900});await ready(page,server.origin+spec.url);
  const name=spec.name+'-'+width+'.png';const file=join(dir,name);let actual;
  if(spec.selector)actual=await page.locator(spec.selector).nth(spec.nth||0).screenshot({animations:'disabled',style:'header.site{visibility:hidden!important}'});
  else {if(spec.bottom)await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));actual=await page.screenshot({animations:'disabled'});}
  if(update)writeFileSync(file,actual);else {assert(existsSync(file),'Missing baseline '+name);const expected=readFileSync(file);const result=compare(actual,expected);if(result){bad.push(name+': '+result.reason);const out=outputDir();writeFileSync(join(out,name.replace('.png','-actual.png')),actual);writeFileSync(join(out,name.replace('.png','-expected.png')),expected);if(result.diff)writeFileSync(join(out,name.replace('.png','-diff.png')),result.diff);}}
 }
 // The comparator itself must reject a large real pixel change and accept an identical image.
 const fixture=new PNG({width:100,height:100});fixture.data.fill(255);const original=PNG.sync.write(fixture);assert.equal(compare(original,original),null);for(let i=0;i<fixture.data.length/2;i+=4)fixture.data[i]=0;assert(compare(PNG.sync.write(fixture),original));
 if(update)writeFileSync(metadata,JSON.stringify(env,null,2)+'\n');
}finally{await browser.close();server.close();}
assert.equal(bad.length,0,bad.join('\n')+'\nSee '+outputDir());console.log(`✓ Visual ${update?'updated':'matched'}: ${specs.length*2} images; comparator mutation verified`);
