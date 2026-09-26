import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {contentHTML} from './layout/content-html.mjs';
// Content assertions must see all claims, including changed or newly added values.
const source='<main><h3 class="faq-question"><span class="faq-existing-marker" aria-hidden="true">Q. </span>金額は？</h3><p class="faq-answer">A. <b>123,456円</b>です。</p><div class="scroll-wrap"><table><tr><td><span class="numeric-token">123,456円</span></td><td><span class="warning">別の主張</span></td></tr></table></div></main>';
const read=html=>{const dom=new JSDOM(html);const d=dom.window.document;const data={text:d.body.textContent,headings:[...d.querySelectorAll('h3')].map(e=>e.textContent),cells:[...d.querySelectorAll('td')].map(e=>e.textContent),tables:d.querySelectorAll('table').length};dom.window.close();return data;};
assert.deepEqual(read(contentHTML(source)),read(source));
assert(contentHTML(source).includes('<span class="warning">別の主張</span>'));
assert(contentHTML(source).includes('<div class="scroll-wrap">'));
assert.notEqual(contentHTML(source.replace('123,456円','123,457円')),contentHTML(source));
assert.notEqual(contentHTML(source.replace('です。','ではありません。')),contentHTML(source));
assert.notEqual(contentHTML(source.replace('</tr>','<td>999円</td></tr>')),contentHTML(source));
assert.equal(contentHTML(contentHTML(source)),contentHTML(source));
console.log('✓ Presentation normalization preserves claims, cells and boundaries; value/conclusion/extra-cell mutations remain visible');
