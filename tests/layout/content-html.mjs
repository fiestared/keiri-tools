/** Remove only audited presentation wrappers for legacy content assertions.
 * All text, numbers, section boundaries and semantic attributes survive.
 * Browser/markup tests independently enforce these wrappers' appearance.
 */
export function contentHTML(html) {
 if(typeof html!=='string')return html;
 return html
  .replace(/<span class="(?:numeric-token|faq-existing-marker)"(?: aria-hidden="true")?>([^<]*)<\/span>/g, '$1')
  .replace(/<(h3|p) class="faq-(?:question|answer)">/g, '<$1>');
}
