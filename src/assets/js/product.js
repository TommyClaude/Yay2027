/* ===========================================================================
   YayCommerce — Product page behaviour

   Gallery, billing/tier selection (which drives both the buy box and the
   sticky bar), tabs, review pagination and the review modal. The FAQ
   accordion is shared, so it lives in site.js.
   ======================================================================== */

(function () {
  "use strict";

  /* -----------------------------------------------------------------------
     Pricing

     Annual and lifetime each have three site tiers. The "5 sites" tier is the
     one with an anchor price and a savings badge — it is the AOV lever.
     -------------------------------------------------------------------- */

  var PRICING = {
    annual: { prices: ["$99", "$199", "$499"], anchor: "$495", save: "Save $296", suffix: "/yr" },
    lifetime: { prices: ["$299", "$499", "$999"], anchor: "$1,495", save: "Save $996", suffix: " once" },
  };

  var state = { billing: "annual", tier: 0 };

  var billingButtons = document.querySelectorAll("[data-billing]");
  var tiers = document.querySelectorAll(".tier");
  var stickyTiers = document.querySelectorAll(".sticky-buy__tier");

  function renderPricing() {
    var plan = PRICING[state.billing];

    billingButtons.forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.billing === state.billing);
      button.setAttribute("aria-pressed", String(button.dataset.billing === state.billing));
    });

    tiers.forEach(function (tier, index) {
      tier.classList.toggle("is-active", index === state.tier);
      tier.setAttribute("aria-pressed", String(index === state.tier));

      var price = tier.querySelector("[data-tier-price]");
      var anchor = tier.querySelector("[data-tier-anchor]");
      if (price) price.textContent = plan.prices[index];
      if (anchor) anchor.textContent = plan.anchor;
    });

    stickyTiers.forEach(function (tier, index) {
      tier.classList.toggle("is-active", index === state.tier);
      var price = tier.querySelector("[data-tier-price]");
      var anchor = tier.querySelector("[data-tier-anchor]");
      if (price) price.textContent = plan.prices[index];
      if (anchor) anchor.textContent = plan.anchor;
    });

    // Savings badge only exists on the middle tier.
    var saving = state.tier === 1 ? plan.save : "";
    document.querySelectorAll("[data-save-badge]").forEach(function (badge) {
      badge.textContent = saving;
      badge.hidden = !saving;
    });

    document.querySelectorAll("[data-cta-label]").forEach(function (el) {
      el.textContent = "Purchase — " + plan.prices[state.tier];
    });

    document.querySelectorAll("[data-bar-price]").forEach(function (el) {
      el.textContent = plan.prices[state.tier] + plan.suffix;
    });

    var renew = document.querySelector("[data-renew-note]");
    if (renew) {
      renew.textContent = state.billing === "annual"
        ? "Renews at the same price. Cancel anytime."
        : "Pay once — updates & support forever.";
    }
  }

  billingButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      state.billing = button.dataset.billing;
      renderPricing();
    });
  });

  [tiers, stickyTiers].forEach(function (group) {
    group.forEach(function (tier, index) {
      tier.addEventListener("click", function () {
        state.tier = index;
        renderPricing();
      });
    });
  });

  renderPricing();

  /* -----------------------------------------------------------------------
     Gallery — feature graphic first, real screenshots behind it
     -------------------------------------------------------------------- */

  var main = document.querySelector("[data-gallery-main]");
  var caption = document.querySelector("[data-gallery-caption]");
  var thumbs = document.querySelectorAll("[data-gallery-thumb]");

  thumbs.forEach(function (thumb) {
    thumb.addEventListener("click", function () {
      var img = thumb.querySelector("img");
      if (main) {
        main.src = img.src;
        main.alt = img.alt;
      }
      if (caption) caption.textContent = img.alt;
      thumbs.forEach(function (other) { other.classList.toggle("is-active", other === thumb); });
    });
  });

  /* -----------------------------------------------------------------------
     Tabs
     -------------------------------------------------------------------- */

  var tabButtons = document.querySelectorAll("[data-tab]");

  tabButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var target = button.dataset.tab;

      tabButtons.forEach(function (other) {
        var on = other === button;
        other.classList.toggle("is-active", on);
        other.setAttribute("aria-selected", String(on));
      });

      document.querySelectorAll("[data-tabpanel]").forEach(function (panel) {
        panel.hidden = panel.dataset.tabpanel !== target;
      });
    });
  });

  /* -----------------------------------------------------------------------
     Review pagination

     Numbered pages rather than "load more": the section keeps a fixed height
     so the FAQ and related plugins below it don't get pushed away.
     -------------------------------------------------------------------- */

  var PER_PAGE = 5;
  var TOTAL_REVIEWS = 113;
  var reviewItems = Array.prototype.slice.call(document.querySelectorAll(".review"));

  if (reviewItems.length) {
    var pageButtons = document.querySelectorAll("[data-review-page]");
    var prev = document.querySelector("[data-review-prev]");
    var next = document.querySelector("[data-review-next]");
    var range = document.querySelector("[data-review-range]");
    var lastPage = Math.ceil(reviewItems.length / PER_PAGE);
    var page = 1;

    var showPage = function (n) {
      page = Math.min(Math.max(1, n), lastPage);

      reviewItems.forEach(function (item, index) {
        item.hidden = Math.floor(index / PER_PAGE) + 1 !== page;
      });

      pageButtons.forEach(function (button) {
        button.classList.toggle("is-active", Number(button.dataset.reviewPage) === page);
      });

      if (prev) prev.disabled = page === 1;
      if (next) next.disabled = page === lastPage;

      if (range) {
        range.textContent = ((page - 1) * PER_PAGE + 1) + "–" +
          Math.min(page * PER_PAGE, reviewItems.length) + " of " + TOTAL_REVIEWS.toLocaleString();
      }
    };

    pageButtons.forEach(function (button) {
      button.addEventListener("click", function () { showPage(Number(button.dataset.reviewPage)); });
    });

    if (prev) prev.addEventListener("click", function () { showPage(page - 1); });
    if (next) next.addEventListener("click", function () { showPage(page + 1); });

    showPage(1);
  }

  /* -----------------------------------------------------------------------
     Review modal
     -------------------------------------------------------------------- */

  var modal = document.querySelector("[data-review-modal]");

  if (modal) {
    var form = modal.querySelector("[data-review-form]");
    var done = modal.querySelector("[data-review-done]");

    var openModal = function () {
      modal.hidden = false;
      if (form) form.hidden = false;
      if (done) done.hidden = true;
    };

    var closeModal = function () { modal.hidden = true; };

    document.querySelectorAll("[data-review-open]").forEach(function (button) {
      button.addEventListener("click", openModal);
    });

    modal.querySelectorAll("[data-review-close]").forEach(function (button) {
      button.addEventListener("click", closeModal);
    });

    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });

    var submit = modal.querySelector("[data-review-submit]");
    if (submit) {
      submit.addEventListener("click", function () {
        if (form) form.hidden = true;
        if (done) done.hidden = false;
      });
    }

    var starButtons = Array.prototype.slice.call(modal.querySelectorAll(".rating-picker button"));
    starButtons.forEach(function (button, index) {
      button.addEventListener("click", function () {
        starButtons.forEach(function (other, i) { other.classList.toggle("is-on", i <= index); });
      });
    });
  }

  /* -----------------------------------------------------------------------
     Sticky purchase bar

     Appears once the buy box has scrolled past, hides again near the footer
     so it never covers it.
     -------------------------------------------------------------------- */

  var bar = document.querySelector(".sticky-buy");
  var buybox = document.querySelector(".buybox");
  var footer = document.querySelector(".site-footer");

  if (bar && buybox) {
    var sync = function () {
      var passed = buybox.getBoundingClientRect().bottom < 0;
      var nearFooter = footer && footer.getBoundingClientRect().top < window.innerHeight;
      bar.hidden = !(passed && !nearFooter);
    };

    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  }
})();
