/* ===========================================================================
   YayCommerce — Shop filtering

   All ten cards ship in the HTML, so the catalogue is complete without
   JavaScript and readable by crawlers. This layer hides the ones that don't
   match and reorders the rest with flex/grid `order`, so nothing is rebuilt
   and the cards keep their markup.

   The category can be deep-linked: shop.html?cat=Marketing%20%26%20Sales
   ======================================================================== */

(function () {
  "use strict";

  var grid = document.querySelector("[data-shop-grid]");
  if (!grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll("[data-plugin]"));
  var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-cat]"));
  var searchField = document.querySelector("[data-shop-search]");
  var sortField = document.querySelector("[data-shop-sort]");
  var empty = document.querySelector("[data-shop-empty]");
  var emptyTerm = document.querySelector("[data-shop-empty-term]");
  var clearButton = document.querySelector("[data-shop-clear]");

  var CATEGORIES = ["Marketing & Sales", "Emails & Notifications", "Product Page", "Payments & B2B"];

  var state = {
    cat: initialCategory(),
    q: "",
    sort: "popular",
  };

  function initialCategory() {
    try {
      var cat = new URLSearchParams(location.search).get("cat");
      return cat && CATEGORIES.indexOf(cat) !== -1 ? cat : "All";
    } catch (error) {
      return "All";
    }
  }

  /* Sorting ------------------------------------------------------------- */

  var COMPARATORS = {
    popular: function (a, b) { return num(b, "installs") - num(a, "installs"); },
    rating: function (a, b) {
      return num(b, "rating") - num(a, "rating") || num(b, "installs") - num(a, "installs");
    },
    priceAsc: function (a, b) { return num(a, "price") - num(b, "price"); },
  };

  function num(card, key) { return parseFloat(card.dataset[key]) || 0; }

  function matches(card) {
    if (state.cat !== "All" && card.dataset.cat !== state.cat) return false;
    if (!state.q) return true;

    var haystack = (card.dataset.plugin + " " + card.dataset.tag).toLowerCase();
    return haystack.indexOf(state.q) !== -1;
  }

  function apply() {
    var visible = cards.filter(matches);

    // The source order is already "most popular", which keeps the sort stable
    // for ties the same way the design did.
    visible.slice().sort(COMPARATORS[state.sort] || COMPARATORS.popular)
      .forEach(function (card, index) { card.style.order = index; });

    cards.forEach(function (card) {
      card.hidden = visible.indexOf(card) === -1;
    });

    grid.hidden = visible.length === 0;

    if (empty) {
      empty.hidden = visible.length !== 0;
      if (emptyTerm) emptyTerm.textContent = state.q;
    }

    tabs.forEach(function (tab) {
      tab.classList.toggle("is-active", tab.dataset.cat === state.cat);
      tab.setAttribute("aria-pressed", String(tab.dataset.cat === state.cat));
    });
  }

  /* Wiring --------------------------------------------------------------- */

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      state.cat = tab.dataset.cat;
      apply();
    });
  });

  if (searchField) {
    searchField.addEventListener("input", function () {
      state.q = searchField.value.trim().toLowerCase();
      apply();
    });
  }

  if (sortField) {
    sortField.addEventListener("change", function () {
      state.sort = sortField.value;
      apply();
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", function () {
      state.q = "";
      if (searchField) searchField.value = "";
      apply();
    });
  }

  apply();
})();
