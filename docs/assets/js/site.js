/* ===========================================================================
   YayCommerce - shared site behaviour

   Header menus, the mobile drawer, the FAQ accordion, the promo-bar countdown
   and the campaign coupon. Every page loads this; page-specific behaviour
   lives in its own file.
   ======================================================================== */

(function () {
  "use strict";

  var root = document.documentElement;

  /* Two questions decide how the header behaves:
     narrow - is the nav a drawer rather than a bar?
     coarse - is there no pointer that can hover (a phone, a tablet)? */
  var narrow = window.matchMedia("(max-width: 1024px)");
  var coarse = window.matchMedia("(hover: none)");

  /* -----------------------------------------------------------------------
     Header menus

     The Plugins mega menu and the account dropdown share one behaviour:

       mouse or trackpad   open on hover and on keyboard focus, close on
                           leave, blur and Escape
       touch, wide screen  open and close on tap; a tap elsewhere closes
       drawer              Plugins is an accordion row, toggled by a tap;
                           the account links are simply part of the list
     -------------------------------------------------------------------- */

  var menus = [];

  function bindMenu(el) {
    var trigger = el.querySelector(".nav-link, .account-chip");
    var isChip = trigger.classList.contains("account-chip");
    var dismissed = false;

    var menu = {
      el: el,
      isOpen: function () { return el.classList.contains("is-open"); },
      set: function (open) {
        el.classList.toggle("is-open", open);
        if (trigger.hasAttribute("aria-expanded")) trigger.setAttribute("aria-expanded", String(open));
      }
    };

    var hovers = function () { return !narrow.matches && !coarse.matches; };

    el.addEventListener("mouseenter", function () { if (hovers()) menu.set(true); });

    el.addEventListener("mouseleave", function () {
      dismissed = false;
      if (hovers()) menu.set(false);
    });

    el.addEventListener("focusin", function () {
      if (hovers() && !dismissed) menu.set(true);
    });

    el.addEventListener("focusout", function (e) {
      if (el.contains(e.relatedTarget)) return;
      dismissed = false;
      if (hovers()) menu.set(false);
    });

    /* Escape closes the menu and hands focus back to what opened it. The
       flag stops that focus from opening it again straight away. */
    el.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.isOpen() && !narrow.matches) {
        dismissed = true;
        menu.set(false);
        trigger.focus();
        e.stopPropagation();
      } else if (isChip && e.target === trigger && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        dismissed = false;
        menu.set(!menu.isOpen());
      }
    });

    trigger.addEventListener("click", function (e) {
      if (hovers()) return;
      /* In the drawer the account links are already on show. */
      if (isChip && narrow.matches) return;
      e.preventDefault();
      var open = !menu.isOpen();
      if (!narrow.matches) closeMenus();
      menu.set(open);
    });

    menus.push(menu);
  }

  function closeMenus() {
    menus.forEach(function (menu) { menu.set(false); });
  }

  document.querySelectorAll(".has-mega, .has-account").forEach(bindMenu);

  /* A tap outside an open menu closes it. Only touch needs this: with a
     mouse, leaving the menu already has. */
  document.addEventListener("click", function (e) {
    if (narrow.matches || !coarse.matches) return;
    menus.forEach(function (menu) {
      if (menu.isOpen() && !menu.el.contains(e.target)) menu.set(false);
    });
  });

  /* In the bar the account chip is a button that opens a menu. In the
     drawer it is a plain label above links that are already visible, so it
     must not take focus or announce a menu it does not have. */
  var chip = document.querySelector(".has-account .account-chip");

  function syncChip() {
    if (!chip) return;
    if (narrow.matches) {
      ["role", "tabindex", "aria-haspopup", "aria-expanded"].forEach(function (name) {
        chip.removeAttribute(name);
      });
    } else {
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");
      chip.setAttribute("aria-haspopup", "true");
      chip.setAttribute("aria-expanded", "false");
    }
  }

  syncChip();

  /* -----------------------------------------------------------------------
     Drawer

     Below 1025px the header nav and actions move into an off-canvas panel.
     The panel is the same markup as the desktop bar, so nothing here has to
     know what is inside it, only when it is open. While it is open it
     behaves as a dialog: focus moves in, stays in, and goes back to the
     menu button when it closes.
     -------------------------------------------------------------------- */

  var toggle = document.querySelector(".nav-toggle");
  var panel = document.getElementById("site-drawer");
  var scrim = document.querySelector(".drawer-scrim");
  var closer = document.querySelector(".drawer-close");

  function drawerIsOpen() {
    return root.classList.contains("is-drawer-open");
  }

  function drawerStops() {
    return Array.prototype.filter.call(
      panel.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (el) { return el.getClientRects().length > 0; }
    );
  }

  function setDrawer(open, returnFocus) {
    if (!toggle || !panel || open === drawerIsOpen()) return;

    root.classList.toggle("is-drawer-open", open);
    toggle.setAttribute("aria-expanded", String(open));

    if (open) {
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-label", "Menu");
      (closer || panel).focus();
    } else {
      ["role", "aria-modal", "aria-label"].forEach(function (name) { panel.removeAttribute(name); });
      closeMenus();
      if (returnFocus) toggle.focus();
    }
  }

  if (toggle && panel) {
    toggle.addEventListener("click", function () { setDrawer(!drawerIsOpen(), true); });
    if (scrim) scrim.addEventListener("click", function () { setDrawer(false, true); });
    if (closer) closer.addEventListener("click", function () { setDrawer(false, true); });

    document.addEventListener("keydown", function (e) {
      if (!drawerIsOpen()) return;

      if (e.key === "Escape") {
        setDrawer(false, true);
        return;
      }

      if (e.key !== "Tab") return;

      var stops = drawerStops();
      if (!stops.length) return;
      var first = stops[0];
      var last = stops[stops.length - 1];
      var active = document.activeElement;

      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    });

    /* A link inside the drawer navigates; leaving the panel open would
       flash it over the next page. The Plugins row is the exception: it
       opens its list instead of going anywhere. */
    panel.addEventListener("click", function (e) {
      if (e.target.closest("a") && !e.target.closest(".has-mega > .nav-link")) setDrawer(false, false);
    });
  }

  /* Crossing the breakpoint changes what the header is. Whatever was open
     belongs to the layout being left behind. */
  narrow.addEventListener("change", function () {
    setDrawer(false, false);
    closeMenus();
    syncChip();
  });

  /* -----------------------------------------------------------------------
     FAQ accordion

     One answer open at a time; the first item ships open so the section is
     never a wall of closed rows.
     -------------------------------------------------------------------- */

  document.querySelectorAll(".faq__q").forEach(function (question) {
    question.addEventListener("click", function () {
      var item = question.closest(".faq__item");
      var wasOpen = item.classList.contains("is-open");
      var faq = question.closest(".faq");

      faq.querySelectorAll(".faq__item").forEach(function (other) {
        other.classList.remove("is-open");
        other.querySelector(".faq__q").setAttribute("aria-expanded", "false");
      });

      if (!wasOpen) {
        item.classList.add("is-open");
        question.setAttribute("aria-expanded", "true");
      }
    });
  });

  /* -----------------------------------------------------------------------
     Sale countdown

     The summer sale ends at midnight two days out. Ticks every second so the
     urgency in the promo bar is real rather than a static string.
     -------------------------------------------------------------------- */

  var timers = document.querySelectorAll("[data-countdown]");

  if (timers.length) {
    var pad = function (n) { return String(n).padStart(2, "0"); };

    var deadline = function () {
      var end = new Date();
      end.setHours(24, 0, 0, 0);
      end.setDate(end.getDate() + 2);
      return end;
    };

    var end = deadline();

    var tick = function () {
      var left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      var days = Math.floor(left / 86400);
      left -= days * 86400;
      var text = days + "d " + pad(Math.floor(left / 3600)) + ":" +
        pad(Math.floor((left % 3600) / 60)) + ":" + pad(left % 60);

      timers.forEach(function (el) { el.textContent = text; });
    };

    tick();
    setInterval(tick, 1000);
  }

  /* -----------------------------------------------------------------------
     Campaign coupon

     "Get the deal" promises 30% off, and checkout applies a code it finds
     in the address (?coupon=SUNNY30). Any page the visitor passes through
     on the way has to hand that code on, or the promise is lost at the
     first click.
     -------------------------------------------------------------------- */

  var coupon = new URLSearchParams(window.location.search).get("coupon");

  if (coupon && /^[A-Za-z0-9_-]{1,32}$/.test(coupon)) {
    document.querySelectorAll('a[href^="checkout.html"]').forEach(function (link) {
      var url = new URL(link.href);
      if (!url.searchParams.has("coupon")) {
        url.searchParams.set("coupon", coupon);
        link.href = url.href;
      }
    });
  }
})();
