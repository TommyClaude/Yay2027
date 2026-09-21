/* ===========================================================================
   YayCommerce — Docs search

   Filters the per-plugin cards. Each card carries hidden keywords so the
   "Popular" chips (license activation, countdown timer…) always land on
   something — a suggestion that returns an empty page is worse than no
   suggestion at all.
   ======================================================================== */

(function () {
  "use strict";

  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-doc]"));
  if (!cards.length) return;

  var field = document.querySelector("[data-docs-search]");
  var empty = document.querySelector("[data-docs-empty]");
  var emptyTerm = document.querySelector("[data-docs-empty-term]");
  var clearButton = document.querySelector("[data-docs-clear]");

  function haystack(card) {
    var links = Array.prototype.map.call(card.querySelectorAll(".docs-card__links a"), function (a) {
      return a.textContent;
    }).join(" ");

    return (card.dataset.doc + " " + card.dataset.keywords + " " + links).toLowerCase();
  }

  function apply(query) {
    var q = query.trim().toLowerCase();
    var shown = 0;

    cards.forEach(function (card) {
      var match = !q || haystack(card).indexOf(q) !== -1;
      card.hidden = !match;
      if (match) shown += 1;
    });

    if (empty) {
      empty.hidden = shown !== 0;
      if (emptyTerm) emptyTerm.textContent = query.trim();
    }
  }

  if (field) {
    field.addEventListener("input", function () { apply(field.value); });
  }

  document.querySelectorAll("[data-docs-chip]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      if (field) {
        field.value = chip.textContent.trim();
        field.focus();
      }
      apply(chip.textContent);
    });
  });

  if (clearButton) {
    clearButton.addEventListener("click", function () {
      if (field) field.value = "";
      apply("");
    });
  }
})();
