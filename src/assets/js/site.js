/* ===========================================================================
   YayCommerce — shared site behaviour

   Header mega menu, account dropdown and the promo-bar sale countdown.
   Every page loads this; page-specific behaviour lives in its own file.
   ======================================================================== */

(function () {
  "use strict";

  /* -----------------------------------------------------------------------
     Hover menus

     Both the Plugins mega menu and the account dropdown open on pointer
     enter and close on leave, matching the prototype. Focus-within keeps
     them usable from the keyboard, which the prototype did not cover.
     -------------------------------------------------------------------- */

  function bindHoverMenu(root) {
    /* In the drawer, and on any touch screen, these are click toggles
       instead — see below. Hover must not fight them. */
    var hoverable = function () {
      return !window.matchMedia("(max-width: 1024px), (hover: none)").matches;
    };
    var open = function () { if (hoverable()) root.classList.add("is-open"); };
    var close = function () { if (hoverable()) root.classList.remove("is-open"); };

    root.addEventListener("mouseenter", open);
    root.addEventListener("mouseleave", close);
    root.addEventListener("focusin", open);
    root.addEventListener("focusout", function (e) {
      if (!root.contains(e.relatedTarget)) close();
    });
    root.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  document.querySelectorAll(".has-mega, .has-account").forEach(bindHoverMenu);

  /* -----------------------------------------------------------------------
     Drawer

     Below 1024 the header nav and actions move into an off-canvas panel.
     The panel is the same markup as the desktop bar, so nothing here has to
     know what is inside it — only when it is open.
     -------------------------------------------------------------------- */

  var narrow = window.matchMedia("(max-width: 1024px)");
  var coarse = window.matchMedia("(hover: none)");
  var toggle = document.querySelector(".nav-toggle");
  var scrim = document.querySelector(".drawer-scrim");
  var panel = document.getElementById("site-drawer");

  function setDrawer(open) {
    document.documentElement.classList.toggle("is-drawer-open", open);
    if (toggle) toggle.setAttribute("aria-expanded", String(open));
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      setDrawer(!document.documentElement.classList.contains("is-drawer-open"));
    });
  }

  if (scrim) scrim.addEventListener("click", function () { setDrawer(false); });

  var closer = document.querySelector(".drawer-close");
  if (closer) closer.addEventListener("click", function () { setDrawer(false); });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setDrawer(false);
  });

  /* A link inside the drawer navigates; leaving the panel open would flash
     it over the next page. Anchors on the same page need it closed too. */
  if (panel) {
    panel.addEventListener("click", function (e) {
      if (e.target.closest("a") && !e.target.closest(".has-mega > .nav-link")) setDrawer(false);
    });
  }

  /* Resizing past the breakpoint with the drawer open would leave the scroll
     lock on a desktop layout. */
  narrow.addEventListener("change", function (e) {
    if (!e.matches) setDrawer(false);
  });

  /* -----------------------------------------------------------------------
     Plugins menu on touch and in the drawer

     Hover can't open a menu with a finger, and inside the drawer the mega
     menu is an accordion rather than a panel. In both cases the Plugins row
     toggles instead of navigating — the drawer still offers "View all
     plugins" as the way through to the shop.
     -------------------------------------------------------------------- */

  var mega = document.querySelector(".has-mega");

  if (mega) {
    mega.querySelector(".nav-link").addEventListener("click", function (e) {
      if (!narrow.matches && !coarse.matches) return;
      e.preventDefault();
      mega.classList.toggle("is-open");
    });
  }

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
})();
