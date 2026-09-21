/* ===========================================================================
   YayCommerce — Checkout

   Payment method, the All Access order bump, coupons and the running total.

   EDD Recurring allows one subscription per order, so the cart holds a single
   line. Ticking the bump swaps that line for All Access rather than adding a
   second subscription.
   ======================================================================== */

(function () {
  "use strict";

  var root = document.querySelector(".checkout");
  if (!root) return;

  var ITEM = { price: 99.5 };
  var BUNDLE = { price: 299 };
  var COUPON = { code: "SUNNY30", rate: 0.3 };

  var state = {
    pay: "card",
    bump: false,
    removed: false,
    coupon: null,
    autoApplied: false,
  };

  var money = function (n) { return "$" + n.toFixed(2); };

  var el = function (selector) { return root.querySelector(selector); };
  var all = function (selector) { return Array.prototype.slice.call(root.querySelectorAll(selector)); };

  /* -----------------------------------------------------------------------
     Render
     -------------------------------------------------------------------- */

  function subtotal() {
    if (state.bump) return BUNDLE.price;
    return state.removed ? 0 : ITEM.price;
  }

  function render() {
    var sub = subtotal();
    var discount = state.coupon ? sub * COUPON.rate : 0;
    var total = sub - discount;
    var empty = !state.bump && state.removed;

    /* Payment method */
    all("[data-pay]").forEach(function (tab) {
      var on = tab.dataset.pay === state.pay;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-pressed", String(on));
    });

    all("[data-pay-panel]").forEach(function (panel) {
      panel.hidden = panel.dataset.payPanel !== state.pay;
    });

    /* Cart lines */
    el("[data-line-item]").hidden = state.bump || state.removed;
    el("[data-line-bundle]").hidden = !state.bump;
    el("[data-cart-empty]").hidden = !empty;
    el("[data-order-body]").hidden = empty;
    el("[data-summary-count]").textContent = empty ? "0 items" : "1 item";

    /* Order bump */
    var bump = el("[data-bump]");
    bump.classList.toggle("is-on", state.bump);
    bump.setAttribute("aria-pressed", String(state.bump));
    el("[data-bump-note]").textContent = state.bump
      ? "Added — replaces the plugin in your cart."
      : "That's just " + money(Math.max(0, BUNDLE.price - ITEM.price)) + " more than your current cart.";

    /* Coupon */
    el("[data-coupon-applied]").hidden = !state.coupon;
    el("[data-coupon-entry]").hidden = !!state.coupon;
    el("[data-auto-applied]").hidden = !(state.coupon && state.autoApplied);

    /* Totals — subtotal and discount only appear once there is a discount */
    el("[data-row-subtotal]").hidden = !state.coupon;
    el("[data-row-discount]").hidden = !state.coupon;
    el("[data-subtotal]").textContent = money(sub);
    el("[data-discount]").textContent = "−" + money(discount);
    el("[data-total]").textContent = money(total);

    /* Pay button */
    el("[data-pay-card]").hidden = state.pay !== "card";
    el("[data-pay-paypal]").hidden = state.pay !== "paypal";
    el("[data-pay-label]").textContent = "Pay " + money(total);
  }

  /* -----------------------------------------------------------------------
     Events
     -------------------------------------------------------------------- */

  all("[data-pay]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      state.pay = tab.dataset.pay;
      render();
    });
  });

  el("[data-bump]").addEventListener("click", function () {
    state.bump = !state.bump;
    render();
  });

  el("[data-remove-item]").addEventListener("click", function () {
    state.removed = true;
    render();
  });

  el("[data-restore-cart]").addEventListener("click", function () {
    state.removed = false;
    render();
  });

  var couponForm = el("[data-coupon-form]");
  var couponToggle = el("[data-coupon-toggle]");
  var couponField = el("[data-coupon-field]");
  var couponError = el("[data-coupon-error]");

  couponToggle.addEventListener("click", function () {
    couponToggle.hidden = true;
    couponForm.hidden = false;
    couponField.focus();
  });

  couponForm.addEventListener("submit", function (e) {
    e.preventDefault();

    if (couponField.value.trim().toUpperCase() === COUPON.code) {
      state.coupon = COUPON.code;
      state.autoApplied = false;
      couponError.hidden = true;
      render();
    } else {
      couponError.hidden = false;
    }
  });

  couponField.addEventListener("input", function () { couponError.hidden = true; });

  el("[data-coupon-remove]").addEventListener("click", function () {
    state.coupon = null;
    state.autoApplied = false;
    couponField.value = "";
    couponToggle.hidden = true;
    couponForm.hidden = false;
    render();
  });

  /* -----------------------------------------------------------------------
     Campaign links

     "Get the deal" promises 30% off — honour it on arrival rather than making
     people hunt for the code they were just shown.
     -------------------------------------------------------------------- */

  try {
    var fromUrl = new URLSearchParams(location.search).get("coupon");
    if (fromUrl && fromUrl.trim().toUpperCase() === COUPON.code) {
      state.coupon = COUPON.code;
      state.autoApplied = true;
    }
  } catch (error) {
    /* No URLSearchParams — the page still works, just without auto-apply. */
  }

  render();
})();
