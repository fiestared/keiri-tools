// The printable table is present even without JavaScript. Printing keeps its scope and sources.
document.addEventListener('click', event => {
  if (event.target.closest('[data-print-table]')) {
    document.documentElement.setAttribute('data-print-table', '');
    window.print();
  }
});
window.addEventListener('afterprint', () => document.documentElement.removeAttribute('data-print-table'));
