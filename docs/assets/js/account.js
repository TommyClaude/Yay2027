/* ===========================================================================
   YayCommerce — My account

   View switching (sidebar + hash links from the header menu), order detail,
   licence key copy and the per-licence "manage sites" panel.
   ======================================================================== */

(function () {
  "use strict";

  var root = document.querySelector(".account");
  if (!root) return;

  var VIEWS = ["dashboard", "purchases", "downloads", "licenses", "profile"];

  var navItems = Array.prototype.slice.call(root.querySelectorAll("[data-view-link]"));
  var views = Array.prototype.slice.call(root.querySelectorAll("[data-view]"));
  var orderViews = Array.prototype.slice.call(root.querySelectorAll("[data-order-view]"));

  /* -----------------------------------------------------------------------
     Views
     -------------------------------------------------------------------- */

  function show(view, order) {
    views.forEach(function (panel) {
      // The purchases list gives way to the order detail when one is open.
      var isPurchases = panel.dataset.view === "purchases";
      panel.hidden = panel.dataset.view !== view || (isPurchases && order != null);
    });

    orderViews.forEach(function (panel) {
      panel.hidden = order == null || panel.dataset.orderView !== String(order);
    });

    navItems.forEach(function (item) {
      var on = item.dataset.viewLink === view;
      item.classList.toggle("is-active", on);
      item.setAttribute("aria-current", on ? "page" : "false");
    });
  }

  function fromHash() {
    var hash = (location.hash || "").slice(1);
    return VIEWS.indexOf(hash) !== -1 ? hash : "dashboard";
  }

  navItems.forEach(function (item) {
    item.addEventListener("click", function () {
      var view = item.dataset.viewLink;
      history.replaceState(null, "", view === "dashboard" ? location.pathname : "#" + view);
      show(view, null);
    });
  });

  root.querySelectorAll("[data-goto]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      show(link.dataset.goto, null);
    });
  });

  root.querySelectorAll("[data-open-order]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      show("purchases", link.dataset.openOrder);
    });
  });

  root.querySelectorAll("[data-close-order]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      show("purchases", null);
    });
  });

  window.addEventListener("hashchange", function () { show(fromHash(), null); });

  show(fromHash(), null);

  /* -----------------------------------------------------------------------
     Licence keys
     -------------------------------------------------------------------- */

  root.querySelectorAll("[data-copy-key]").forEach(function (button) {
    var label = button.querySelector("span");
    var timer;

    button.addEventListener("click", function () {
      // The displayed key is masked; the real one rides on the button.
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(button.dataset.copyKey);
      } catch (error) {
        /* Clipboard unavailable — the visual confirmation still fires. */
      }

      button.classList.add("is-copied");
      label.textContent = "Copied";

      clearTimeout(timer);
      timer = setTimeout(function () {
        button.classList.remove("is-copied");
        label.textContent = "Copy";
      }, 1800);
    });
  });

  /* -----------------------------------------------------------------------
     Manage sites
     -------------------------------------------------------------------- */

  root.querySelectorAll("[data-sites-toggle]").forEach(function (toggle) {
    var panel = document.getElementById(toggle.dataset.sitesToggle);
    if (!panel) return;

    toggle.addEventListener("click", function () {
      panel.hidden = !panel.hidden;
      toggle.textContent = panel.hidden ? "Manage sites" : "Hide sites";
      toggle.setAttribute("aria-expanded", String(!panel.hidden));
    });
  });
})();
