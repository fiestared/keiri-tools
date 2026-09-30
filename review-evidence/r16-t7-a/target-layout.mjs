import fs from 'node:fs';import assert from 'node:assert/strict';
import {browserTools,serve,contextFor,ready} from '../../tests/layout/browser.mjs';
import {measure} from '../../tests/layout/measure.mjs';
import {measureEmpty} from '../../tests/layout/empty-measure.mjs';
import {measureUi} from '../../tests/layout/ui-measure.mjs';
const pages=['/column/koyou-hoken-kanyu-joken/','/column/yakuin-koyou-hoken/','/embed/kihonteate/','/embed/papa-ikukyu/','/kihonteate/','/papa-ikukyu/'];
const sizes=[[1280,900],[1536,864],[1920,1080],[1200,800],[768,1024],[390,844]];
const {chromium}=await browserTools();const server=await serve();const browser=await chromium.launch();const results=[];
try{const context=await contextFor(browser,server.origin);const page=await context.newPage();for(const url of pages)for(const [width,height] of sizes){await page.setViewportSize({width,height});await ready(page,server.origin+url);const r=await page.evaluate(measure);r.issues.push(...await page.evaluate(measureUi),...await page.evaluate(measureEmpty));results.push({url,width,...r});}}finally{await browser.close();server.close();}
fs.writeFileSync('review-evidence/r16-t7-a/target-layout.json',JSON.stringify(results,null,2)+'\n');const bad=results.filter(x=>x.issues.length);assert.deepEqual(bad,[]);console.log('GREEN: final 6 pages × 6 sizes = 36');
