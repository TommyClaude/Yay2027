/* ===========================================================================
   YayCommerce — Contact form

   Two jobs: swap the form for a confirmation on submit, and assemble the
   contact address in script so it isn't sitting in the markup for address
   harvesters to scrape.
   ======================================================================== */

(function () {
  "use strict";

  /* Address ------------------------------------------------------------- */

  var address = ["hi", "yaycommerce.com"].join("@");

  document.querySelectorAll("[data-contact-email]").forEach(function (link) {
    link.textContent = address;
    link.setAttribute("href", ["mail", "to:", address].join(""));
  });

  /* Submit -------------------------------------------------------------- */

  var form = document.querySelector("[data-contact-form]");
  var sent = document.querySelector("[data-contact-sent]");
  if (!form || !sent) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    form.hidden = true;
    sent.hidden = false;
  });

  var again = document.querySelector("[data-contact-again]");
  if (again) {
    again.addEventListener("click", function () {
      sent.hidden = true;
      form.hidden = false;
      form.reset();
    });
  }
})();
