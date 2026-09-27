/** Keep the optional next task outside result HTML and copy/save controls. */
export function attachResultNext(result, next) {
  const sync = () => {
    next.hidden = result.dataset.resultState !== 'success'
      || result.dataset.workflowEligible === 'false';
  };
  sync();
  new MutationObserver(sync).observe(result, {
    attributes: true, attributeFilter: ['data-result-state', 'data-workflow-eligible'],
  });
}
