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
    var open = function () { root.classList.add("is-open"); };
    var close = function () { root.classList.remove("is-open"); };

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
