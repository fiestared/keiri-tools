/** Native details handles Enter/Space and no-JS navigation; desktop starts expanded. */
(function () {
  const wide = window.matchMedia("(min-width: 601px)");
  const indexes = document.querySelectorAll("details.category-index");
  function adapt() {
    indexes.forEach((index) => { index.open = wide.matches; });
  }
  adapt();
  wide.addEventListener("change", adapt);
})();
