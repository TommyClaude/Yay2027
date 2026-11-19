/* ===========================================================================
   YayCommerce - shared site behaviour

   Header menus, the mobile drawer, the FAQ accordion, the promo-bar countdown
   and the campaign coupon. Every page loads this; page-specific behaviour
   lives in its own file.
   ======================================================================== */

(function () {
  "use strict";

  var root = document.documentElement;

  /* The page starts as "no-js" and a line in its head lifts that before the
     first paint. Lifting it here as well covers a host that forbids inline
     script: the menus below work, so the no-script layout must not stay. */
  root.classList.remove("no-js");

  /* Skip link: move focus to the content without touching the address.
     Pages that read the hash (My account) must not see "#main". Without
     script the plain anchor still works. */
  var skip = document.querySelector(".skip-link");
  var content = document.getElementById("main");

  if (skip && content) {
    skip.addEventListener("click", function (e) {
      e.preventDefault();
      content.setAttribute("tabindex", "-1");
      content.focus({ preventScroll: true });
      content.scrollIntoView();
    });
  }

  /* Two questions decide how the header behaves:
     narrow - is the nav a drawer rather than a bar?
     coarse - is there no pointer that can hover (a phone, a tablet)? */
  var narrow = window.matchMedia("(max-width: 1024px)");
  var coarse = window.matchMedia("(hover: none)");

  /* -----------------------------------------------------------------------
     Header menus

     The Plugins mega menu and the account dropdown share one behaviour:

       mouse or trackpad   open on hover and on keyboard focus; close a
                           moment after the pointer leaves, on blur and on
                           Escape; only one is open at a time
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

    var leaving = 0;

    el.addEventListener("mouseenter", function () {
      clearTimeout(leaving);
      if (hovers()) { closeMenus(menu); menu.set(true); }
    });

    /* The straight line from the trigger to the far side of its panel leaves
       this element for a few pixels on the way; a short grace period keeps
       the menu open across that gap. */
    el.addEventListener("mouseleave", function () {
      dismissed = false;
      if (!hovers()) return;
      clearTimeout(leaving);
      leaving = setTimeout(function () {
        /* Keyboard focus on a link inside the panel would be left in
           something hidden: it goes back to the trigger, without that
           focus opening the menu again. */
        if (el.contains(document.activeElement) && document.activeElement !== trigger) {
          dismissed = true;
          trigger.focus();
        }
        menu.set(false);
      }, 200);
    });

    el.addEventListener("focusin", function () {
      clearTimeout(leaving);
      if (hovers() && !dismissed) { closeMenus(menu); menu.set(true); }
    });

    /* Focus leaving for another element closes the menu. Focus that simply
       drops (a click on an empty part of the open menu) closes it only if
       the pointer is not on the menu either: it must not vanish from under
       the pointer. */
    el.addEventListener("focusout", function (e) {
      if (el.contains(e.relatedTarget)) return;
      dismissed = false;
      if (hovers()) {
        if (e.relatedTarget || !el.matches(":hover")) menu.set(false);
      } else if (!narrow.matches && e.relatedTarget) {
        menu.set(false);
      }
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
        var willOpen = !menu.isOpen();
        if (willOpen) closeMenus(menu);
        menu.set(willOpen);
      }
    });

    trigger.addEventListener("click", function (e) {
      /* With a mouse, hover has already opened the menu by the time a click
         arrives. A click that no pointer made (a screen reader or switch
         activating the button) has nothing else to open it. */
      if (hovers() && !(isChip && e.detail === 0)) return;
      /* In the drawer the account links are already on show. */
      if (isChip && narrow.matches) return;
      e.preventDefault();
      var open = !menu.isOpen();
      if (!narrow.matches) closeMenus();
      menu.set(open);
    });

    menus.push(menu);
  }

  function closeMenus(except) {
    menus.forEach(function (menu) { if (menu !== except) menu.set(false); });
  }

  /* Escape dismisses a menu that hover opened even when focus is elsewhere
     (WCAG 1.4.13). With focus inside, the menu's own handler has already run
     and returned focus to its trigger. */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !narrow.matches) closeMenus();
  });

  document.querySelectorAll(".has-mega, .has-account").forEach(bindMenu);

  /* A tap outside an open menu closes it. Only touch needs this: with a
     mouse, leaving the menu already has. It listens for the press rather
     than the click because Safari on iPad sends no click to the document
     for a tap on plain page content. */
  document.addEventListener("pointerdown", function (e) {
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
      ["role", "tabindex", "aria-expanded"].forEach(function (name) {
        chip.removeAttribute(name);
      });
    } else {
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");
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

    /* Everything outside the sheet is out of reach while it is open, for a
       screen reader's cursor as much as for the keyboard. The sheet lives
       inside the header, so the header's other parts are named one by one. */
    document.querySelectorAll(".skip-link, .promo, main, .site-footer, .site-header__logo, .site-header__tools").forEach(function (el) {
      el.inert = open;
    });

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

  /* A page brought back with the Back button is shown exactly as it was
     left. A menu that was open then was held open by a pointer that has
     since gone elsewhere, and nothing would close it. */
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    setDrawer(false, false);
    closeMenus();
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

     Sample behaviour carried over from the design: the deadline is midnight
     two days after whenever the page is opened, so it never arrives. A real
     campaign needs its real end date here, and the bar taken down after it.
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
     in the address (?coupon=SUNNY30). The code is remembered for as long as
     the tab is open and added to every checkout link the visitor meets, so
     looking at another plugin on the way does not lose the offer. It is
     forgotten once an order is placed.
     -------------------------------------------------------------------- */

  var coupon = new URLSearchParams(window.location.search).get("coupon");
  var isCode = function (code) { return !!code && /^[A-Za-z0-9_-]{1,32}$/.test(code); };

  try {
    if (/thank-you\.html$/.test(window.location.pathname)) {
      sessionStorage.removeItem("yay-coupon");
      coupon = null;
    } else if (isCode(coupon)) {
      sessionStorage.setItem("yay-coupon", coupon);
    } else {
      coupon = sessionStorage.getItem("yay-coupon");
    }
  } catch (error) { /* storage is blocked: the code still rides the links of the page it arrived on */ }

  if (isCode(coupon)) {
    document.querySelectorAll('a[href^="checkout.html"]').forEach(function (link) {
      var url = new URL(link.href);
      if (!url.searchParams.has("coupon")) {
        url.searchParams.set("coupon", coupon);
        link.href = url.href;
      }
    });
  }
})();
